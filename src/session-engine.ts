import type {
  AuthFetchOptions,
  CachedValue,
  LoggerLike,
  SessionValidationResult,
  SessionEngineOptions,
  StorageCache,
  StorageLike,
  StorageOptions,
} from "./types";

function getDefaultStorage(): StorageLike | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function keys(storage: StorageLike): string[] {
  const output: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key) output.push(key);
  }
  return output;
}

function normalizeSessionValidationResult(
  result: SessionValidationResult,
): { valid: boolean; clearAuth: boolean } {
  if (result === true || result === "valid") {
    return { valid: true, clearAuth: false };
  }
  if (result === "inconclusive") {
    return { valid: false, clearAuth: false };
  }
  return { valid: false, clearAuth: true };
}

/**
 * Retrieves a typed value from browser storage. 
 * Automatically handles JSON parsing, key expiration (TTL verification), and corrupt-entry removal.
 * 
 * @param key The storage key.
 * @param ttl Optional time-to-live threshold in milliseconds.
 * @param options Configurations for the storage container and logger interfaces.
 * @returns The cached value of type T, or null if missing, expired, or corrupted.
 */
export function getFromStorage<T>(
  key: string,
  ttl?: number,
  options: { storage?: StorageLike | null; logger?: LoggerLike } = {},
): T | null {
  const storage = options.storage ?? getDefaultStorage();
  if (!storage) return null;
  try {
    const stored = storage.getItem(key);
    if (!stored) return null;
    const cached = JSON.parse(stored) as CachedValue<T>;
    if (ttl !== undefined && ttl !== Infinity) {
      const age = Date.now() - cached.metadata.timestamp;
      if (age > ttl) {
        storage.removeItem(key);
        return null;
      }
    }
    return cached.data;
  } catch (error) {
    options.logger?.error?.("[SessionEngine] Failed to read storage", {
      key,
      error,
    });
    try {
      storage.removeItem(key);
    } catch {
      // ignore cleanup failure
    }
    return null;
  }
}

/**
 * Saves a value into browser storage wrapped in a metadata-enriched TTL envelope.
 * 
 * @param key The target storage key.
 * @param data The data to write.
 * @param storageOptions Storage lifecycle configuration (ttl, version).
 * @param options Configurations for the storage container and logger interfaces.
 */
export function saveToStorage<T>(
  key: string,
  data: T,
  storageOptions: StorageOptions = {},
  options: { storage?: StorageLike | null; logger?: LoggerLike } = {},
): void {
  const storage = options.storage ?? getDefaultStorage();
  if (!storage) return;
  try {
    const cached: CachedValue<T> = {
      data,
      metadata: {
        timestamp: Date.now(),
        ttl: storageOptions.ttl,
        version: storageOptions.version,
      },
    };
    storage.setItem(key, JSON.stringify(cached));
  } catch (error) {
    options.logger?.error?.("[SessionEngine] Failed to write storage", {
      key,
      error,
    });
  }
}

/**
 * Removes a key from browser storage.
 * 
 * @param key The target storage key to delete.
 * @param options Configurations for the storage container and logger interfaces.
 */
export function removeFromStorage(
  key: string,
  options: { storage?: StorageLike | null; logger?: LoggerLike } = {},
): void {
  const storage = options.storage ?? getDefaultStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch (error) {
    options.logger?.error?.("[SessionEngine] Failed to remove storage", {
      key,
      error,
    });
  }
}

/**
 * Clears all keys starting with a specific prefix from browser storage.
 * 
 * @param prefix The key prefix match filter.
 * @param options Configurations for the storage container and logger interfaces.
 * @returns The total number of items removed.
 */
export function clearStorageByPrefix(
  prefix: string,
  options: { storage?: StorageLike | null; logger?: LoggerLike } = {},
): number {
  const storage = options.storage ?? getDefaultStorage();
  if (!storage) return 0;
  let count = 0;
  for (const key of keys(storage)) {
    if (key.startsWith(prefix)) {
      storage.removeItem(key);
      count += 1;
    }
  }
  options.logger?.warn?.("[SessionEngine] Cleared storage by prefix", {
    prefix,
    count,
  });
  return count;
}

/**
 * Calculates the current age of a cached entry in milliseconds.
 * 
 * @param key The storage key.
 * @param options Configuration for the storage container.
 * @returns The age of the entry in milliseconds, or null if missing or invalid.
 */
export function getStorageAge(
  key: string,
  options: { storage?: StorageLike | null } = {},
): number | null {
  const storage = options.storage ?? getDefaultStorage();
  if (!storage) return null;
  try {
    const stored = storage.getItem(key);
    if (!stored) return null;
    const cached = JSON.parse(stored) as CachedValue<unknown>;
    return Date.now() - cached.metadata.timestamp;
  } catch {
    return null;
  }
}

/**
 * Creates a structured StorageCache object exposing clean, pre-bound lifecycle getters and setters.
 * 
 * @param options Configuration for the storage container and logger interfaces.
 * @returns A cache access facade.
 */
export function createStorageCache(options: {
  storage?: StorageLike | null;
  logger?: LoggerLike;
} = {}): StorageCache {
  return {
    get: (key, ttl) => getFromStorage(key, ttl, options),
    save: (key, data, storageOptions) =>
      saveToStorage(key, data, storageOptions, options),
    remove: (key) => removeFromStorage(key, options),
    clearByPrefix: (prefix) => {
      clearStorageByPrefix(prefix, options);
    },
    age: (key) => getStorageAge(key, options),
  };
}

/**
 * Wraps the fetch API with central response-intercept hooks for handling unauthorized (401)
 * and rate-limited (429) requests.
 * 
 * @param options Configurations for implementation fetch, 401 callback, and 429 callback hooks.
 * @returns An auth-aware fetch function.
 */
