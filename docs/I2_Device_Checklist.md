# I2 source images: physical iPhone checklist — core acceptance passed

**CORE I2 PHYSICAL ACCEPTANCE PASSED.** Acceptance recorded **6 October 2026, America/New_York**, from Owen's supplied physical-iPhone report on `feat/source-images`, after implementation/fix **fcd53badc5cf508e3adcca19832f04ffdf8a9caf**. Testing used the existing normal phone library through Expo Go/Metro. This is Owen's reported evidence, not an agent-operated phone run or independent device/wire inspection. Exact iOS/Expo Go versions were not freshly confirmed.

Real same-origin SpaceBattles images were downloaded, validated, persisted, rendered locally and regenerated while network-disabled on the already-running Expo Go project. Conditional cancellation/destructive/rare live cases remain physically unexercised and retain deterministic/separate S2A evidence. S0/S1/S2A/I0/I1 remain accepted; I0/I1 are merged in PR #4/#5. **S2B remains deferred; full v0 is incomplete. No merge or next product slice is authorized.** See [implementation, maintenance history and validation](I2_Source_Images.md).

Historical acceptance below applies to the tested implementation/fix above. The five-finding post-acceptance correction is described at the end of this checklist; **focused post-fix physical regression remains pending**.

## A. v3 → v4 migration and preservation — reported passed

- [x] Existing normal Library survived without reset: **Eyes Open (Pokemon Fanfic) 34/34**, **Normal Isn't Ordinary [Pokemon SI] 25/25**, **The Lantern Cartographer 3/3**.
- [x] Existing saved passages, font/theme preferences and I1 update timestamps remained usable/intact.
- [x] The synthetic harbor image remained confined to the fixture; existing real stories did not gain it.
- [x] S1/S2A remained separate development diagnostics.
- [x] Opening Library/Story did not start image discovery/download automatically.

This records visible physical preservation and deliberate-only image work. Host-SQLite migration tests separately establish field/rollback invariants.

## B. Legacy zero-image discovery — reported passed

- [x] Eyes Open began with **34 text chapters not scanned**; deliberate Download Images completed with **Images: no source images**, still **34/34 text**.
- [x] Normal Isn't Ordinary began with **25 text chapters not scanned**; deliberate Download Images completed with **Images: no source images**, still **25/25 text** and intact I1 timestamps.

This is a physical legacy scan pass. Saved-text/version/hash/block/link compatibility and request behavior are implementation/automated evidence; the phone UI is not packet-level proof that every historical body was untouched.

## C. First real image-bearing import and MIME failure — reported evidence

Story: **[ASOIAF SI] Aenys, King of Dreams**, author **Kingofwinter**.

- [x] Imported successfully at **38/38 text chapters**, with **58 source-image slots**.
- [x] Before the MIME fix, the observed state was **0 local / 50 omitted / 8 pending**. The eight pending downloads became `content-type-mismatch` omissions, leaving **0 local / 58 omitted / 0 pending**.
- [x] At that failure stage, prose remained readable and explicit omission placeholders appeared.

This exposed interoperability failure without reported data loss. The initial 50 omission reasons were not supplied; do not infer they were external/permanent failures.

## I. Aenys MIME compatibility retest

The retest is complete.

**REAL SPACEBATTLES IMAGE DOWNLOAD + LOCAL RENDERING PASSED.**

**I2 MIME INTEROPERABILITY FIX PHYSICALLY CONFIRMED.**

- [x] After **fcd53badc5cf508e3adcca19832f04ffdf8a9caf**, Owen retained the existing Aenys library and deliberately used **Retry Images**.
- [x] Final observed state was **57 local / 1 omitted / 0 pending**, with **38/38 text chapters**.
- [x] Real locally stored images visibly rendered between surrounding prose at expected chapter positions, including **Chapter 2 A Funeral and War Against The Seas** and **Overview of the State in 37 A.C**.
- [x] No synthetic harbor image leaked into Aenys.
- [x] Development diagnostics showed examples of **received image/jpeg / detected png / validated**, physically confirming safe raster-label disagreement and byte-authoritative acceptance.

The earlier eight-only retest expectation is superseded by the actual **57/1/0** result. Retry considers all stored `content-type-mismatch` omissions, not a fixed set of eight; this report does not reconstruct the reasons for every initial omission. The one final omitted slot was not visually located and its reason is not asserted. Diagnostics are bounded metadata, not retained response headers/image bytes or packet capture.

## D. Already-running offline local regeneration — reported passed

**LOCAL SOURCE IMAGE + TEXT REGENERATION WITHOUT NETWORK PASSED.**

- [x] After local images were accepted, Owen left the reader normally and disabled phone networking while the Expo Go project remained running.
- [x] Reopening image-bearing chapters still rendered real local images and surrounding downloaded prose; at least **two image-bearing chapter views** were physically observed after this offline step.
- [x] Reader navigation remained usable.

This is **NOT S2B**: no independent installation, Metro-free cold start or first launch in airplane mode is claimed. Visible local regeneration is distinct from wire-level inspection.

## E. I1 update after images — reported passed

- [x] With networking restored, Owen deliberately ran **Check for Updates** on Aenys.
- [x] Result was **Check finished. / Up to date.**, with **38/38 text** and **57 local · 1 omitted · 0 pending** retained.
- [x] Attempt/complete-check timestamps advanced normally, approximately **10/6/2026, 9:09:56 PM** and **9:10:02 PM** as displayed.

This establishes continued manual-update behavior and preservation of visible persisted image state. It does not establish packet-level zero image/body requests; deterministic injected-transport tests establish intended request behavior. Displayed times are sequence evidence, not audited wire timing.

## F. Normal reader regression — reported passed

