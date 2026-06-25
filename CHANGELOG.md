# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-06-25

Initial release of `SessionEngine`, a browser session and cache lifecycle toolkit for TypeScript applications.

### Added

- Added TTL storage envelope helpers for local/session storage values with metadata, expiration checks, and corrupted-entry cleanup.
- Added `createStorageCache()` for scoped storage operations with cache prefixes and optional ownership validation.
- Added `SessionEngine` for session cache lifecycle handling, logout coordination, stale-session validation, and cross-tab signaling.
- Added `createAuthFetch()` for auth-aware fetch behavior around unauthorized and rate-limited responses.
- Added helpers for saving, reading, aging, and removing storage values through pluggable storage adapters.
- Added `SessionValidationResult` as a public type for validation callbacks.
- Added TypeScript declarations, package-local tests, typecheck, build, and built-dist smoke scripts.
