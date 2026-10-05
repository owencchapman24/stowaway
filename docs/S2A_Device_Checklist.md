# S2A physical iPhone checklist — pending

**No physical S2A result has been reported.** This checklist uses Expo Go and Metro to test local recovery. It does not test S2B standalone installation/offline cold start. Device previously reported: iPhone 17 Pro; record the actual iOS version and Expo Go version when testing. The earlier approximate iOS value is not verified.

## Start on Windows and preserve a normal-library baseline

```powershell
cd C:\Users\ocac0\Documents\GitHub\stowaway
git switch feat/persistence-recovery-spike
npm.cmd ci
npx.cmd expo login
npm.cmd start
```

Use the current App Store Expo Go supporting SDK 57. Sign CLI and Expo Go into the same Expo account. Keep Windows and iPhone on the same Wi-Fi, allow Node through Windows Firewall on the private network, allow Expo Go local-network access, then scan the terminal QR with the iPhone Camera. No Apple Developer membership, Xcode, EAS project or build is required for S2A. Do not uninstall Expo Go or clear its app data.

Before diagnostics, open normal Contents: confirm the original synthetic story has three chapters. Save/remember a recognizable normal passage, expanded spoilers and chosen font/theme, then return to Contents. Record these as the isolation baseline. Do not run S1 or paste a SpaceBattles URL during S2A.

Tap **S2A recovery diagnostic (dev only)**. Opening it performs no S2A persistence action. Tap **Inspect persisted S2A state (no repair)** first on every relaunch. Never initialize/reset/retry first: that could hide a recovery failure. If no S2A DB exists, tap **Initialize disposable S2A fixture**. If deliberately restarting an existing experiment, inspect and record it first, then tap **Reset S2A test data only** and its **CONFIRM** button, then initialize.

Record revision A/hash, 1 story / 3 chapters / 1 asset, locator and valid image/reference. Default test settings are dark/22 and a nonzero baseline locator. Tap **Read/regenerate S2A chapter**, pick a memorable passage (the nested copper-cup spoiler is useful), change font/theme if desired, then tap **Contents** in that reader to return to diagnostics. It returns to S2A, not normal Contents. Inspect and record the saved locator/settings before each interruption.

## Text: exceptions, real kill and retry

- [ ] **Inject JS failure before write**: inspect. Revision/hash/locator must be unchanged.
- [ ] **Inject JS failure between SQL writes**: inspect. All committed content and locator must be unchanged; no partially updated metadata. These are caught exceptions/rollback tests, not process kills.
- [ ] **Close/reopen normally (not a kill)**: old committed state remains. This is a normal close/reopen test only.
- [ ] **Arm real force-quit before commit**. Wait for the pinned yellow **READY TO FORCE-QUIT BEFORE COMMIT** banner. If that exact banner never appears, report failure; do not describe the run as a checkpoint kill.
- [ ] Without pressing a release button, open the iOS app switcher (swipe up from the bottom and pause), then swipe **Expo Go** up/off the screen. Backgrounding alone is not force-quit. Do not reload, Fast Refresh or change code while armed.
- [ ] Relaunch Stowaway through Expo Go/Metro, enter S2A and **inspect before repair/retry/reset/initialization**. Record boundary marker, revision/hash, locator and counts. The last committed revision A and saved locator should survive; the marker should describe the armed checkpoint. Read S2A again to verify the same passage/spoilers/settings remain. Do not modify the text before recording the result.
- [ ] Tap **Commit/retry revision B**, then inspect. Revision B/new hash appears, with 1 story / 3 chapters / 1 asset. Repeating this retry creates no duplicate logical rows.
- [ ] Before any new reading gesture, the old locator still has revision A's hash. Read revision B: the existing reader should use progression fallback, not claim exact passage matching across changed content. Reading there can then save a valid revision-B locator.
- [ ] Return to diagnostic, inspect committed revision B/locator, force-quit after the operation says **Text commit completed: revision B**, relaunch and inspect first. Revision B and the last completed locator remain. This is a separate **after-commit** kill.

