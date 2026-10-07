# I3 physical iPhone checklist — core acceptance passed

**CORE I3 PHYSICAL ACCEPTANCE PASSED.** Acceptance recorded **7 October 2026, America/New_York**, from Owen's report on implementation **bc3f8bbad5cc528fb35432aa993184511ff646fd**, branch `feat/read-state`. Testing used the existing physical iPhone library through Expo Go/Metro, without resetting storage. This is Owen's supplied evidence, not an agent-operated phone run or independent device/wire inspection. Exact iOS/Expo Go versions were not freshly supplied.

Core migration, manual correction, automatic completion, restored-at-end safety, immediate-navigation settlement, offline local progress and I1/I2 regression paths passed physically. Conditional live-state/accessibility/failure cases remain unexercised where unavailable. See [I3 design and host evidence](I3_Read_State.md).

S0/S1/S2A remain accepted; I0/I1/I2 are accepted and merged in PR #4/#5/#6. I3 is not yet merged. **S2B remains deferred; full v0 is incomplete.** Historical acceptance and its qualifications are unchanged. Acceptance bookkeeping, validation, a separate acceptance commit/push and PR preparation against `main` are authorized. No merge, next product slice, deletion/library management, S2B or final Astra audit is authorized.

## A. v4 → v5 preservation — reported passed

- [x] Existing Library survived without reset: **Eyes Open 34/34 text**, **Normal Isn't Ordinary 25/25**, **Aenys 38/38** and **The Lantern Cartographer 3/3**.
- [x] Aenys local images remained intact. The Lantern Cartographer harbor remained intact and fixture-only.
- [x] Saved passages, font/theme preferences and I1 update timestamps survived.
- [x] Legacy entries appeared **Unread / not previously marked read**, with initial current unread counts **34 / 25 / 38 / 3**, respectively.
- [x] Opening Library/Contents started no source/update/image work.

Visible migration/preservation is physically passed. Exact field/rollback invariants remain host-SQLite evidence. The historical I2 Aenys **57 local / 1 omitted / 0 pending** inventory was not freshly enumerated by this I3 report; its one omission remains historically unlocated.

## B. Manual Read/Unread and persistence — reported passed

- [x] Aenys began at **38 unread**; chapter 1 showed **Unread / Mark Read**.
- [x] Mark Read changed it to **Read / Mark Unread**; Contents and Library showed **37 unread**.
- [x] Returning to Contents preserved the state. Mark Unread restored **Unread** and **38 unread**.
- [x] Force-quit Expo Go and relaunch through Metro preserved the final manual state/count.

## C. Automatic completion — reported passed

- [x] Opening an Unread downloaded chapter alone did not mark Read. Leaving before the end kept it Unread.
- [x] Reopening and genuinely scrolling/reading to the end marked Read. Contents showed Read and the current unread count dropped exactly once.

Opening/restoration does not imply Read; genuine trusted user interaction at the chapter end can mark Read. This is local reader/state evidence, not packet/network evidence. A genuine one-screen/no-scroll case was not separately supplied.

## D. Restored-at-end and layout safety — reported passed

- [x] Manually Mark Unread, reopen and restore near the bottom: restoration alone and waiting there did not mark Read.
- [x] Changing font/theme near the end and resulting reflow did not produce completion.
- [x] Only a fresh genuine user interaction at the end marked it Read again.

## E. Immediate navigation and restart — reported passed

- [x] Reach the end, then immediately tap **Next**: the completed chapter remained Read.
- [x] Reach the end, then immediately tap **Contents**: the completed chapter remained Read.
- [x] Normal **Previous / Next / Contents** navigation stayed within the story.
- [x] Force-quit/relaunch through Metro preserved committed Read state, passage, preferences and existing local images.

These establish the reported completion/write-settlement paths before navigation and relaunch. Immediate **Previous** at completion was not separately reported; the normal Previous pass does not establish that distinct sequence.

## F. Already-running offline progress — reported passed, not S2B

- [x] With Stowaway already running and networking disabled, manual Read/Unread correction worked and Contents/Library counts updated locally.
- [x] An Unread downloaded chapter became Read after genuine end interaction.
- [x] Local text and Aenys images remained readable; navigation and saved passage stayed usable.
- [x] No source request was required for read-state writes.

This is **not S2B**: no independent installation, Metro-free cold start or first launch in airplane mode is claimed. Visible offline behavior is not native wire inspection.

## G. Deliberate I1 regression — reported passed

- [x] After restoring networking, Owen deliberately ran **Check for Updates** with mixed Read/Unread state.
- [x] The unchanged COMPLETE check succeeded and preserved coherent flags/counts, text/images/passages, with no duplicate entries.

This physically confirms ordinary unchanged reconciliation preserves read-state identity. It does not establish natural new-entry, rename/reorder/removal/reappearance behavior or packet-level old-body request counts; deterministic tests retain those scopes.

## H. I2 regression — reported passed

- [x] Aenys local images rendered at expected positions and text/image counts remained coherent.
- [x] Read-state operations did not disturb image state.
- [x] Opening screens started no automatic image work.

