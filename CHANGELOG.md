# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-10-22

### Fixed

- Emit Node-compatible ESM imports and declarations.
- Clean build output before compiling and check Node runtime exports before packing.

## [0.1.2] - 2026-07-03

### Changed

- Bumped package metadata and development dependency ranges for the public package export.
- Kept public exports stable while normalizing export ordering.

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