The optional release buttons test JS commit/rollback without killing. Record them separately if used. A boundary marker is a hint, not the authority: actual committed DB fields matter if a kill occurs between commit and marker write.

## Images: validation, orphan, kill, retry and degraded text

Keep a valid referenced S2A image initially. Use only S2A controls.

- [ ] **Inject partial/corrupt staged file**: rejected. Active reference stays unchanged/valid; an unreferenced corrupt file may remain. This simulates truncated bytes, not an iOS mid-syscall kill.
- [ ] **Stage valid image; fail DB reference**: an exception is reported; old reference stays valid, new completed file is unreferenced, text/hash/locator stay intact. Normal close/reopen must not promote it.
- [ ] **Arm force-quit after validated staging**: wait for **READY TO FORCE-QUIT: VALIDATED IMAGE, BEFORE DB REFERENCE**. Force-quit Expo Go without release. Relaunch through Metro, open diagnostics and inspect first. Old image reference remains active/valid; the completed new file remains unreferenced. This kill is after completed/validated staging, not mid-write.
- [ ] **Commit/retry fresh validated image**: valid new reference; exactly one logical asset row. Repeating is safe; text/locator remain unchanged.
- [ ] **Clean eligible S2A orphan files**: only unreferenced test images are removed. Current referenced image remains valid. Cleanup/reset controls are disabled while a checkpoint is held.
- [ ] **Remove referenced S2A image**, inspect before repair, then read/regenerate S2A: text remains readable with **[Local image unavailable: …]**, passage/settings remain. Reopen/inspect must not autoheal the image.
- [ ] **Commit/retry fresh validated image** repairs only on this explicit action. Confirm valid image/reference. Then **Corrupt referenced S2A image**, inspect and read/regenerate: same degraded readable-text behavior. Explicitly retry to return to a valid image.

## Disposable render recovery

- [ ] With a valid image, read S2A, save a recognizable passage and chosen font/theme, and return via the reader's **Contents** button. S2A deliberately retains its disposable render files for this experiment.
- [ ] Inspect/record hash and locator. Tap **Remove disposable S2A render directories**. It should report at least one removed session after reading. Canonical chapter/locator/preferences/reference must stay intact.
- [ ] To demonstrate regeneration needs no network, keep this Expo Go session alive, turn off Wi-Fi/cellular without relaunching, and tap **Read/regenerate S2A chapter**. Text and accepted local image should render with the saved passage/spoilers/settings. Do not tap the safe external link. If Expo Go itself disconnects, record that limitation; do not count an unperformed regeneration as passed. Re-enable the network to use Metro again.
- [ ] Repeat removal/regeneration with a deliberately missing S2A referenced image: text remains readable and the placeholder appears. Explicit image retry restores it when desired.

The already-running offline regeneration check is S2A only; it does not prove independent offline cold start.

## Isolation and result to send Owen/Codex

- [ ] Return to **Normal Contents** after all experiments. Original synthetic story still has exactly three chapters, remembered normal passage/spoilers/font/theme remain, and no real SpaceBattles story appears.
- [ ] S1 remains a separate development diagnostic; do not run live requests as part of this checklist.
- [ ] Optionally inspect, then confirm **Reset S2A test data only** and inspect again: S2A is absent and requires explicit initialization. Recheck the normal-library baseline afterward.

Report actual iOS/Expo Go versions, each checkbox pass/fail, text before/after hashes and locator comparison, row counts, image reference/validity/unreferenced count, cleanup/render results and normal-library isolation. Distinguish injected exception, normal reopen, **real before-commit kill**, **real image checkpoint kill**, and **after-completed-commit kill**. Include any banner that failed to appear and the exact error. Screenshots are optional; concise observations are enough.

All boxes remain **pending** until Owen reports them. S2B has no evidence here and remains deferred. Prior unrelated S0/S1 limitations retain their recorded status.