No explicit Download/Retry Images sequence with mixed flags or active image-operation cancellation/settlement was separately supplied as an I3 physical pass.

## Conditional physical cases — NOT EXERCISED

These qualifications do **not** revoke core I3 acceptance. Deterministic host/bridge/UI tests remain their evidence.

- [ ] **Manual correction of a naturally pending/not-downloaded current entry.**
- [ ] **Manual correction of a naturally saved-unlisted downloaded chapter.**
- [ ] **Genuine one-screen/no-scroll chapter auto-completion.**
- [ ] **Natural new/inserted chapter starting Unread.**
- [ ] **Natural rename/reorder/removal/reappearance preserving the flag.**
- [ ] **Actual local storage-write failure for manual/automatic Read persistence.**
- [ ] **VoiceOver/large-text-specific read-state accessibility.**

Other original checklist edges were not separately supplied as new physical passes: repeated bottom gestures beyond the observed single count decrement; safe links/nested spoilers/text selection; background/reopen false-completion safety as a distinct sequence; image load/failure/geometry alone; manual/source/image ownership during active update/image cancellation and final refresh; saved-unlisted local-image reading/correction; and S1/S2A diagnostic isolation/v1 regression under I3. Existing historical and deterministic evidence remains separate. No unavailable live state was manufactured for acceptance. Native headers/cookies/cache and packet-level behavior remain uninspected. Global `PRAGMA foreign_key_check` performance and concurrent S1 diagnostic request-budget accounting remain deferred; prior image traffic is excluded by S1's per-run baseline.

## Demonstrated physical loop and future regression

Existing story → current entries begin with persistent Unread → manually correct Read/Unread → Library/Contents counts update → state survives restart → opening/restoring does not falsely complete → genuine user end interaction marks Read → completion survives immediate navigation → progress works offline → manual updates and local images preserve state.

Future reproduction is regression work, not unfinished core acceptance:

```powershell
git switch feat/read-state
npm.cmd start
```

Use the existing SDK 57 Expo Go/Metro setup and phone library. Preserve data: no uninstall, clear/reset/reseed, deliberate source mutation or corruption of normal files. Source actions remain deliberate within the selected personal scope; stop on blocked/login/challenge results without cookies/auth/proxy/bypass. Record metadata only, without prose/raw pages/image bytes/screenshots in Git. Existing historical I0/I1/I2 acceptance does not expand the I3 report's scope.

**CORE I3 PHYSICAL ACCEPTANCE PASSED.** PR preparation is authorized; no merge, deletion/library management, automatic source/image work, S2B, final Astra audit or next product slice follows from acceptance.

## Post-acceptance recovery fix — physical regression not performed

PR #7's adversarial review found failed automatic Read completion could be forgotten when Retry/Reopen or WebView termination replaced the reader session. The first correction (`0b819d5`) retained intent already pending before recovery; a second targeted Ultra verification proved it still lost completion accepted during the final locator wait. The second correction gives accepted intent an owner outside the keyed reader, drains it at the replacement decision, and freezes fresh reader input while continuing to accept queued messages. Failures retain actionable state and restore interaction on the retained live renderer. Read/locator persistence remains independent, and recovery needs no additional end interaction. Deterministic actual Reader/ChapterReader tests with real host SQLite rollback/recovery establish these paths; **no new physical failure/recovery pass is recorded**. Historical core acceptance and all seven conditional qualifications above remain intact.

Focused physical regression is useful, but forcing storage failure or WKWebView process termination is not an ordinary Expo Go control. No fault-injection UI or normal-library corruption/reset is added. Keep injected failures in synthetic tests; do not fill storage, delete/corrupt good files or reset the library to manufacture them.

- [ ] **Practical local reader regression:** use the existing phone library through the usual Expo Go/Metro setup; confirm opening/restoration still does not mark Unread chapters Read, genuine end interaction does, and immediate Next/Contents preserves progress with usable passages, preferences and Aenys local images. Source actions are unnecessary.
- [ ] **Retry after a naturally occurring local Read-save error, if available:** retain the reported error/state; Retry while storage is still unavailable must not silently reopen/forget completion. After recovery, Retry should save Read and reopen without requiring another end interaction, preserving the saved passage. Otherwise retain host-tested/unexercised status.
- [ ] **Actual WKWebView termination recovery, if safely observable:** confirm already-accepted pending completion survives renderer recovery and later saves without another end interaction. Failure must remain actionable. Native process termination was not induced by the automated UI handler test; record unavailable cases as unexercised.
- [ ] **Interaction during naturally occurring slow/failed recovery, if available:** Retry must freeze fresh reader input while saving, retain a legitimate completion already queued before that freeze, and restore normal reading interaction if recovery fails. A later Retry must save retained completion without another end interaction. The exact late-intent/final-locator-wait ordering is host-tested; no physical pass is implied when this timing is unavailable.

These are focused follow-up checks, not a revocation of unrelated acceptance or a bundled offline cold-start/S2B claim. PR #7 must remain unmerged. No deletion, automatic source/image job, next product slice or final Astra audit is included.
