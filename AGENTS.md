# Stowaway

Read `docs/Stowaway_October_2026_Groundwork_Audit.md` first. It is the active specification; `docs/research/` contains background only. **Core S0 and core S1 physical acceptance passed, as reported by Owen.** The completed S1 scope is a bounded development-only SpaceBattles access and primary-manifest spike, not the full v0/importer. Read `docs/S1_Access_Spike.md` for the exact evidence and remaining limitations; further implementation requires a new scope instruction.

- One Expo SDK 57 / React Native app, strict TypeScript, Expo Router, npm and committed `package-lock.json`. Install Expo/native packages with `npx expo install`.
- Story identity is source + numeric thread ID; chapter identity adds numeric post ID. IDs are strings. Titles and order are metadata.
- SQLite holds canonical sanitized HTML, hashes, sanitizer versions, block IDs, locators and settings. Document files hold the bundled raster; per-chapter rendering files are disposable. Never reset storage on launch.
- Keep parser/allowlist serializer, storage, and trusted reader bridge separate. No ORM, global state library, DOM emulator, Node polyfill stack, backend, or plugin framework.
- No live SpaceBattles requests in S0, tests or CI. Only original synthetic fixtures in tests. Do not commit private downloads, raw story captures, credentials or build outputs. Read `docs/S1_Source_Policy.md` before S1 requests: the user-supplied policy clears only the personal spike. Use the single S1 client, honest User-Agent, no cookies/auth, checked public paths/redirects, one request in flight and >=2-second spacing. Stop on access/challenge failure. S1 results are transient metadata; no real prose goes into SQLite or the normal library.
- Reader content must not execute source scripts or load remote resources. Only app-owned bridge code runs. Safe links open only after a deliberate action.
- Loading, restoring and typography changes must never save transient top-of-page locators. Same-version restoration uses chapter/hash/block/offset and expanded spoilers; progression is the fallback, not edit-proof matching.
- Run `npm run check`, `npx expo install --check`, `npx expo-doctor`, and an iOS bundle export when relevant. Tests are fixture-only. Do not weaken tests to get green results.
- Work in one implementing session, followed by a separate sequential diff review. Report changes, commands, results and unverified device behavior honestly. Never invent an iPhone run or turn user-reported acceptance into wire-level inspection. The acceptance follow-up authorizes a separate commit, branch push and PR preparation; it does not authorize merging, full importing, S2 or broader source support.

Use Node 22 LTS (>=22.13) or Node 24 LTS (>=24.3). On Windows, use `npm.cmd` / `npx.cmd` if PowerShell blocks `.ps1` launchers. S0/S1 do not authorize paid builds, App Store submission, production import/update UI, other sites, accounts, sync, RSS or notifications.