- [x] Real-story text remained readable and local image placement was correct.
- [x] Saved passage behavior and font-size/theme controls remained usable.
- [x] Previous / Next and Contents / Library worked normally.

Exact pixel restoration across changed image geometry is not promised. Selection, nested spoilers, safe links, VoiceOver and image-operation native-control/settlement sequences were not separately supplied as new I2 physical passes; existing historical and automated evidence keeps its own scope.

## Conditional physical cases — NOT EXERCISED

These qualifications do **not** revoke core I2 acceptance.

- [ ] **I2 image cancellation / force-quit / relaunch / explicit retry:** the successful Aenys retry was allowed to complete to establish the first real-image case. Deterministic tests cover cancellation/retry/settlement; S2A's separate synthetic file/DB interruption evidence is not an I2 normal-library kill test.
- [ ] **Natural visible placeholder for the single final Aenys omission:** Owen quickly checked every chapter but did not locate it. A count of one omission is not a visible-placeholder pass. The pre-fix MIME-failure placeholders in section C were separately observed.
- [ ] **Missing/corrupt normal-library source-image recovery:** not physically exercised. I2 has no destructive normal-library diagnostic; host tests cover this. Historical S2A missing/corrupt bundled-raster recovery remains separate.
- [ ] **Saved-unlisted chapter retaining source images:** no naturally suitable case was available.
- [ ] **Naturally new I1 chapter with same-body I2 image extraction:** not physically exercised.

Saved-text mismatch, natural rename/reorder/removal/reappearance and any other unreported live edge remain automated/conditional evidence, not fabricated physical passes. Native headers/cookies/cache, request timing and packet-level missing-only traffic remain uninspected. Global `PRAGMA foreign_key_check` performance and concurrent S1 diagnostic request-budget accounting remain deferred; prior image traffic is already excluded by S1's per-run baseline.

## Demonstrated physical loop and future regression

Existing or newly imported story → deliberate discovery → eligible slots → download source bytes → validate raster structure/dimensions/budgets → persist generated local file/reference → local image at the expected chapter position → leave/reopen → text + image from local state without network → preserve ordinary manual-update behavior.

Future reproduction is regression work, not unfinished core acceptance:

```powershell
git switch feat/source-images
npm.cmd start
```

Use the existing normal phone library and usual SDK 57 Expo Go/Metro setup. Preserve data; do not uninstall/clear/reset/reseed, fabricate mutations or corrupt normal files. Source actions remain deliberate, unauthenticated and personal; stop on blocked/login/challenge results with no cookies, proxy or bypass. Record metadata only, never prose/raw pages/image bytes/screenshots. A legacy scan can fetch current source bodies; ordinary Check for Updates does not perform that scan.

**CORE I2 PHYSICAL ACCEPTANCE PASSED.** Acceptance bookkeeping, validation, a separate commit/push and PR preparation against `main` are authorized. No merge, read/unread, deletion, new image feature, automatic/background image work or S2B work follows from this acceptance; the next product slice remains unauthorized.

## Post-fix physical regression — PENDING

PR #6's adversarial review found replacement-token rendering expansion, rejected historical-repair reference loss, per-chunk memory amplification, encoded utility-route bypass and legal empty-IDAT rejection. All five are corrected by the targeted follow-up. Original core acceptance above is retained; **no new physical pass is recorded**. Deterministic host tests establish the hostile-alt, failed-repair and URL/parser cases, not iPhone/native-wire evidence.

Use the updated branch with the existing SDK 57 Expo Go/Metro setup. Preserve the normal library: no uninstall, reset, reseed, file corruption or deletion of good references.

- [ ] **Existing Aenys local rendering:** confirm **38/38 text** and the prior **57 local / 1 omitted / 0 pending** baseline, open the two previously observed image-bearing chapters, and verify inline images, readable prose, saved-passage restoration, font/theme and Previous/Next/Contents/Library. Leave normally and reopen; record any changed counts or failure message rather than treating a reference count as file-integrity proof.
- [ ] **Explicit reference reuse:** use Retry Images on existing Aenys. Good local files should be reused, counts retained and no failed-repair message shown. This tests ordinary reuse; it does not simulate a transient local read failure or prove zero network traffic from UI observation. The one existing omission's reason remains unasserted.
- [ ] **Already-running offline regeneration:** leave the reader normally, disable networking while the Expo Go project stays running, and reopen at least two image-bearing views. Confirm local images/prose, navigation and saved-passage restoration; no Metro-free cold-start/S2B claim follows.
- [ ] **Actual native stream/cancel/settle/retry:** use a deliberately selected authorized image-bearing story with genuinely pending/retryable images. Start Download/Retry Images, cancel while image downloads are still in progress, and verify controls/gestures remain blocked until settlement. Record retained local/omitted/pending and text counts. Retry explicitly and verify completed local images are retained, pending work progresses and rendering succeeds. If practical, force-quit after settlement, relaunch without automatic image work and retry explicitly. Stop on blocked/login/challenge results. Do not claim a streaming pass if the operation only reuses already-local files.
- [ ] **Post-operation I1/reader regression:** run a deliberate ordinary Check for Updates and confirm text/image counts, saved passages and reader navigation remain coherent.

**A fresh image-bearing story is needed only if no existing authorized story has actual pending/retryable images.** Aenys with all good 57 local references cannot exercise the changed body reader merely by retrying. Do not clear its files to force downloads. Destructive historical-reference fault injection and hostile-alt/empty-IDAT cases remain deterministic fixture evidence; report native observations separately if suitable synthetic cases become available. No hostile-alt/native-stream/reference-repair physical evidence is claimed by this fix pass. PR #6 must remain open and unmerged.
