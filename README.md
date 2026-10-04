# Stowaway

An offline iPhone reader prototype. **S0 only:** one original synthetic three-chapter story, SQLite persistence, sanitized rich HTML, a controlled WebView, chapter navigation, light/dark themes and adjustable text size.

The [October audit](docs/Stowaway_October_2026_Groundwork_Audit.md) controls implementation. September reports in `docs/research/` are background. No SpaceBattles networking, importer, backend, accounts, sync or download manager is implemented.

Use Node 22 LTS (>=22.13) or 24 LTS (>=24.3), npm, and Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd run check
npx.cmd expo login
npm.cmd start
```

Sign Expo CLI and Expo Go into the same Expo account, put Windows and the iPhone on the same Wi-Fi, allow Node through Windows Firewall on your private network, and scan the terminal QR with the iPhone Camera. Allow local-network access on the phone. No local Xcode is needed for Metro/Expo Go development.

**Expo Go installation prerequisite:** this app uses stable SDK 57. As checked on 4 October 2026, Expo's [iOS compatibility instructions](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/) say the App Store Expo Go is SDK 54; SDK 57 Expo Go requires an Apple Developer membership and TestFlight via `npx.cmd eas-cli@latest go --sdk-version 57.0.0`. This build/purchase has **not** been performed or authorized here. An SDK 54 App Store install cannot open this SDK 57 project. Follow [Expo's SDK 57 iPhone download instructions](https://expo.dev/go?device=true&platform=ios&sdkVersion=57) for the matching client. If you have no membership, decide the installation route before physical testing; do not silently downgrade the app.

After installing the matching client, the commands above run Stowaway. Select a chapter, scroll, expand both spoilers, change the text size/theme, return to contents, and reopen. Follow the [device checklist](docs/S0_Device_Checklist.md); physical acceptance is pending. Expo Go's Metro connection is not proof of bundled airplane-mode cold start (S2).

`npm run typecheck`, `npm run lint`, and `npm test` can run separately. Tests use real host SQLite via Node's `node:sqlite` as well as `jest-expo`; mocked native APIs cannot prove iOS SQLite/WKWebView behavior. Only the active chapter body is read. The database is seeded with conflict-safe inserts, never deleted/reset on startup. Uninstalling Expo Go or clearing its app data can remove local state.

See [setup and implementation notes](docs/S0_Setup.md) for versions, architecture, verification and limitations.
