import { describe, expect, it, mock } from "bun:test";

import {
  SessionEngine,
  clearStorageByPrefix,
  createAuthFetch,
  createStorageCache,
  getFromStorage,
  saveToStorage,
} from "../index";

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("session-engine", () => {
  it("stores TTL values and clears corrupted entries", () => {
    const storage = createMemoryStorage();
    saveToStorage("key", { ok: true }, { ttl: 10 }, { storage });
    expect(getFromStorage<{ ok: boolean }>("key", 10, { storage })?.ok).toBe(
      true,
    );
    storage.setItem("bad", "{");
    expect(getFromStorage("bad", undefined, { storage })).toBeNull();
    expect(storage.getItem("bad")).toBeNull();
  });

  it("clears by prefix and exposes cache facade", () => {
    const storage = createMemoryStorage();
    const cache = createStorageCache({ storage });
    cache.save("app:a", 1);
    cache.save("app:b", 2);
    cache.save("other", 3);
    expect(clearStorageByPrefix("app:", { storage })).toBe(2);
    expect(cache.get<number>("other")).toBe(3);
  });

  it("wraps fetch for auth and rate-limit callbacks", async () => {
    const unauthorized = mock();
    const limited = mock();
    const authFetch = createAuthFetch({
      fetch: async () => new Response("no", { status: 401 }),
      onUnauthorized: unauthorized,
      onRateLimit: limited,
    });
    await authFetch("https://example.com");
    expect(unauthorized).toHaveBeenCalled();
    expect(limited).not.toHaveBeenCalled();
  });

  it("validates ownership and responds to logout signals", async () => {
    const storage = createMemoryStorage();
    const cleared = mock();
    const listeners = new Map<string, EventListener>();
    const win = {
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      },
      dispatchEvent: () => true,
    };
    const engine = new SessionEngine({
      namespace: "app",
      storage,
      window: win,
      getCurrentUserId: () => "user-2",
      clearUserCaches: cleared,
    });
    storage.setItem(engine.ownershipKey, "user-1");
    await engine.validateOwnership();
    expect(cleared).toHaveBeenCalled();
    engine.setupCrossTabSync();
    listeners.get("storage")?.({
      key: engine.logoutSignalKey,
    } as unknown as Event);
    expect(cleared).toHaveBeenCalledTimes(2);
  });

  it("does not clear auth state for inconclusive session validation", async () => {
    const cleared = mock();
    const engine = new SessionEngine({
      namespace: "app",
      validateSession: async () => "inconclusive",
      clearUserCaches: cleared,
    });

    await expect(engine.validateSession()).resolves.toBe(false);
    expect(cleared).not.toHaveBeenCalled();
  });

  it("clears auth state for explicit invalid session validation", async () => {
    const cleared = mock();
    const engine = new SessionEngine({
      namespace: "app",
      validateSession: async () => "invalid",
      clearUserCaches: cleared,
    });

    await expect(engine.validateSession()).resolves.toBe(false);
    expect(cleared).toHaveBeenCalled();
  });
});