export function createAuthFetch(options: AuthFetchOptions = {}) {
  const fetchImpl = options.fetch ?? fetch;
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await fetchImpl(input, init);
    if (response.status === 401) await options.onUnauthorized?.(response);
    if (response.status === 429) await options.onRateLimit?.(response);
    return response;
  };
}

/**
 * Manages browser session cache lifecycles, user-data ownership markers, 
 * stale-session validations, and cross-tab logout synchronization signals.
 */
export class SessionEngine {
  private cleanup: (() => void) | null = null;
  private isClearing = false;

  /**
   * Initializes a new instance of the SessionEngine.
   * 
   * @param options Configuration options scoped to a namespace.
   */
  constructor(private readonly options: SessionEngineOptions) {}

  private storage(): StorageLike | null {
    return this.options.storage ?? getDefaultStorage();
  }

  private windowRef():
    | Pick<Window, "addEventListener" | "removeEventListener" | "dispatchEvent">
    | null {
    return this.options.window ?? (typeof window === "undefined" ? null : window);
  }

  /**
   * Resolves the scoped key used to store logout synchronization signals.
   */
  get logoutSignalKey(): string {
    return this.options.logoutSignalKey ?? `${this.options.namespace}:auth:logout-signal`;
  }

  /**
   * Resolves the scoped key used to verify user data ownership.
   */
  get ownershipKey(): string {
    return this.options.ownershipKey ?? `${this.options.namespace}:cache:user-id`;
  }

  /**
   * Wipes active authentication caches and callbacks.
   * Optionally broadcasts the action to synchronize other browser tabs.
   * 
   * @param reason The trigger cause for clearing authentication (e.g. 'expired').
   * @param broadcast If true, broadcasts a logout event via storage sync.
   */
  clearAuthState(reason?: string, broadcast = false): void {
    if (this.isClearing) return;
    this.isClearing = true;
    try {
      this.options.clearUserCaches?.();
      if (broadcast) this.signalLogout();
      this.options.onAuthCleared?.(reason);
    } finally {
      this.isClearing = false;
    }
  }

  /**
   * Broadcasts a transient logout signal to other tabs using localStorage.
   */
  signalLogout(): void {
    const storage = this.storage();
    if (!storage) return;
    storage.setItem(this.logoutSignalKey, Date.now().toString());
    setTimeout(() => {
      try {
        storage.removeItem(this.logoutSignalKey);
      } catch {
        // ignore cleanup failure
      }
    }, 100);
  }

  /**
   * Subscribes to browser storage events to synchronize logouts across multiple open tabs.
   * 
   * @returns A cleanup callback to unsubscribe from storage events.
   */
  setupCrossTabSync(): () => void {
    if (this.cleanup) return this.cleanup;
    const win = this.windowRef();
    if (!win) return () => {};
    const handler = (event: Event) => {
      const storageEvent = event as StorageEvent;
      if (storageEvent.key === this.logoutSignalKey) {
        this.clearAuthState("logout_signal");
      }
    };
    win.addEventListener("storage", handler);
    this.cleanup = () => {
      win.removeEventListener("storage", handler);
      this.cleanup = null;
    };
    return this.cleanup;
  }

  /**
   * Performs an asynchronous session health check, clearing auth caches on failure.
   * 
   * @returns A promise resolving to true if the session is valid, false otherwise.
   */
  async validateSession(): Promise<boolean> {
    if (!this.options.validateSession) return false;
    const result = normalizeSessionValidationResult(
      await this.options.validateSession(),
    );
    if (result.clearAuth) this.clearAuthState("session_validation_failed", true);
    return result.valid;
  }

  /**
   * Synchronizes ownership key markers, detecting switches in user identity
   * and purging stale client-side caches accordingly.
   */
  async validateOwnership(): Promise<void> {
    const storage = this.storage();
    if (!storage) return;
    const currentUserId = this.options.getCurrentUserId?.() ?? null;
    let storedUserId = storage.getItem(this.ownershipKey);

    const clearAction = this.options.clearUserDataCaches ?? this.options.clearUserCaches;

    const hasScopedCache = () => {
      if (!this.options.userCachePrefixes) return false;
      const keysList = keys(storage);
      return (
        keysList.some((key) =>
          this.options.userCachePrefixes?.some((prefix) => key.startsWith(prefix)),
        ) || (this.options.queryCacheKey ? keysList.includes(this.options.queryCacheKey) : false)
      );
    };

    if (!currentUserId) {
      const serverUserId = this.options.getServerUserId
        ? await this.options.getServerUserId()
        : null;
      if (!serverUserId) {
        if (storedUserId || hasScopedCache()) clearAction?.();
        storage.removeItem(this.ownershipKey);
        return;
      }
      if (storedUserId && storedUserId !== serverUserId) {
        clearAction?.();
      }
      storage.setItem(this.ownershipKey, serverUserId);
      return;
    }

    if (!storedUserId && hasScopedCache()) {
      clearAction?.();
    }

    if (storedUserId && storedUserId !== currentUserId) {
      clearAction?.();
    }
    storage.setItem(this.ownershipKey, currentUserId);
  }

  /**
   * Boots up the session engine, configuring sync listeners and evaluating ownership structures.
   * 
   * @returns A cleanup callback to terminate active event listeners.
   */
  start(): () => void {
    const cleanup = this.setupCrossTabSync();
    void this.validateOwnership();
    if (this.options.validateSession) {
      this.validateSession().catch((error) => {
        this.options.logger?.warn?.("[SessionEngine] Session validation failed", {
          error,
        });
      });
    }
    return cleanup;
  }
}
