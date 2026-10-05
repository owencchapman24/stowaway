# Stowaway

Current milestone: **I0 — persistent SpaceBattles story import and offline text reading; physical acceptance pending.** Add a selected public thread, save its COMPLETE primary Threadmarks manifest, foreground-download chapter text, cancel/resume missing chapters after relaunch and read local text in the existing reader. See [implementation and validation](docs/I0_Real_Story_Import.md) and [exact iPhone acceptance steps](docs/I0_Device_Checklist.md). **Text downloaded/offline. Source images are not downloaded in I0.** Updates and additional categories remain deferred.

An offline iPhone reader prototype. **Core S0, core S1 and core S2A physical acceptance passed**, as reported by Owen. The original three-chapter synthetic story remains in the Library with its image, position and preferences; the non-destructive v1 → v2 migration adds manifest metadata. Story contents and Previous/Next stay within one story. S1/S2A diagnostics remain separate under Development diagnostics. S2A still uses its exact isolated database/directory; inspect before initializing or retrying.

The [October audit](docs/Stowaway_October_2026_Groundwork_Audit.md) controls implementation. September reports in `docs/research/` are background. I0 is initial text import only. Download counts and resumability come from persistent SQLite, with no automatic downloads on opening the app/screens. **S2A accepted; S2B deferred/pending.** Expo Go/Metro does not prove an independent install, Metro-free cold start or first launch in airplane mode; [S2A evidence](docs/S2A_Device_Checklist.md) and [deferred S2B notes](docs/S2A_Persistence_Recovery.md) retain their historical status.

Install or update **Expo Go from the iPhone App Store**. As of 4 October 2026, SDK 57 is the current Expo Go SDK: Expo's [3 September update](https://expo.dev/changelog/expo-go-57-login) confirms iOS support and requires the same Expo account in Expo CLI and Expo Go. Sign in to that account in the app. **Apple Developer membership, TestFlight and `eas go` are not required** to run this SDK 57 project through the current App Store Expo Go.

Use Node 22 LTS (>=22.13) or 24 LTS (>=24.3), npm, and Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd run check
npx.cmd expo login
npm.cmd start
```

Sign Expo CLI and Expo Go into the same Expo account, put Windows and the iPhone on the same Wi-Fi, allow Node through Windows Firewall on your private network, and scan the terminal QR with the iPhone Camera. Allow local-network access on the phone. No local Xcode is needed for Metro/Expo Go development.

The commands above run Stowaway in the current App Store Expo Go. Select a chapter, scroll, expand both spoilers, change the text size/theme, return to contents, and reopen. **Owen reports core S0 physical reader acceptance passed on his iPhone on 5 October 2026**, including same-passage font-change/resume, force-quit/reopen with Metro and already-open reading after network loss. The [device checklist](docs/S0_Device_Checklist.md) records the precise passes and remaining unverified checks, including VoiceOver and direct WebView script/network diagnostics. Expo Go's Metro connection is not proof of bundled airplane-mode cold start (deferred S2B).

`npm run typecheck`, `npm run lint`, and `npm test` can run separately. Tests use real host SQLite via Node's `node:sqlite` as well as `jest-expo`; mocked native APIs cannot prove iOS SQLite/WKWebView behavior. Only the active chapter body is read. The database is seeded with conflict-safe inserts, never deleted/reset on startup. Uninstalling Expo Go or clearing its app data can remove local state.

See [setup and implementation notes](docs/S0_Setup.md) for versions, architecture, verification and limitations.

For S1, open **S1 diagnostic (dev only)** under Library's Development diagnostics, paste a selected public thread URL and tap **Run S1 diagnostic**. S1 results stay in memory and do not import a story. Owen's reported A/B/C acceptance remains recorded in [S1 evidence](docs/S1_Access_Spike.md). I0 reuses the same public-path checks, serial request queue, at least two-second spacing, omitted credentials and bounded retries/Retry-After policy. The [historical policy review](docs/S1_Source_Policy.md) plus Owen's explicit I0 scope authorize personal selected-story text persistence; they establish no public/commercial, App Store or republication authorization. Native wire-level inspection remains unperformed. Stop on blocked/login/challenge results. Automated tests and CI make zero live SpaceBattles requests.
