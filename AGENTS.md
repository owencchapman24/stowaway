# Stowaway

Read `docs/Stowaway_October_2026_Groundwork_Audit.md` first. It is the active specification; `docs/research/` contains background only. Current implementation scope is **S0: offline synthetic fixture reader**, not the full v0.

- One Expo SDK 57 / React Native app, strict TypeScript, Expo Router, npm and committed `package-lock.json`. Install Expo/native packages with `npx expo install`.
- Story identity is source + numeric thread ID; chapter identity adds numeric post ID. IDs are strings. Titles and order are metadata.
- SQLite holds canonical sanitized HTML, hashes, sanitizer versions, block IDs, locators and settings. Document files hold the bundled raster; per-chapter rendering files are disposable. Never reset storage on launch.
- Keep parser/allowlist serializer, storage, and trusted reader bridge separate. No ORM, global state library, DOM emulator, Node polyfill stack, backend, or plugin framework.
- No live SpaceBattles requests in S0 or CI. Only original synthetic fixtures. Do not commit private downloads, raw story captures, credentials or build outputs. S1 requires the audit's source-policy review before requests.
- Reader content must not execute source scripts or load remote resources. Only app-owned bridge code runs. Safe links open only after a deliberate action.
- Loading, restoring and typography changes must never save transient top-of-page locators. Same-version restoration uses chapter/hash/block/offset and expanded spoilers; progression is the fallback, not edit-proof matching.
- Run `npm run check`, `npx expo install --check`, `npx expo-doctor`, and an iOS bundle export when relevant. Tests are fixture-only. Do not weaken tests to get green results.
- Work in one implementing session, followed by a separate sequential diff review. Report changes, commands, results and unverified device behavior honestly. Never invent an iPhone run or declare S0 physically accepted before Owen tests it.

Use Node 22 LTS (>=22.13) or Node 24 LTS (>=24.3). On Windows, use `npm.cmd` / `npx.cmd` if PowerShell blocks `.ps1` launchers. S0 does not authorize paid builds, App Store submission, import/update UI, other sites, accounts, sync, RSS or notifications.
