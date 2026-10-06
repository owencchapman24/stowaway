# Stowaway

Current milestone: **I1 — Manual Updates + Safe Reconciliation implementation candidate; physical acceptance pending Owen.** I0 is accepted and merged in PR #4. Owen explicitly chose I1, replacing the old I0 guard against manual updates. See [I1 design and validation](docs/I1_Manual_Updates.md) and [the pending physical checklist](docs/I1_Device_Checklist.md). **S0, S1, S2A and I0 are accepted; S2B remains deferred; full v0 is incomplete.** Source images remain inert placeholders.

An offline iPhone reader prototype. **Core S0, core S1, core S2A and core I0 physical acceptance passed**, as reported by Owen. The final tested Library held Eyes Open **34/34**, Normal Isn't Ordinary **25/25** and The Lantern Cartographer **3/3**, without duplicate real stories. Story contents and Previous/Next stay within one story. S1/S2A diagnostics remain separate under Development diagnostics. S2A still uses its exact isolated database/directory; inspect before initializing or retrying.

The [October audit](docs/Stowaway_October_2026_Groundwork_Audit.md) controls implementation. September reports in `docs/research/` are background. [I0 import and physical evidence](docs/I0_Real_Story_Import.md) remains historical acceptance, including real text/positions and v1 → v2 fixture preservation. I1 adds deliberate **Check for Updates** on an imported story: retrieve a COMPLETE current primary manifest, reconcile stable post IDs, refresh titles/order, preserve locally saved removed chapters and download only current missing text. An incomplete/failed check keeps the previous manifest; old bodies are never automatically checked for edits. Re-importing an existing story still only resumes pending work. Download counts and explicit resumability come from SQLite, with **no automatic requests or downloads on opening Library/Story**. **S2A accepted; S2B deferred/pending.** Expo Go/Metro does not prove an independent install, Metro-free cold start or first launch in airplane mode; [S2A evidence](docs/S2A_Device_Checklist.md) and [deferred S2B notes](docs/S2A_Persistence_Recovery.md) retain their historical status.

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

For S1, open **S1 diagnostic (dev only)** under Library's Development diagnostics, paste a selected public thread URL and tap **Run S1 diagnostic**. S1 results stay in memory and do not import a story. Owen's reported A/B/C acceptance remains recorded in [S1 evidence](docs/S1_Access_Spike.md). I0/I1 reuse the same public-path checks, serial request queue, at least two-second spacing, omitted credentials and bounded retries/Retry-After policy. The [historical policy review](docs/S1_Source_Policy.md) plus Owen's explicit I0/I1 scope authorize personal selected-story text persistence and manual checks; they establish no public/commercial, App Store or republication authorization. Native wire-level inspection remains unperformed. Stop on blocked/login/challenge results. Automated tests and CI make zero live SpaceBattles requests.

Normal storage migrates to v3 without resetting the existing library. Contents shows current **Primary Threadmarks** and, when downloaded removed entries exist, **Saved chapters no longer listed**. Saved entries remain readable with their locator; Previous/Next is disabled for an unlisted chapter. Current Library counts exclude unlisted entries. Cancel/background/leave retains the last completed transaction; reopen and use **Resume Download** explicitly for current pending chapters. Last attempt and last successful COMPLETE check are stored separately. S2A keeps its isolated v1 database and is not migrated/repaired automatically.

No read/unread, deletion, source images, extra categories/sites, automatic/scheduled checks or S2B work is included. Global FK validation performance and S1 diagnostic budget accounting under concurrent source traffic remain known deferred follow-ups. No I1 PR is created before Owen's physical acceptance.
