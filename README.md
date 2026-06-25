<img src="https://raw.githubusercontent.com/cpauldev/session-engine/main/banner.png" alt="SessionEngine Banner" width="100%" />

# SessionEngine: Browser Session and Cache Lifecycle Tools

![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Browser](https://img.shields.io/badge/-Browser_Storage-0F766E?style=flat-square) ![Fetch API](https://img.shields.io/badge/-Fetch_API-0284C7?style=flat-square) ![License](https://img.shields.io/badge/-MIT_License-blue?style=flat-square) [![Changelog](https://img.shields.io/badge/Changelog-v0.1.0-blue?style=flat-square)](./CHANGELOG.md)

SessionEngine helps browser applications manage local session cache safely: TTL storage envelopes, corrupted-entry cleanup, prefix clearing, ownership markers, cross-tab logout signals, stale-session validation, and auth-aware fetch behavior.

It is designed for developers building authenticated SPAs, dashboards, account portals, or hybrid apps that cache user/session data in browser storage. Use it when you need to avoid stale auth state, cross-user cache leaks, inconsistent logout behavior across tabs, and repeated `401`/`429` fetch handling.

#### 🤖 Ask your coding assistant

> "Audit my codebase to see if adding the `session-engine` package on npm is beneficial. If so, explain why and draft an integration plan identifying session validation, ownership markers, cache prefixes, cross-tab logout behavior, and unauthorized/rate-limit handlers using the package README and source code."

---

## Why use SessionEngine?

| Feature | Without SessionEngine | With **SessionEngine** |
| :----------------------- | :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| **TTL Cache Entries**    | Expiration metadata is duplicated and inconsistently parsed.                             | ⏳ **TTL Envelopes.** `createStorageCache()` stores versioned TTL envelopes.                                         |
| **Corrupted Storage**    | Bad JSON can break app startup or hooks.                                                 | 🧹 **Automatic Cleanup.** Corrupted entries are removed and treated as misses.                                       |
| **User Ownership**       | Cached data can survive account switches.                                                | 👤 **Ownership Markers.** Ownership markers clear cache when the user changes.                                       |
| **Cross-Tab Logout**     | One tab logs out while others keep stale state.                                          | 🔄 **Cross-Tab Sync.** Logout signals notify other tabs through storage events.                                      |
| **Fetch Behavior**       | Every callsite handles `401` and `429` differently.                                      | ⚡ **Auth-Aware Fetch.** `createAuthFetch()` centralizes unauthorized and rate-limit hooks.                           |

---

## Installation

Install SessionEngine via your preferred package manager:

```bash
# npm
npm install session-engine

# yarn
yarn add session-engine

# pnpm
pnpm add session-engine

# bun
bun add session-engine
```

---

## Quick Start

```ts
import { SessionEngine } from "session-engine";

const session = new SessionEngine({
  namespace: "myapp",
  getCurrentUserId: () => currentUser.id,
  validateSession: async () => {
    const response = await fetch("/api/session");
    if (response.status === 401) return "invalid";
    if (!response.ok) return "inconclusive";
    return "valid";
  },
  onAuthCleared: (reason) => {
    window.location.assign("/login");
  },
});

session.start();
```

Validation callbacks can return `true`/`"valid"`, `false`/`"invalid"`, or `"inconclusive"`. Invalid results clear auth state and can broadcast logout. Inconclusive results, such as transient network or `5xx` failures, return `false` from `validateSession()` without clearing local auth caches.

---

## Practical Examples

### Use TTL storage

```ts
import { createStorageCache } from "session-engine";

const cache = createStorageCache({
  storage: window.localStorage,
});

cache.save("profile", { name: "Ada" }, { ttl: 5 * 60 * 1000 });
const profile = cache.get<{ name: string }>("profile");
```

### Clear cache by prefix

```ts
import { clearStorageByPrefix } from "session-engine";

clearStorageByPrefix("account:", { storage: window.localStorage });
```

### Handle auth-aware fetches

```ts
import { createAuthFetch } from "session-engine";

const authFetch = createAuthFetch({
  fetch: window.fetch.bind(window),
  onUnauthorized: () => session.signalLogout(),
  onRateLimit: async (response) => {
    console.warn("Rate limited", response.status);
  },
});

const response = await authFetch("/api/account");
```

### Validate ownership

```ts
const session = new SessionEngine({
  namespace: "dashboard",
  getCurrentUserId: () => currentUser.id,
  clearUserCaches: () => {
    console.warn("Cleared cache for previous user");
  },
});

await session.validateOwnership();
```

---

## API Reference

| Export | Purpose |
| :-- | :-- |
| `SessionEngine` | Coordinates session validation, ownership markers, cache clearing, and logout signals. |
| `createStorageCache(options)` | Creates typed TTL cache helpers over `localStorage`-like storage. |
| `createAuthFetch(options)` | Wraps `fetch` with `401` and `429` hooks. |
| `getFromStorage(key, ttl?, options?)` | Reads a versioned TTL storage envelope from options.storage. |
| `saveToStorage(key, value, storageOptions?, options?)` | Saves a value to options.storage with TTL/version metadata. |
| `removeFromStorage(key, options?)` | Removes one key from options.storage. |
| `clearStorageByPrefix(prefix, options?)` | Removes all keys with a prefix from options.storage. |
| `getStorageAge(key, options?)` | Returns entry age in milliseconds, or `null`. |

---

## Development

To build the package and generate TypeScript declarations:

```bash
bun run build
```

To run the package unit tests:

```bash
bun run test
```

To run the package type check:

```bash
bun run typecheck
```

After building, verify the published runtime exports:

```bash
bun run test:smoke
```

---

## Related Packages

- [`rate-engine`](https://github.com/cpauldev/rate-engine) for policy-driven rate limiting.
- [`route-engine`](https://github.com/cpauldev/route-engine) for safe HTTP route boundaries.
- [`redact-log`](https://github.com/cpauldev/redact-log) for safe logging.
- [`secret-engine`](https://github.com/cpauldev/secret-engine) for context-bound encryption and secret handling.

---

## License

MIT © [Christian Paul](https://github.com/cpauldev)
