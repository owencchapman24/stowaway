# I3 — Read/Unread + Progress State

Implementation **bc3f8bbad5cc528fb35432aa993184511ff646fd**, physical acceptance recorded **7 October 2026, America/New_York**. Branch `feat/read-state`, base merged main **0518dd19ddd6053ef238dfb44ecbbe2961dece39** (PR #6 / I2). Node **22.23.3**, npm **10.9.9**, Expo SDK **57**; dependencies and lockfile unchanged. The [October audit](Stowaway_October_2026_Groundwork_Audit.md) remains controlling. Owen explicitly selected I3, superseding the previous current-status prohibition on starting read state.

**CORE I3 PHYSICAL ACCEPTANCE PASSED**, as reported by Owen using the existing physical iPhone library through Expo Go/Metro. Core migration, manual correction, automatic completion, restored-at-end safety, immediate-navigation settlement, offline local progress and I1/I2 regression paths passed physically. Conditional live-state/accessibility/failure cases remain unexercised where unavailable; the [I3 device record](I3_Device_Checklist.md) identifies them. This is supplied acceptance evidence, not an agent-operated phone run or independent device/wire inspection; exact iOS/Expo Go versions were not freshly supplied. S0/S1/S2A are accepted; I0/I1/I2 are accepted and merged in PR #4/#5/#6. Historical evidence and its unexercised cases remain unchanged. I3 is not yet merged. S2B is deferred; full v0 is incomplete. Current authorization covers acceptance documentation/status cleanup, validation, a separate acceptance commit/push and PR preparation against `main`. No merge, next product slice, deletion/library management, S2B or final Astra audit is authorized.

## Storage and identity

Normal `stowaway-s0.db` migrates non-destructively to **v5** in the existing exclusive transaction with final foreign-key validation:

```sql
ALTER TABLE threadmark_entries ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0
  CHECK(is_read IN (0, 1));
PRAGMA user_version = 5;
```

I1 separated stable manifest identity `(story_id, post_id)` from downloaded bodies. Read state therefore belongs on `threadmark_entries`, including entries whose text is still pending. Title, order, content hash, body/image availability and locator are independent. No timestamp, history, completion percentage, analytics or separate progress ledger is added.

Every pre-I3 manifest entry initializes **Unread: not previously marked read**. v4 has no trustworthy completion bit. Old locators (even progression 1), downloaded bodies and previously opened chapters do not establish completion. This may give the existing library large initial counts; per-entry correction is deliberate. No Mark All or historical guess is provided.

Fresh/v1/v2/v3/v4 paths reach v5 without resetting storage. v5 only adds the constrained column; stories/update timestamps, listed/unlisted entries, whole canonical bodies/version/hash/block/link fields, image discovery/references, locators, preferences and fixture asset remain intact. Failed migration rolls back schema/data/version together. S2A initialization still explicitly targets **v1**; it gains no manifest/read schema or automatic repair. Historical v3/v4 repository read queries can expose the deterministic Unread default without modifying those schemas; normal startup always migrates before read-state writes.

`setEntryRead(storyId, postId, boolean)` validates the boolean and stored entry within the serialized exclusive write. It works for current pending entries and saved-unlisted entries. `markChapterRead(chapterId)` safely resolves a downloaded chapter to its stored story/post entry with a join, including saved-unlisted chapters; it does not slice arbitrary IDs. Updates have a changed-value predicate and repeated writes are idempotent. A failed transaction preserves the prior state. Neither API needs a source client.

## Counts and import/update invariants

Library and Story Contents display **N unread** derived from currently listed primary entries, including pending/undownloaded text. Saved-unlisted entries retain and expose their state but do not contribute to current totals. Text downloaded/total and image summaries keep their existing meanings.

All manifest inserts omit `is_read`, using default 0. Initial duplicate import remains resume-only and never resets flags. Body download/cancel/resume does not write read state. COMPLETE reconciliation temporarily unlists entries and upserts metadata/current membership only; its conflict clause deliberately does **not** assign `is_read`. Rename/reorder and removal retain it; reappearance reuses it for downloaded and undownloaded entries; genuinely new appended/inserted IDs start Unread. Incomplete/failed/cancelled reconciliation cannot partially insert/reset state. Image discovery/download/repair, local render regeneration, preferences and locator saves do not change the flag. I2 source-image code/files are unchanged by I3.

## Reader completion and security

The app-owned bridge sends a narrow **`read-end`** message with exact session/chapter/contentHash identity. Native parsing requires exactly those four fields for control messages, retains the **16,000-character cap**, and rejects wrong identity/type or extra fields. Canonical allowlist sanitization, restrictive CSP, local file access and deliberate safe-link behavior remain intact; source prose cannot execute script or forge an accepted event. No remote reader resource, source JavaScript or network job is enabled.

Completion requires ready state and **trusted user input inside the chapter**. Touch movement, wheel input or a scrolling key arms a **1,200ms** scrolling window with captured document height/viewport. A resulting scroll can complete only with unchanged geometry. A fresh trusted touch-end/click or scrolling input already at the end can complete a short/no-scroll chapter or a restored-at-end chapter. Safe-link and spoiler-summary actions remain separate. Completion uses the live document scroll extent with a **24 CSS-pixel** end tolerance, not saved progression or a SQL percentage. It emits at most once across restyles within a reader session.

Opening, ready, restoration, programmatic scrolling without scrolling input, layout/restyle, image load/error/reflow, resize, background/pagehide and flushing do not independently complete a chapter. Restyle/restore clears the scrolling window; image load/error and viewport/height changes invalidate it. Owen physically confirmed genuine end interaction and opening/restoration/typography false-positive protection. Short/no-scroll chapters, selection/accessibility and image-load/failure geometry alone were not separately reported as physical passes; deterministic DOM geometry retains its own limits.

The normal route supplies optional `onReachedEnd={repository.markChapterRead}` to the reused ChapterReader. S2A omits it. `ReadEndSession` admits only a ready completion, starts one local save and ignores duplicate events. Its pending write is awaitable; failed writes remain retryable on explicit exit. Exit flush waits for both read-state and locator writes, asks the WebView to flush, and then waits again for messages received during that handshake. Next/Previous/Contents navigation happens only after settlement. Read failure reports a local error and holds navigation for retry; locator writes settle independently and text stays readable. Last completed commits remain the durability boundary for an abrupt process kill.

## Manual correction and refresh

Every current and downloaded saved-unlisted Contents row shows textual **Read/Unread** plus **Mark Read/Mark Unread**, with an accessibility label naming the chapter. Pending text can be corrected. A manual write locks other local/source actions and navigation through the final authoritative SQL refresh; existing update/image locks also disable manual actions through settlement/refresh. Synchronous refs guard retained handlers, and focus/read-version guards discard stale route/refocus reads. Successful correction refreshes counts and states from SQLite; storage failure preserves the old authoritative flag, reports an error and permits retry. Opening Library/Contents performs local reads only.

## Deterministic evidence and validation

All automated source transports use original synthetic fixtures. Coverage includes populated v4 preservation/rollback, all historical migration paths, isolated S2A v1, pending/body/duplicate import and cancellation/resume, current-only counts, idempotent/manual/automatic failures and story isolation, unchanged/rename/reorder/append/insertion/removal/reappearance and cancelled/failed upserts, real source-image repair/regeneration independence, close/reopen and abrupt committed/uncommitted host-process exit, ~1,000 entries, exact bridge validation and trusted input/false-completion geometry, and real SQL with mocked native UI/WebView for correction, operation refresh, route ownership and immediate reader exits. Host process-exit recovery is a persistence seam, **not an iPhone force-quit pass**.

Implementation validation on Node **22.23.3** / npm **10.9.9**:

| Command | Result |
| --- | --- |
| `npm.cmd run check` | Strict TypeScript, lint and **540 tests / 26 suites passed**. **71 added cases**, all 469 baseline cases retained. |
| `npx.cmd expo install --check` | Dependencies up to date. Sandbox metadata access initially failed with EACCES; approved rerun passed without package changes. |
| `npx.cmd expo-doctor@latest` | **21/21 checks passed** using approved package metadata/cache access. |
| `npx.cmd expo export --platform ios` | Local iOS Hermes bundle, **1,249 modules**, plus bundled assets exported to ignored `dist/`. No signing/build service. |
| `git diff --check` | Passed; staged additions also checked before commit. |

The separate sequential completed-diff/security review checked every entry insertion/upsert, migration rollback and SQL joins, pending/current/saved counts, cross-story writes, bridge identity/trust/layout guards, save failures and immediate navigation, manual/source/image settlement/refocus, S2A reuse and local-only behavior. It tightened retained manual handlers to resolve currently displayed identities while preserving explicit Mark Read/Unread intent, rejecting an entry hidden after a pending removal. It also invalidated scrolling engagement on link/spoiler-summary actions. Added regressions hold a pre-correction refocus read, exercise retained actions, and prove legacy image discovery/repair preserves progress. Final inspection found no remaining blocking defect; this was a sequential review in the implementing session, not independent-agent/native certification.

Initial new test failures corrected harness assumptions: real UUIDs are supplied to old mocked WebView tests under strict message-shape validation; synthetic gesture events carry their event type; immediate Next has a downloaded successor; and the legacy-image fixture uses the importer's canonical wrapper rather than deliberately mismatching saved text. Historical v3→v4 migration coverage now explicitly targets v4, while latest/newer version expectations advance to v5/v6. Existing assertions and timeouts were not weakened. A nullable captured-value TypeScript check was resolved with a narrowed closure. Native UI test timers are drained under `act`; no warning suppression is added. Node's experimental SQLite and Metro color warnings remain informational.

The implementation was pushed before Owen's physical report. The supplied acceptance below establishes the reported iPhone paths; conditional cases retain their limits. No live SpaceBattles requests occurred in implementation/review. Expo metadata validation and GitHub traffic are separate from source traffic. The export is compilation evidence, not S2B.

## Physical acceptance supplied by Owen

The [device record](I3_Device_Checklist.md) contains the reported A–H passes and qualifications:

- **v4 → v5 preservation:** Eyes Open **34/34**, Normal Isn't Ordinary **25/25**, Aenys **38/38** and The Lantern Cartographer **3/3** survived without reset, with initial unread counts **34 / 25 / 38 / 3**. Local Aenys images, fixture-only harbor, passages, font/theme preferences and I1 timestamps remained intact; opening Library/Contents started no source/update/image work.
- **Manual correction:** Aenys chapter 1 changed Unread → Read with Contents/Library **38 → 37 unread**, then Mark Unread restored **38**. Returning to Contents and force-quit/Metro relaunch preserved the final manual state/count.
- **Automatic completion and restoration safety:** opening or leaving before the end kept an Unread chapter Unread; genuine scrolling/reading to the end marked Read and reduced the count exactly once. Restoring near the bottom, waiting and font/theme reflow did not complete a manually Unread chapter; fresh user interaction at the end did.
- **Immediate navigation and restart:** immediate Next and immediate Contents after end completion preserved Read. Normal Previous/Next/Contents stayed within the story; force-quit/Metro relaunch retained committed Read, passage, preferences and existing images. An immediate Previous-at-end sequence was not separately reported.
- **Already-running offline progress:** with networking disabled, manual correction/counts and genuine end completion worked locally; text, Aenys images, navigation and saved passage remained usable. No source request was required for progress writes. This is not packet inspection or an independent install/Metro-free cold start/first launch in airplane mode.
- **I1/I2 regression:** a deliberate unchanged COMPLETE update with mixed flags preserved state/counts, text/images/passages and no duplicates. Aenys images remained at expected positions with coherent counts, unaffected by read-state actions; opening screens started no automatic image work. The historical I2 **57 local / 1 omitted / 0 pending** inventory was not freshly enumerated in this I3 report.

**Conditional physical cases — NOT EXERCISED:** manual correction of naturally pending current entries; manual correction of naturally saved-unlisted downloaded chapters; genuine one-screen/no-scroll completion; natural new/inserted entries starting Unread; natural rename/reorder/removal/reappearance retaining flags; actual manual/automatic local storage-write failure; and VoiceOver/large-text-specific read-state accessibility. Deterministic host/bridge/UI tests remain their evidence; no unavailable live state was manufactured. Other unreported checklist edges are identified in the device record without promoting them to physical passes.

Demonstrated loop: existing story → persistent initial Unread → manual correction → Library/Contents counts update → state survives restart → opening/restoring does not falsely complete → genuine end interaction marks Read → completion survives immediate navigation → progress works offline → manual updates and local images preserve state.

## Implementation changed-file inventory (24 files)

```text
AGENTS.md
README.md
docs/I3_Read_State.md
docs/I3_Device_Checklist.md
src/app/index.tsx
src/app/reader.tsx
src/app/story.tsx
src/domain/types.ts
src/reader/ChapterReader.tsx
src/reader/bridge.ts
src/reader/position.ts
src/reader/read-state.ts
src/storage/migrations.ts
src/storage/repository.ts
tests/bridge.test.ts
tests/position.test.ts
tests/i0-reader.test.tsx
tests/i0-screens.test.tsx
tests/i1-screens.test.tsx
tests/integration/i0-import.test.ts
tests/integration/i1-handoff.test.tsx
tests/integration/i2-images.test.ts
tests/integration/i3-read-state.test.ts
tests/integration/i3-ui.test.tsx
```

## Boundaries and deferred work

Global `PRAGMA foreign_key_check` performance remains deferred and unchanged. Read writes use the existing transaction/FK mechanism; the bridge and native session deduplicate completion to avoid repeated automatic transactions. No timing-based CI assertion or large-library performance claim is added. S1 concurrent diagnostic request-budget accounting remains deferred; prior image traffic is already excluded by its per-run baseline.

Read state is local and independent of text/images/locators. No deletion, search, categories/sites, bookmarks, statistics, backend/sync/accounts, scheduled/automatic update or image work, S2B or EAS/signing/cloud/paid work is included. Acceptance bookkeeping and PR preparation against `main` are authorized; no PR merge, next product slice or final Astra whole-repository audit is authorized. Historical I0/I1/I2 evidence remains unchanged.

## Acceptance bookkeeping validation and PR preparation

The separate acceptance pass changes only **AGENTS.md**, **README.md**, **docs/I3_Read_State.md** and **docs/I3_Device_Checklist.md**. Production behavior, tests, dependencies/lockfile, historical I0/I1/I2 records and the October specification are unchanged. A sequential documentation diff review checked the recorded A–H passes against Owen's report, retained all seven conditional cases as unexercised, and distinguished normal Previous from immediate Next/Contents, coherent images from a freshly enumerated inventory, and already-running offline progress from S2B. No final Astra audit was started.

Bookkeeping validation on **7 October 2026**, Node **22.23.3** / npm **10.9.9**:

| Command | Result |
| --- | --- |
| `npm.cmd run check` | Strict TypeScript, lint and **540 tests / 26 suites passed**. |
| `npx.cmd expo install --check` | Dependencies up to date; no package changes. |
| `npx.cmd expo-doctor@latest` | **21/21 checks passed**. |
| `npx.cmd expo export --platform ios` | Local iOS Hermes export passed, **1,249 modules**, to ignored `dist/`. |
| `git diff --check` | Passed. |

No live SpaceBattles request was made during bookkeeping; Expo metadata and GitHub validation traffic are separate. No prose/raw pages/image bytes/screenshots or generated exports are included in the acceptance commit. Global FK performance and concurrent S1 diagnostic request-budget accounting remain deferred. No deletion or automatic source/image job was added; S2B remains deferred and full v0 incomplete.

GitHub CLI is unavailable. PR title: **I3: Persistent read and unread state**. The prepared body is saved outside tracked Git at ignored **.tools/I3_PR_Body.md**. Open the [main-to-I3 comparison](https://github.com/owencchapman24/stowaway/compare/main...feat/read-state?expand=1), confirm base **main** / compare **feat/read-state**, paste the title and saved body, then select **Create pull request**. No PR was created by this fallback; **no merge is authorized**.

## Post-acceptance failed-save recovery fix — PR #7

**Historical first correction: `0b819d512a8ad83419faa95f432c9a2ba4377ae4`. The second targeted Ultra verification found this correction partial: pre-existing intent survived, but intent accepted during the final locator wait could still be discarded. The correction and evidence below are superseded for that ordering by the next section.**

The adversarial review of **b1cc6cdb3f9241b9114b07fcad994ce6873c545b** found one **MEDIUM / PROVEN BUG**: a failed automatic Read save retained completion intent in `ReadEndSession`, but Retry/Reopen and WebView process-termination recovery directly replaced the keyed reader. The new session forgot that accepted completion. A host-SQLite UI probe reproduced a recovered storage path that exited successfully while the chapter remained Unread. Ordinary successful in-flight writes were not cancelled by unmount; the defect concerned failed, retryable intent.

The narrow correction keeps the existing session alive until local progress settles. Both controlled reopen paths use the same two-stage Read/locator flush as navigation. If saving succeeds, the route's existing attempt key may replace the reader; if it still fails, the old session and pending completion remain, with an actionable Retry error. A later retry persists the already-authorized completion without another end interaction. The navigation/recovery ref prevents overlapping exits, retained Retry handlers and termination events from starting competing remounts. A stale async recovery cannot reopen a different/unmounted model.

Known failed/terminated WebViews are not sampled for another bridge flush. Termination releases any outstanding flush acknowledgement, marks the renderer unavailable and retries only locally known progress; the second native settlement remains in place. Read and locator saves still use `Promise.allSettled`, so either queue settles independently. A successfully saved Read is deduplicated within that session, including during reopen; no new completion is inferred from loading/restoration. Initial local-render failure with no model still uses ordinary Retry. No route coordinator, new persistence framework, migration or source behavior is added.

**Ten regression cases** in **tests/integration/i3-ui.test.tsx** exercise actual Reader/ChapterReader recovery handlers with real host SQLite: Retry and termination after an injected COMMIT failure; repeated failures that refuse remount while independently saving a locator; gated recovery blocking duplicate controls/navigation; ordinary initial-render Retry; termination without a completion request; successful completion/reopen without a duplicate Read write; and callback-free S2A reader reuse. Six targeted recovery cases failed against the pre-fix implementation before passing after correction. Existing immediate Next/Previous/Contents and failure tests remain intact.

Historical **CORE I3 PHYSICAL ACCEPTANCE PASSED** remains recorded for its tested implementation. This correction has deterministic/host evidence only; no new physical storage-failure or WKWebView-termination pass is claimed. The [focused device notes](I3_Device_Checklist.md#post-acceptance-recovery-fix--physical-regression-not-performed) retain that distinction. PR #7 remains open and unmerged; no new PR, next product slice, deletion/library management, S2B or final Astra audit is authorized. Deferred global FK performance and concurrent S1 request-budget accounting remain unchanged by this fix.

Fix validation on **7 October 2026**, Node **22.23.3** / npm **10.9.9**:

| Command | Result |
| --- | --- |
| `npm.cmd test -- --runTestsByPath tests/integration/i3-ui.test.tsx` | **28/28 passed**, including the **10 added recovery cases**. |
| `npm.cmd run check` | Strict TypeScript, lint and **550 tests / 26 suites passed**; all 540 prior cases retained. |
| `npx.cmd expo install --check` | Dependencies up to date; no package/lockfile changes. |
| `npx.cmd expo-doctor@latest` | **21/21 checks passed**. |
| `npx.cmd expo export --platform ios` | Local iOS Hermes export passed, **1,249 modules**, to ignored `dist/`. |
| `git diff --check` | Passed. |

The separate sequential review of only this completed fix inspected every controlled remount, the shared navigation/recovery guard, model identity after async settlement, failed-renderer sampling, both independent persistence queues, repeated failures and successful-write deduplication. No additional blocking defect was found. This was a sequential self-review, not another Ultra review or a native certification. The fix changes only **src/reader/ChapterReader.tsx**, **tests/integration/i3-ui.test.tsx** and the two I3 documents. Storage/read-count/reconciliation/image/bridge/source behavior, dependencies and S2A schema/isolation are unchanged. No live SpaceBattles request, normal-library fault injection, new product scope or physical run occurred.

## Second recovery correction — late completion during settlement

The targeted Ultra verification of **0b819d512a8ad83419faa95f432c9a2ba4377ae4** proved one remaining **P2 / MEDIUM** race. The final parallel settlement could finish its Read flush while no intent existed and then wait for a locator. A valid completion accepted during that wait could fail its actual SQLite commit. Releasing the locator allowed a keyed remount to forget the failed completion even after storage recovered. This affected ordinary Retry; it did not invalidate the first correction's already-pending case or unrelated physical acceptance.

The normal Reader route now owns a chapter-specific `ReadCompletion` **outside** the keyed `ChapterReader`. Validated, ready `ReadEndSession` messages synchronously record intent in this owner before starting asynchronous persistence. Success is deduplicated; failure retains the same intent. Per-rendering readiness and identity checks remain separate. A replacement rendering inherits that owner and retries only already-accepted intent; opening/restoration never requests completion. Ownership ends when leaving the chapter route or killing the process; the last committed SQLite state remains the process-kill durability boundary.

After the independent Read/locator flushes, the owner drains pending Read and calls the guarded replacement callback **synchronously with its final pending check**, without another await between check and callback. Thus an intent accepted during any preceding wait joins settlement. An intent accepted after the replacement decision but before React commits the keyed replacement still belongs to the same route owner and is inherited by the new reader. This is a lifetime boundary, not an arbitrary third flush of disposable session state. The owner is also available while the replacement reader is still loading and has no model.

Controlled Retry/navigation explicitly freeze interaction using native `pointerEvents` and the app-owned bridge's `setInteractionEnabled(false)`. The bridge stops fresh trusted completion, locator and link input and invalidates the scrolling gesture; it retains the last dirty locator for flushing. Native message validation continues accepting already-generated messages while settling. A rendering that becomes ready during settlement is also frozen. Failed settlement restores interaction on the retained live renderer and leaves actionable Retry; a fresh gesture is needed only for a new completion, never for the retained intent. The shared exit ref serializes navigation/recovery, and lifecycle/model guards prevent stale callbacks from replacing a newer reader. Known dead WebViews receive neither freeze/restore commands nor flush sampling.

**Pre-fix reproduction:** the exact Ultra-ordering regression was added and run against `0b819d5` before production edits. Its real SQLite Read commit rolled back, storage recovered before the final locator release, and the reader remounted with Read still false: `Expected: true; Received: false`. The corrected regression requires a second Read attempt and persisted Read before remount, preserves the expected locator, and navigates to Contents without another end interaction.

**Ten added cases** retain all 550 previous tests: eight actual Reader/ChapterReader host-SQLite cases cover the exact Retry ordering, queued late completion during termination without dead-renderer sampling, repeated real Read rollbacks in both paths, locator rollback followed by Read success with further locator failure, route-owned intent across a forced keyed replacement with stale callbacks, navigation while that replacement is still loading, and ordinary locator-only Retry. Two exact-bridge tests verify frozen trusted input, retained locator/already-generated completion, fresh interaction after failure recovery, and deduplication. Existing normal completion, successful Retry, immediate Next/Previous/Contents, overlapping controls and callback-free S2A tests remain intact.

Historical **CORE I3 PHYSICAL ACCEPTANCE PASSED** remains recorded on **bc3f8bbad5cc528fb35432aa993184511ff646fd**. This second correction has deterministic/real-host-SQLite/UI/bridge evidence only. No physical storage-failure/recovery or WKWebView-termination pass is claimed. A focused phone regression is useful for the new interaction freeze and native recovery seam; manufacturing normal-library corruption, filling storage, adding a fault-injection UI or resetting data is not authorized.

Only **src/app/reader.tsx**, **src/reader/ChapterReader.tsx**, **src/reader/read-state.ts**, **src/reader/bridge.ts**, **tests/integration/i3-ui.test.tsx**, **tests/bridge.test.ts** and these two I3 documents change. No migration, count, reconciliation, source/image or dependency behavior changes. S2A omits the optional completion owner and retains isolated v1 storage. Global FK performance and S1 diagnostic request-budget work remain deferred. No live SpaceBattles request, new product scope, deletion/library management, S2B, final Astra audit, new PR or merge is included.

Second-correction validation on **7 October 2026**, Node **22.23.3** / npm **10.9.9**:

| Command | Result |
| --- | --- |
| `npm.cmd test -- --runTestsByPath tests/integration/i3-ui.test.tsx tests/bridge.test.ts` | **57/57 passed**; 36 reader/UI cases and 21 bridge cases. |
| `npm.cmd run check` | Strict TypeScript, lint and **560 tests / 26 suites passed**; all 550 prior cases retained. |
| `npx.cmd expo install --check` | Dependencies up to date; no package/lockfile changes. |
| `npx.cmd expo-doctor@latest` | **21/21 checks passed**. |
| `npx.cmd expo export --platform ios` | Local iOS Hermes export passed, **1,249 modules**, to ignored `dist/`. |
| `git diff --check` | Passed. |

The separate sequential self-review inspected only this completed fix: pre-existing and late intent, the final synchronous handoff, keyed replacement, restoration without a model, failure combinations, native interaction freeze/restore, dead-renderer commands, overlapping exits and stale callbacks. An additional no-file-edit host-SQLite probe injected a valid completion inside the replacement callback itself, beyond the final drain check. The shared owner survived the remount, retained repeated actual Read rollbacks, refused another remount while saving failed, and saved on later Retry after recovery without another end interaction. This directly checks that ownership prevents moving the race to the last callback interval. No additional blocking defect was found. This is sequential self-review and deterministic evidence, not another Ultra review or a physical/native certification. Expo metadata/npm-registry checks required network access after sandbox EACCES failures; they made no SpaceBattles request.

## Third recovery correction — acknowledged navigation handoff

Post-acceptance targeted adversarial verification of **9d152fdc46c474fbda5f1d32564047322c1b6fc7** proved a remaining **MEDIUM** cross-route owner-lifetime race. The 600 ms generic flush timeout allowed Contents/Next navigation without proving the live WebView had stopped generating messages. A queued valid completion could be accepted after navigation was queued, then lose its owner when navigation committed and its actual Read transaction rolled back. Same-chapter Retry and late completion during locator settlement were already fixed; this finding did not revoke those fixes or historical physical acceptance.

Controlled replacement now uses `prepareForExit(handoffId)` on the app-owned bridge. It synchronously disables fresh trusted reading input, invalidates the active gesture, flushes the dirty locator, then posts `quiesced` with the handoff ID and rendering session/chapter/content hash. Earlier messages and this acknowledgement use the same ordered message bridge. Native accepts queued completion before the matching acknowledgement, then settles locator and Read independently and drains the route-owned completion before the synchronous guarded replacement decision. No live-renderer handoff may use timeout or a generic `flushed` message as proof of quiescence.

The handoff ID combines the rendering session and an incrementing generation. Message parsing requires the exact five-field acknowledgement, current identity and bounded ID; native additionally requires the currently pending ID. Timeout, cleanup and completion invalidate that wait. Late acknowledgement A cannot release retry B. A live 600 ms timeout blocks navigation/remount, keeps the owner, restores native pointer interaction and bridge input, and shows actionable Retry. Known process termination cancels the acknowledgement requirement without injecting into the dead renderer and still drains accepted state. A load error alone is not proof of process death: cross-route exit remains blocked, while same-chapter Retry can recover the failed renderer with its existing completion owner. Ordinary AppState/background flush behavior is unchanged.

**Pre-fix/post-fix evidence:** before production edits, the exact no-ack regression failed on `9d152fd` for Contents, Next and Previous because `router.replace` had already been called after 700 ms. All three now retain the same owner and actionable error past timeout. Each then accepts a queued completion, holds its real host SQLite transaction before COMMIT, rolls it back, recovers storage and retries navigation with a matching acknowledgement. Without another read-end, the second save commits Read, the locator is unchanged, other entries stay Unread, and Contents displays the persisted correction.

**Nineteen added tests** retain all 560 previous cases: fourteen reader/UI host-SQLite cases cover that exact regression in all three directions, queued completion before acknowledgement in all three directions, timeout/retry/stale and malformed acknowledgements, Read rollback after acknowledgement, locator rollback with independent Read success, termination during handoff, load-error recovery, route cleanup/stale callbacks, already-Read navigation without another automatic transaction, and unchanged background saving. Four exact-bridge cases cover ordered locator/completion/acknowledgement messages, fresh-input freeze and recovery, quiescence during restoration, and invalid command IDs. One parser case checks valid acknowledgement shape and twelve malformed/identity variants. Existing same-chapter Retry, late-locator settlement, repeated failures, deduplication, immediate navigation and callback-free S2A cases remain intact.

Historical **CORE I3 PHYSICAL ACCEPTANCE PASSED** on **bc3f8bbad5cc528fb35432aa993184511ff646fd** remains valid. This correction has deterministic/UI/real-host-SQLite evidence only; **no new physical storage-failure/recovery or WKWebView-termination pass is claimed**. A focused iPhone smoke test is materially useful for native quiescence messaging and interaction restoration, using the existing local library without deliberate corruption, reset or new source requests.

Only `src/reader/ChapterReader.tsx`, `src/reader/bridge.ts`, `src/reader/position.ts`, their three test files and the two I3 evidence/checklist documents change. The route-owned completion and chapter identity design stay intact. No migration/count/import/reconciliation/pending/saved-unlisted/source/image/dependency behavior changes. S2A remains callback-free at isolated schema v1. Deferred FK performance and S1 diagnostic request-budget work are unchanged. No live SpaceBattles request, next product scope, deletion/library management, S2B, whole-repository Astra audit or merge is included.

Third-correction validation on **7 October 2026**, Node **22.23.3** / npm **10.9.9**:

| Command | Result |
| --- | --- |
| `npm.cmd test -- --runTestsByPath tests/integration/i3-ui.test.tsx --testNamePattern=unacknowledged` before production edits | All three directions failed because navigation was already called past timeout. |
| `npm.cmd test -- --runTestsByPath tests/integration/i3-ui.test.tsx tests/bridge.test.ts tests/position.test.ts` | **90/90 passed** after the fix. |
| `npm.cmd run check` | TypeScript, lint and **579 tests / 26 suites passed**; all 560 previous cases retained. |
| `npx.cmd expo install --check` | Dependencies up to date; no dependency/lockfile changes. |
| `npx.cmd expo-doctor@latest` | **21/21 checks passed**. |
| `npx.cmd expo export --platform ios` | Local iOS Hermes export passed, **1,249 modules**, to ignored `dist/`. |
| `git diff --check` | Passed. |

Expo dependency metadata and npm-registry checks initially hit sandbox EACCES and passed with the required network access. No SpaceBattles request was made. Generated bundles remain uncommitted.

The separate sequential self-review examined only this final diff after implementation/validation. It traced timeout and late/stale/wrong acknowledgements, synchronous bridge freeze/flush/ack ordering, queued completion and actual Read rollback, independent locator failure, overlapping exits, cleanup cancellation, same-chapter Retry, process termination and stale callbacks. In particular, a generic load error cannot bypass the cross-route acknowledgement requirement; only definitively terminated renderers skip it. No remaining blocking defect was found in this pass. This is a sequential self-review, not another Ultra review or physical/native certification. Native message delivery and interaction restoration remain useful focused phone smoke checks.
