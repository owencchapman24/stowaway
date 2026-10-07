# I4 iPhone acceptance record

**CORE I4 PHYSICAL ACCEPTANCE PASSED**, as reported by Owen, on implementation **a06b181879478a159c13c36ee15e5bd45fe92acb**, branch `feat/library-management`, based on merged I3 main `beb9bab8513053c84bb01b05747529a4b63e2ab9` (PR #7). Recorded **7 October 2026, America/New_York**; exact physical run time, iPhone/iOS/Expo Go versions and the selected removal story's name were not supplied. This is Owen's report through Expo Go/Metro, not an agent device run, filesystem inspection or native-wire measurement. No prose/captures/image bytes accompany this record.

## Reported physical passes

1. **A — v5 → v6 migration/preservation: PASS.** Existing iPhone storage opened without reset. Imported stories/counts, Aenys text/local images, The Lantern Cartographer and harbor image, Read/Unread flags and totals, saved passages/restoration, font/theme and attempt/success history survived. Opening Library/Contents started no source/image work. Host rollback tests remain separate evidence.

2. **B — destructive confirmations/cancel: PASS.** Remove Downloads was separated under management; its native dialog distinguished content removal from full story removal. Cancel left state unchanged. Remove Story explained stronger deletion semantics; Owen reached and cancelled the second destructive confirmation. Text/images/counts/Read state/passage/history remained intact. VoiceOver was not exercised.

3. **C — Remove Downloads: PASS.** Deliberate confirmation kept the story in Library with zero current downloaded text, intact total Threadmarks/unread count/Read flags/update history, Not downloaded and unreadable entries, and explicit Resume Download. Image status stopped claiming removed body images; Library was coherent. Force-quit/relaunch through Expo Go/Metro retained metadata/flags/zero downloads. Repeating removal was harmless. Retained shells/body availability are physically demonstrated at the application level, without forensic or filesystem verification.

4. **D — explicit Resume/redownload: PASS.** After restoring networking, deliberate Resume restored expected current text availability and normal local images through the explicit body/image path. Read/unread state and the prior saved passage remained usable through established same-hash/fallback restoration; exact hashes were not inspected. Chapters, Next/Previous/Contents and typography/theme worked. Opening screens did not start downloads; deliberate unchanged Check for Updates completed with restored state preserved. No packet-level request counts or native-wire evidence is claimed.

5. **E — full removal and fresh same-thread import: PASS.** Both destructive confirmations removed the selected story without immediate resurrection; force-quit/relaunch preserved deletion. Other stories/local state, fixture/harbor and global preferences survived; S1/S2A development diagnostics remained present. Deliberate import of the same public thread behaved as a fresh, single import with new/Unread entries and no prior Read history, saved passage or update history. This demonstrates logical deletion, not secure erasure or physical inspection of diagnostic databases.

6. **F — image interruption/Retry: PASS WITH QUALIFICATION.** "An image-download interruption coincided with switching apps; two PNGs did not complete initially and both succeeded on explicit Retry." The app switch may have contributed, but causation was not established. This is physical explicit-retry recovery evidence, not a controlled background-interruption experiment.

7. **G — already-running offline sanity: PASS.** With Stowaway already running, networking was disabled. Downloaded text stayed readable, at least one local source image rendered, local Read/Unread correction updated counts, and Next/Previous/Contents remained usable. Image state had no pending work after successful Retry. Networking was restored. This does not prove an independent installation, Metro-free cold start or first launch in airplane mode.

Demonstrated loop: existing v5 library → v6 preservation → cancel destructive actions safely → Remove Downloads → retain metadata/Read/progress/update history → restart → explicit Resume Download → restore readable bodies with retained state → Remove Story through two confirmations → restart → same-thread import is fresh → local/offline reader remains coherent.

## Conditional physical cases — not exercised

1. Actual SQLite/transaction failure during Remove Downloads.
2. Actual SQLite/transaction failure during full Remove Story.
3. Actual post-COMMIT source/render cleanup failure and Retry Cleanup.
4. Naturally saved-unlisted removal followed by natural reappearance.
5. Force-kill at the destructive transaction/cleanup boundary.
6. Deliberate rapid/stale confirmation-handler races.
7. Naturally occurring blocked/incomplete/parser/storage error presentation during I4 acceptance.
8. VoiceOver-specific management/confirmation behavior.
9. Forensic secure deletion (not an implemented or claimed property).
10. S2B independent/Metro-free offline cold start (deferred).

Covered rollback/cleanup/mutation/race/error cases retain separate deterministic host-SQLite/UI/file evidence in [I4 implementation and validation](I4_Library_Management.md). Host tests do not prove VoiceOver, forensic erasure or S2B. Do not manufacture failures by corrupting normal storage, filling disk, resetting/uninstalling the app or killing unrelated resources.

S0/S1/S2A are accepted; I0/I1/I2/I3 are merged/accepted. I4 core physical acceptance has passed and the candidate is not yet merged. Full v0 remains incomplete, S2B remains deferred, and the Astra whole-repository audit has not started. Acceptance bookkeeping/validation, a separate acceptance commit/push and PR preparation against main are authorized; no merge or new product scope.
