# Stowaway

An offline iPhone reader prototype. **S0:** one original synthetic three-chapter story, SQLite persistence, sanitized rich HTML, a controlled WebView, chapter navigation, light/dark themes and adjustable text size. **S1:** a bounded development-only SpaceBattles access/primary-manifest diagnostic, ready for Owen's iPhone test; acceptance is pending.

The [October audit](docs/Stowaway_October_2026_Groundwork_Audit.md) controls implementation. September reports in `docs/research/` are background. S1 networking is restricted to public primary indexes and minimal representative samples. No importer, backend, accounts, sync or download manager is implemented.

Install or update **Expo Go from the iPhone App Store**. As of 4 October 2026, SDK 57 is the current Expo Go SDK: Expo's [3 September update](https://expo.dev/changelog/expo-go-57-login) confirms iOS support and requires the same Expo account in Expo CLI and Expo Go. Sign in to that account in the app. **Apple Developer membership, TestFlight and `eas go` are not required** to run this SDK 57 project through the current App Store Expo Go.

Use Node 22 LTS (>=22.13) or 24 LTS (>=24.3), npm, and Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd run check
npx.cmd expo login
npm.cmd start
```

Sign Expo CLI and Expo Go into the same Expo account, put Windows and the iPhone on the same Wi-Fi, allow Node through Windows Firewall on your private network, and scan the terminal QR with the iPhone Camera. Allow local-network access on the phone. No local Xcode is needed for Metro/Expo Go development.

The commands above run Stowaway in the current App Store Expo Go. Select a chapter, scroll, expand both spoilers, change the text size/theme, return to contents, and reopen. **Owen reports core S0 physical reader acceptance passed on his iPhone on 5 October 2026**, including same-passage font-change/resume, force-quit/reopen with Metro and already-open reading after network loss. The [device checklist](docs/S0_Device_Checklist.md) records the precise passes and remaining unverified checks, including VoiceOver and direct WebView script/network diagnostics. Expo Go's Metro connection is not proof of bundled airplane-mode cold start (S2).

`npm run typecheck`, `npm run lint`, and `npm test` can run separately. Tests use real host SQLite via Node's `node:sqlite` as well as `jest-expo`; mocked native APIs cannot prove iOS SQLite/WKWebView behavior. Only the active chapter body is read. The database is seeded with conflict-safe inserts, never deleted/reset on startup. Uninstalling Expo Go or clearing its app data can remove local state.

See [setup and implementation notes](docs/S0_Setup.md) for versions, architecture, verification and limitations.

For S1, open **S1 diagnostic (dev only)** from Contents, paste one of Owen's selected public thread URLs, and tap **Run S1 diagnostic**. Results stay in memory; real stories never enter the fixture library. Follow the [S1 record and A/B/C phone checklist](docs/S1_Access_Spike.md) and [source-policy review](docs/S1_Source_Policy.md). Stop on any blocked/login/challenge result. Automated tests and CI make no live source requests.
