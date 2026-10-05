# S2A physical iPhone checklist — core acceptance passed

**CORE S2A PHYSICAL ACCEPTANCE PASSED.** Acceptance recorded **5 October 2026, America/New_York**, from Owen's supplied physical-iPhone report for implementation **2a99356** on `feat/persistence-recovery-spike`. Testing used Expo Go and Metro with synthetic/disposable S2A data only. The previously reported device is an iPhone 17 Pro; **exact iOS and Expo Go versions remain unconfirmed**. These are Owen's user-reported results, not an agent-operated phone run or independent device inspection.

**S2A accepted; S2B deferred/pending.** This does not prove independently installed Stowaway, Metro-free cold start or first launch in airplane mode. Real-story importing has not begun. Unrelated pending S0/S1 checks retain their existing status.

## Baseline — reported passed

- [x] Disposable S2A fixture initialized as revision A, **1 story / 3 chapters / 1 asset**, valid image, saved locator, matching content hash and **dark/22** baseline preferences.
- [x] Owen saved a recognizable reading position before interruption testing.

## Text transactions — reported passed

- [x] **Injected JS failure before write:** revision A/hash/locator unchanged, counts 1/3/1 and image valid.
- [x] **Injected JS failure between SQL writes:** complete rollback, no partial metadata update, revision A/hash/locator intact and counts 1/3/1.
- [x] **Real process kill before commit:** exact **READY TO FORCE-QUIT BEFORE COMMIT** banner reached; Owen swiped Expo Go away from the iOS app switcher. After relaunch, inspection **before repair/retry/reset** retained committed A, previous hash/locator, counts 1/3/1 and valid image. No partial B appeared.
- [x] **Explicit retry/commit revision B:** B committed with a new hash, counts 1/3/1 and no duplicate logical rows.
- [x] **Versioned locator handling:** old A locator hash no longer matched B; diagnostic correctly reported progression fallback only, without claiming an exact passage match. Reading B saved a new matching B locator.
- [x] **Real process kill after successful B commit:** force-quit/relaunch preserved B, its valid new locator, counts 1/3/1 and valid image.

Injected exceptions, real before-commit process death and real after-completed-commit process death are separate evidence. A caught exception or optional JS checkpoint-release control is not a process-kill test.

## Images/files — reported passed

- [x] **Injected partial/corrupt stage:** rejected; active reference unchanged/valid, canonical text/hash/locator intact, with only an unreferenced test file left. This is truncated-byte injection, not proof of an iOS mid-syscall kill.
- [x] **Valid staged file + injected DB reference failure:** new file completed but remained orphaned; old active reference valid, no duplicate logical asset row and text/locator intact.
- [x] **Real process kill after validated staging, before DB reference:** exact **READY TO FORCE-QUIT: VALIDATED IMAGE, BEFORE DB REFERENCE** banner reached, then Expo Go force-quit. Relaunch inspection **before repair/retry** retained the old active valid reference, new completed unreferenced image, intact B, valid locator and counts 1/3/1.
- [x] **Fresh validated image commit/retry:** explicit retry committed a valid new reference; logical asset count remained exactly 1, repeats safe, prior files became filesystem orphans only.
- [x] **Orphan cleanup:** only eligible unreferenced S2A files removed; active image remained valid, orphan count returned to 0, counts 1/3/1 and B/locator intact.
- [x] **Missing referenced image:** diagnostic reported missing; DB/story/chapter/locator intact; reader opened with readable text and **[Local image unavailable: ...]**. No automatic destructive repair; explicit retry restored a valid image.
- [x] **Corrupt referenced image:** diagnostic reported corrupt; reader remained usable with readable text/placeholder; explicit retry restored a valid image.

## Disposable render recovery — reported passed

- [x] Owen opened/read S2A and saved a recognizable passage/preferences, then removed disposable render directories; the diagnostic reported removal.
- [x] Canonical revision B/hash/locator/image state remained intact.
- [x] Reopening/regeneration rebuilt the reader from canonical local SQLite/filesystem state, preserved usable passage/preferences and required **no source request**.

The optional already-running network-disabled regeneration check was not separately supplied. No independent offline cold launch is inferred from this regeneration result.

## Normal-library isolation — reported passed

- [x] After all destructive S2A experiments, Normal Contents still held **The Lantern Cartographer** and exactly **three normal synthetic chapters**.
- [x] Existing normal reading progress and settings were preserved.
- [x] S1 remained separate/development-only; no real SpaceBattles story appeared.
- [x] Destructive S2A state stayed isolated from normal storage.

On Owen's physical iPhone, Stowaway preserved last committed text/reading state through failed/incomplete transactions and real process kills, separated image staging from authoritative DB references, safely degraded missing/corrupt images, cleaned unreferenced test files without touching active content and regenerated disposable reader files from canonical local state.

## Not separately reported / deferred

- [ ] Confirm actual iOS and Expo Go versions.
- [ ] Optional **Close/reopen normally (not a kill)** control on the phone. Host close/reopen integration evidence exists; this separate manual control was not specified in Owen's supplied report.
- [ ] Optional regeneration with Wi-Fi/cellular explicitly disabled in an already-running Expo Go session. No source request was required, but network-disabled conditions were not separately supplied.
- [ ] Combined repeat of render-directory deletion/regeneration with a deliberately missing referenced image. Missing-image readability and render regeneration passed separately; this combined repeat was not separately supplied.
- [ ] Optional explicit S2A reset followed by another normal-library baseline comparison. Normal-library isolation after the reported destructive experiments passed; this particular optional sequence was not separately supplied.
- [ ] **Deferred S2B:** independently installed Stowaway with bundled JS/assets, no Expo Go/Metro, phone offline, successful cold launch and passage/preferences/images surviving offline force-quit/relaunch.

These unreported optional checks do not revoke core S2A acceptance and are not documented as passes. Previous S0 VoiceOver/direct WebView script/network checks and S1 wire-level checks remain at their recorded status. Hardware power-loss durability and killing an image write mid-syscall are not established here.

## Repeating the regression diagnostic

The development-only S2A diagnostic remains available for review/merge and regression work. See [implementation boundaries and isolation rules](S2A_Persistence_Recovery.md).

```powershell
cd C:\Users\ocac0\Documents\GitHub\stowaway
git switch feat/persistence-recovery-spike
npm.cmd ci
npx.cmd expo login
npm.cmd start
```

Use the current SDK 57 App Store Expo Go, logged into the same Expo account as CLI, with Metro available. Keep Windows/iPhone on the same Wi-Fi, allow Node through the private-network firewall, allow Expo Go local-network access and scan the terminal QR. No EAS/Apple build/signing or paid membership is required for this diagnostic.

Record the normal-library passage/settings before destructive experiments. From Contents open **S2A recovery diagnostic (dev only)** and **inspect before initialization, repair, retry or reset**, especially after every relaunch. Initialize only absent test data; restarting an experiment requires explicit two-action **Reset S2A test data only** after inspection. Read/save a passage through **Read/regenerate S2A chapter** and return via its **Contents** button.

For each real kill, wait for the exact READY banner, swipe Expo Go away in the iOS app switcher without pressing a release button, relaunch through Metro and inspect first. Backgrounding, reload/Fast Refresh, JS rollback and normal close/reopen are not substitute kills. Do not edit code while armed. Use the explicit image/retry/cleanup/render controls only against disposable S2A resources; compare normal Contents afterward.

**S2A accepted; S2B deferred/pending. No PR merge, importer work or installation/signing workflow follows automatically from this acceptance.**
