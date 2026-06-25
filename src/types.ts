/**
 * Minimal interface of browser storage (localStorage / sessionStorage) required by SessionEngine.
 */
export type StorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem" | "key" | "length"
>;

/**
 * Envelope metadata stored alongside cached values to track lifecycles.
 */
export type CacheMetadata = {
  /** Unix timestamp in ms when the entry was written. */
  timestamp: number;
  /** Time-to-live duration in milliseconds. */
  ttl?: number;
  /** Schema or data version identifier for tracking staled structures. */
  version?: string;
};

/**
 * Envelope wrapping a cached value with metadata tags.
 */
export type CachedValue<T> = {
  /** The raw cached value payload. */
  data: T;
  /** Envelope metadata for cache lifecycles. */
  metadata: CacheMetadata;
};

/**
 * Options for writing entries into browser storage.
 */
export type StorageOptions = {
  /** Time-to-live duration in milliseconds. */
  ttl?: number;
  /** Schema or data version identifier. */
  version?: string;
};

/**
 * Interface for optional custom logging wrappers.
 */
export type LoggerLike = {
  debug?: (message: string, metadata?: Record<string, unknown>) => void;
  warn?: (message: string, metadata?: Record<string, unknown>) => void;
  error?: (message: string, metadata?: Record<string, unknown>) => void;
};

/**
 * Minimal functional signature compatible with the web standard `fetch` API.
 */
export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * The cache facade exposing clean, pre-bound functional helpers.
 */
export type StorageCache = {
  /** Fetches a typed item from storage, validating expiration. */
  get: <T>(key: string, ttl?: number) => T | null;
  /** Saves a value to storage wrapped in a metadata envelope. */
  save: <T>(key: string, data: T, options?: StorageOptions) => void;
  /** Deletes an item from storage. */
  remove: (key: string) => void;
  /** Clears all storage keys starting with a specific prefix. */
  clearByPrefix: (prefix: string) => void;
  /** Resolves the current age of a cached entry in milliseconds. */
  age: (key: string) => number | null;
};

/**
 * Configurations for the auth-aware intercepted fetch instance.
 */
export type AuthFetchOptions = {
  /** Custom fetch implementation fallback. Defaults to global fetch. */
  fetch?: FetchLike;
  /** Callback triggered when a request returns 401 Unauthorized. */
  onUnauthorized?: (response: Response) => void | Promise<void>;
  /** Callback triggered when a request returns 429 Too Many Requests. */
  onRateLimit?: (response: Response) => void | Promise<void>;
};

/**
 * Result returned by a session validation callback.
 * `false` and `invalid` clear auth state; `inconclusive` returns false without clearing.
 */
export type SessionValidationResult =
  | boolean
  | "valid"
  | "invalid"
  | "inconclusive";

/**
 * Configuration options for the SessionEngine instance.
 */
export type SessionEngineOptions = {
  /** Namespace used to scope and prefix storage keys. */
  namespace: string;
  /** Target storage driver. Defaults to window.localStorage. */
  storage?: StorageLike;
  /** Custom event target for dispatching/listening to cross-tab synchronization events. */
  window?: Pick<
    Window,
    "addEventListener" | "removeEventListener" | "dispatchEvent"
  >;
  /** Logger implementation. */
  logger?: LoggerLike;
  /** Custom key used to store logout synchronization signals. */
  logoutSignalKey?: string;
  /** Custom key used to verify user data ownership. */
  ownershipKey?: string;
  /** Prefix filters defining storage keys to wipe when user session switches. */
  userCachePrefixes?: string[];
  /** Custom query cache key to clear upon logout. */
  queryCacheKey?: string;
  /** Callback to retrieve the current active user ID. */
  getCurrentUserId?: () => string | null;
  /** Callback to retrieve the true user ID from server-side verification. */
  getServerUserId?: () => Promise<string | null>;
  /** Hook to execute session health check/validation. */
  validateSession?: () => Promise<SessionValidationResult>;
  /** Callback to clear generic client caches. */
  clearUserCaches?: () => void;
  /** Callback to clear specific user-scoped data/queries. */
  clearUserDataCaches?: () => void;
  /** Callback triggered when the session gets cleared. */
  onAuthCleared?: (reason?: string) => void;
};
