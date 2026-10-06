# I1 — Manual Updates + Safe Reconciliation

Implementation date: **6 October 2026, America/New_York**. Implementation commit: **0f3c9e756dd7f2440d3b1da9760ae5b1247922ae**. Branch: `feat/manual-update-reconciliation`, clean base **181feecd1e4ae4f14f86b862757246d60114956b**, merged main including I0 PR #4. Fetch confirmed `origin/main` at that base. Environment: Node **22.23.3**, npm **10.9.9**, Expo SDK **57**; dependencies/lockfile unchanged. The [October audit](Stowaway_October_2026_Groundwork_Audit.md) controls v0. Owen explicitly selected I1, replacing current I0 instructions against manual updates.

**CORE I1 PHYSICAL ACCEPTANCE PASSED.** Acceptance recorded **6 October 2026, America/New_York**, from Owen's supplied physical-iPhone report for the implementation commit above using the existing library through Expo Go/Metro. **Natural live-source mutation cases were unavailable and remain physically unexercised; deterministic automated tests cover them.** See [physical evidence and conditional limits](I1_Device_Checklist.md). This is user-reported evidence, not an agent-operated phone run or wire inspection. S0/S1/S2A/I0 remain accepted, I0 is merged, S2B remains deferred and full v0 is incomplete. Historical I0/S0/S1/S2A evidence documents are unchanged.

## Design and affected assumptions

Before coding, inspected migrations/repository, initial import/resume, source traversal/client, Contents/Library and ChapterReader/tests. Every stored entry was previously implicitly current: Library `storySelect`, `listContents`, body-entry lookup, and the import/resume missing-body loop all depended on that assumption. Reader navigation used `listChapters(storyId)`, ordered by `chapters.position`. Reader heading/rendering used the stored chapter title. Fixture seed and v1 backfill also created manifest entries. S2A uses the same repository for its isolated v1 chapter/locator/asset operations, without normal manifest APIs.

The design adds one membership column, one partial index, two nullable story timestamps, a transactional reconciliation operation and a manual mode of the existing importer. No new dependency, source client, global state framework, job engine, sync ledger or content revision table. Reader current navigation queries the manifest; downloaded unlisted contents has a separate query. Rebuild risk is bounded: no existing table references `threadmark_entries`; chapters and reading_positions continue referencing stories/chapters directly. Migration runs inside the existing exclusive transaction with its unchanged final FK check.

## v3 storage and migration

Normal `stowaway-s0.db` migrates v0/v1/v2 → **v3** without reset/reseed. v1/v2 steps remain intact. v3 adds `stories.last_update_attempt_at` / `last_update_success_at` as nullable integer timestamps and rebuilds `threadmark_entries` with the same `(story_id, post_id)` primary key, preserved title/position/source URL and `currently_listed` constrained to 0/1, default 1. Every historical v2 entry is copied as listed. A partial UNIQUE index on `(story_id, position) WHERE currently_listed = 1` replaces the old unconditional constraint. Retained entries keep their last nonnegative position; they can share it with current entries. No magic negative positions are used.

Migration does not rename/rebuild stories, chapters, reading_positions, settings or assets. Failure before COMMIT rolls back schema/version/data together. Real host-SQLite tests cover a populated v2 fixture + synthetic imported story, pending entry, body/hash/version/block/link preservation, locators/preferences/asset references, migration rollback/retry, fresh/v1/v2 paths and FK targets. Explicit-column reads refresh Node SQLite's schema metadata after DDL on its separate transaction connection; tests then compare all stored fields. This host-driver detail is not phone evidence.

S2A still calls `migrate(db, 1)` only for explicit new diagnostic initialization; normal v3 migration is never applied to it. Its inspection, exact path protection and recovery code are unchanged. v1 `listChapters` retains the old chapter-based fallback.

## Manual operation and reconciliation

1. Contents' deliberate **Check for Updates** passes stable story ID plus saved source URL. Before source traffic, reject a mismatched URL/identity or missing/non-imported story. Initial import, manual check and resume acquire the same module-level story-ID guard across screens/repository handles. Different stories remain logically independent; the one native RequestClient serializes all source traffic.
2. Commit last-attempt time when the manual operation begins. It never clears the previous success time.
3. Use the accepted root metadata parser and COMPLETE primary traversal, including pagination/ranges and thread/category/count checks. Stage the whole manifest in RAM. FAILED/INCOMPLETE, blocked/challenge/login, parsing/network failure or cancellation does not reconcile any partial data. Raw source documents remain transient.
4. In one serialized exclusive transaction, validate incoming story identity/URLs and COMPLETE/nonempty/unique numeric post IDs. Read retained metadata by stable post ID; compare current common IDs for an order-changed boolean, avoiding noisy counts from insertion shifts. Temporarily unlist the story's rows inside the transaction to avoid position conflicts. Upsert the full incoming ordered list as current, preserving old rows absent from it. Update existing chapter **title/position only**, with no HTML/hash/version/block/link/locator replacement. Refresh story title/URL/category and preserve a known author when a later parse omits it. Commit last-successful-COMPLETE-check time with those changes. Return added/reactivated/removed/renamed counts, order/metadata flags and current total/downloaded/pending.
5. Re-read SQLite's current list and foreground-download only currently listed missing bodies using the same I0 extraction/sanitizer/body-commit path. Existing downloaded bodies are skipped. Shared source documents may contain neighboring old posts, but only the missing exact post is extracted/committed; checking metadata does not request historical bodies for edit detection. Final completion/pending counts come from SQLite.

An identical repeated manual check still retrieves the manifest, advances attempt/success time and reports **Up to date** when all current bodies exist. It creates no duplicates and makes no body requests/writes. Ordinary duplicate Add Story remains zero-request when complete, or missing-only resume when partial; it does not implicitly check for updates.

## Removed, reappearing and reader semantics

An absent post from a COMPLETE manifest becomes unlisted without deletion of its body, locator or last metadata. It leaves current counts, contents, download/resume queues and Previous/Next. Downloaded unlisted entries appear under **Saved chapters no longer listed**; pending unlisted entries are retained internally and do not create fake readable rows. A formerly 34/34 current story with one downloaded removal becomes 33/33 current plus one saved chapter.

Reappearance upserts the same stored identity as listed with the current title/URL/order. Existing body/locator is reused and immediately counted as downloaded; a missing body rejoins the pending queue. Rename/reorder updates chapter metadata in the same transaction, so subsequent reader loads show the new title while passing unchanged content/hash/locator to rendering. Navigation queries current manifest order, never stale `chapters.position`, and stays within the story. Saved-unlisted reading returns Contents to its story with both Previous/Next disabled. Normal navigation remains among downloaded current entries. Sanitizer, trusted bridge, restoration/reflow guards, render-file isolation and bundled-asset lookup are unchanged.

## Cancellation, errors and UI ownership

Cancellation checks run before work, after network/preparation, between manifest rows, and synchronously **after global FK validation immediately before returning the transaction callback for COMMIT**, as in accepted I0. Cancellation while queued/in-transaction rolls back the entire reconciliation, including success time and chapter metadata. A completed attempt time may remain. Once COMMIT is unavoidable/completed, the transaction may be retained.

After reconciliation commits, cancellation/body failure does not undo its success time or new current/removed state. Each completed body remains; unfinished current bodies are pending. Close/reopen tests demonstrate coherent persisted state and explicit missing-only Resume; neither startup nor opening screens auto-resumes. Host close/reopen and injected boundaries are not real iPhone force-quits or hardware power-loss evidence.

Contents shows checking/reconciling/downloading progress, Cancel, concise update result, typed source/storage/busy failures, both timestamps and Resume when current text is pending. No Check action is shown for the synthetic fixture. Backgrounding aborts active work. The post-acceptance correction below blocks leaving Contents until an update settles and its final local refresh completes. Story and Resume components are keyed by stable route identity; Contents also invalidates stale local reads and tracks focus/operation ownership. Late results, progress and actions cannot attach to another story. A retained outcome claiming another story is rejected.

## Validation and sequential review

Added **52 deterministic cases**: 38 host-SQLite update/migration cases, 11 new update-screen cases, two saved/metadata-reader cases and one Resume-route ownership case. All **163 baseline cases remain**. Coverage includes every requested scenario: v2/fresh migration and isolated v1, identical/append/middle insertion, rename/reorder, downloaded/pending removal and reappearance, COMPLETE-only reconciliation, typed 403/challenge/parser/network/identity failures, queued/in-transaction/final-FK/after-COMMIT cancellation, preparation/body interruption and missing-only reopen/resume, write-queue recovery, idempotency/concurrent ownership/cross-story isolation, deliberate UI action/fixture exclusion/current/saved sections/stale async results and the generated ~1,000-entry reconciliation. There are no timing-based CI assertions or live transports.

All previous assertions remain, except upgrading the migration test's latest/newer schema expectations to v3/v4 and supplying v3 fields/AppState hooks in screen mocks. The added route, saved-reader and metadata navigation regressions extend existing suites. Initial harness failures corrected the missing native-mock AppState subscription and Node SQLite's stale SELECT * schema metadata after external DDL; no production guard or old assertion was weakened.

Final validation on Node 22.23.3 / npm 10.9.9:

```text
npm.cmd run check                    TypeScript + lint + 215 tests / 19 suites passed
npx.cmd expo install --check          Dependencies are up to date
npx.cmd expo-doctor@latest            21/21 checks passed
npx.cmd expo export --platform ios    Local iOS Hermes bundle + harbor.png exported to ignored dist/
git diff --check                     Passed, including the staged additions
```

The sandbox-only compatibility/Doctor attempts failed with EACCES; approved metadata/npm-cache access reruns passed. No dependency/lockfile changes or cloud build occurred. Node's experimental SQLite warning and Metro color-environment warnings are informational. Git status, diff/stat and main-to-branch comparison were inspected; the pre-commit main...HEAD comparison was empty because the candidate was still uncommitted. The completed commit contains only the listed 18 files, without generated output or source captures.

A **separate sequential diff review** followed the first full green check/export. It checked table rebuild/FK targets, active-position collisions, COMPLETE/identity gate, saved/pending removals and reappearance, body/hash/locator preservation, manifest-based navigation, cancellation before/within/after reconciliation, shared operation guard, repeated no-change checks and story isolation. It found a same-story focus edge: returning while an aborted operation finishes an unavoidable COMMIT could retain stale screen counts. The fix refreshes SQLite at completion after a focus change while suppressing the old operation's result; a blur/refocus regression covers it. Review also strengthened rollback snapshots to include chapter title/position and all authoritative story metadata, and separated explicit HTTP 403 from HTTP 200 challenge coverage. Full checks and iOS export passed after the production fix; final fixture-only checks passed after the assertion refinements. No remaining blocking finding was identified in this pass; it is not independent-agent, device or wire-level certification.

## Boundaries and deferred work

No live SpaceBattles request was made during implementation/review. The native request implementation and policy are unchanged: one shared queue, one request in flight, >=2-second spacing, honest UA, omitted credentials, checked public paths/redirects, bounded retries/Retry-After and stop on access/challenge failure. Source scripts never enter canonical reader HTML; remote loads/images remain blocked; source images are inert placeholders and safe links require deliberate action. No private downloads, raw captures, prose logs, screenshots, credentials or build output is committed.

No old-body edit detection/re-fetch, revision history, source images, read/unread, deletion, extra categories/sites, auth/accounts, backend/sync/search, RSS/notifications or automatic/scheduled/background updates. No S2B, EAS/signing, Apple/App Store, cloud build or paid work. The implementation pass created no PR; this acceptance follow-up authorizes PR preparation only, with no merge or next product slice. Public/commercial, republication and App Store authorization remain unresolved separately from Owen's personal scope.

Known deferred technical follow-ups remain **global `PRAGMA foreign_key_check` validation performance** and **S1 diagnostic request-budget accounting under concurrent source traffic**. Their code is unchanged; I1 has not measured or solved either. No timing-based CI assertion was added. Natural live additions/removal/reappearance/rename/reorder, saved-unlisted reading and I1 cancellation/resume during a new-body phase remain physically unexercised. Native wire headers/cookies/cache and packet-level missing-only behavior remain unverified; successful visible checks do not establish them. Independent installation, Metro-free launch, first launch in airplane mode and standalone cold-start acceptance remain deferred S2B.

## Physical iPhone acceptance — Owen's reported results

### Existing v2 library → v3 — reported passed

Owen opened the I1 implementation without resetting normal storage. The existing Library retained exactly **Eyes Open (Pokemon Fanfic) 34/34**, **Normal Isn't Ordinary [Pokemon SI] 25/25** and **The Lantern Cartographer 3/3**. Existing real chapters opened normally; saved passage restoration and font/theme preferences remained usable. The synthetic fixture stayed intact, real stories did not gain its harbor asset, and S1/S2A remained development-only diagnostics. Record this as physical v2 → v3 preservation, distinct from host-SQLite migration tests. A fresh harbor-image display check was not separately supplied.

### Deliberate unchanged checks and idempotency — reported passed

Opening Library or a real story started no source check/download. Check for Updates appeared for imported real stories and was absent from the fixture. Before the first deliberate check, no update timestamps were displayed.

On **Normal Isn't Ordinary**, the first deliberate check completed with **Check finished. / Up to date.**, retained **25/25** and a coherent chapter list, recorded separate attempt/complete-check times, and showed no duplicate story/visible entries or pending/Resume state. A second deliberate check again reported Up to date at 25/25, advanced both timestamps and caused no unexpected visible title/order change or duplicate/pending state. This demonstrates idempotency at the UI/persistent-state level; injected-transport tests, not the phone report, establish missing-only body requests.

| Check | Approximate displayed attempt, 6 October 2026 | Approximate displayed successful COMPLETE check |
| --- | --- | --- |
| Normal Isn't Ordinary — first | 1:00:59 AM | 1:01:03 AM |
| Normal Isn't Ordinary — repeat | 1:02:09 AM | 1:02:14 AM |
| Eyes Open — cancelled manifest check | 1:03:12 AM | None displayed |
| Eyes Open — deliberate retry after relaunch | 1:06:07 AM | 1:06:13 AM |

These phone-displayed times document the reported sequence, not API/wire timing or an independent clock/timezone audit.

### Cancellation, real force-quit/relaunch and explicit retry — reported passed

Owen started an **Eyes Open** check and cancelled quickly during the manifest-check phase. The story stayed **34/34**, with intact Primary Threadmarks and an attempt timestamp but no successful-complete-check timestamp. UI reported **Cancelled. Committed text is retained. / Prior primary contents retained; no complete update committed.** This is physical evidence of preservation before a successful COMPLETE reconciliation, without claiming the exact native transaction instruction where cancellation arrived.

Owen then force-quit Expo Go through the iOS app switcher and relaunched Stowaway through Metro. Without tapping Check, Eyes Open remained 34/34, its 1:03:12 AM attempt persisted, no complete-check time appeared and no check/download restarted automatically. Existing downloaded text opened/read normally. An explicit **Check for Updates** retry succeeded with Up to date, advanced attempt time, added complete-check time and preserved coherent 34/34 contents without duplicates. This was a manifest-check retry, not a new I1 missing-body Resume Download test.

### Reader and already-running network-disabled text — reported passed

After update checks, Owen confirmed saved passage restoration, typography/theme changes, leave/reopen restoration and Previous/Next staying within the selected story. With the Expo Go project already running, he disabled networking and read/navigated downloaded text successfully. This does **not** prove independent installation, Metro-free launch, first launch in airplane mode or standalone offline cold start.

### Conditional live mutations — explicitly not exercised

**NOT EXERCISED — no natural live source mutation was available:** newly added primary chapter, naturally removed primary entry, later reappearance, or a suitable natural rename/reorder. Consequently, physical **Saved chapters no longer listed** reading remains pending as a conditional live-source observation. No physical pass is fabricated. Deterministic host-SQLite/source/UI tests remain the evidence for append/middle insertion, rename/reorder, removal/reappearance, saved-unlisted behavior, pending removal/reappearance, current navigation and body/locator preservation. I1 new-body cancellation/restart/Resume, background/route ownership controls and direct script/network diagnostics were not separately supplied as physical results.

The physically demonstrated loop is: open an existing imported story → no automatic source work → deliberately Check for Updates → commit a COMPLETE unchanged manifest → Up to date → repeat idempotently → cancel a later check before successful reconciliation → retain prior authoritative contents → survive real force-quit/relaunch → no auto-resume → explicitly retry → complete successfully → retain reader passage/navigation and offline text. Core acceptance is passed with the conditional limits above; the next slice is not authorized.

## Acceptance-bookkeeping validation and PR preparation — 6 October 2026

This follow-up started on clean `feat/manual-update-reconciliation` at **0f3c9e756dd7f2440d3b1da9760ae5b1247922ae** with the expected origin. Fetch confirmed the branch and main base unchanged. Tracked changes are limited to **README.md, AGENTS.md, I1_Manual_Updates.md and I1_Device_Checklist.md**. No application/source/storage/reader code, tests, dependencies, lockfile or historical acceptance record changed. No live SpaceBattles request, prose/raw-page/screenshot capture, new feature or deferred technical fix occurred.

Validation rerun on Node **22.23.3** / npm **10.9.9**:

```text
npm.cmd run check                    TypeScript + lint + 215 tests / 19 suites passed
npx.cmd expo install --check          Dependencies are up to date
npx.cmd expo-doctor@latest            21/21 checks passed
npx.cmd expo export --platform ios    Local Hermes bundle + harbor.png exported to ignored dist/
git diff --check                     Passed
```

Compatibility/Doctor used the metadata/cache access already needed in prior validation. No package/lockfile change or cloud build occurred. Host SQLite and Metro warnings remain informational. A separate sequential documentation review matched each checked item to Owen's report, preserved the approximate timestamp sequence without wire timing claims, kept Check retry distinct from missing-body Resume, and left natural mutations/saved-unlisted behavior and other unreported controls physically unexercised. The export is compilation evidence, not S2B.

GitHub CLI is unavailable on PATH and in its standard installation locations. PR title: **I1: Manual SpaceBattles updates and reconciliation**. The prepared body is outside tracked Git at ignored **.tools/I1_PR_Body.md**. To create manually, open the [main-to-I1 comparison](https://github.com/owencchapman24/stowaway/compare/main...feat/manual-update-reconciliation?expand=1), confirm base **main** / compare **feat/manual-update-reconciliation**, paste that title and the saved body, then click **Create pull request**. No PR was created by this fallback and **no merge is authorized**. Source images/read-state/deletion/S2B and the next milestone remain unstarted.

## Post-acceptance update/reader handoff correction — 6 October 2026

PR #5's adversarial review at `4a67c523` reproduced a navigation race with real host SQLite and the actual reader component. A downloaded chapter could open after cancellation but before an unavoidable reconciliation COMMIT finished. The reader could retain the prior navigation list after its chapter became saved-unlisted. Text and locators were preserved. The prior physical acceptance used unchanged manifests and did not exercise this mutation window.

The targeted correction disables Read, Return to Library and Resume Download for the entire update promise and final authoritative SQL refresh. Cancel remains available; calling abort alone never unlocks navigation. `usePreventRemove` from the installed `expo-router/react-navigation` blocks Back/route removal, and the Story screen temporarily disables its iOS gesture. Blocked actions are discarded, with no automatic deferred navigation. Navigation and gestures return after settlement/refresh. A superseded final read is retried before unlocking; a failed read clears stale chapter actions and exposes a storage error. The user can then return to Library. The reader still loads once from SQLite after navigation; no polling or database subscription is added.

Eight new deterministic cases cover real COMPLETE update removal, rename, reorder, pre-COMMIT rollback and unchanged completion; a held boundary after the final cancellation guard; disabled Read/Library/native removal while Cancel remains usable; continued blocking during a delayed final read; saved-unlisted text/hash/locator preservation and disabled Previous/Next; final reader titles/current order; stale handler protection including Resume; refocus superseding a final read; and failed-read removal of stale actions. Native WebView/render files and navigation surfaces are mocked in these tests. Real SQLite transactions, reconciliation, operation ownership and reader code execute in the handoff suite; this is not physical-device evidence.

**POST-REVIEW I1 NAVIGATION HANDOFF PHYSICAL RETEST PASSED.** Owen subsequently reported the focused physical-iPhone retest through Expo Go/Metro on fix commit **22c761dbd064c376bb610a3cbb72de4820abb642**. The reported observations and remaining limits are recorded below and in [I1_Device_Checklist.md](I1_Device_Checklist.md). **CORE I1 PHYSICAL ACCEPTANCE PASSED** and unrelated historical passes remain unchanged. Natural additions/removals/reappearance/rename/reorder and saved-unlisted reading remain physically unexercised. S2B and full v0 remain incomplete.

Only Story Contents sequencing, fixture tests and these two I1 documents change. Reconciliation/storage, same-story operation locking, source/network policy, deferred global FK-performance and S1-budget code remain unchanged. No live SpaceBattles requests or new product scope are included. The fix stays on `feat/manual-update-reconciliation` and updates the existing PR #5; no new PR or merge is authorized.

Validation on Node **22.23.3** / npm **10.9.9**:

```text
npm.cmd run check                    TypeScript + lint + 223 tests / 20 suites passed
npx.cmd expo install --check          Dependencies are up to date
npx.cmd expo-doctor@latest            21/21 checks passed
npx.cmd expo export --platform ios    Local iOS Hermes bundle + harbor.png exported to ignored dist/
git diff --check                     Passed
```

Compatibility/Doctor used approved package metadata/cache access without changing dependencies. Metro recovered an unreadable local cache with a full crawl and the export passed; host SQLite/color warnings were informational. A separate sequential review of only this fix checked every Contents route-changing control, the installed native removal/gesture mechanism, cancellation through settlement/final refresh, saved-unlisted and renamed/reordered reader behavior, test boundaries and preserved physical evidence. No remaining correctness defect was identified in that pass. That review was not a fresh iPhone or wire-level inspection; the focused physical regression was pending at that time. Owen's subsequent retest is recorded below.

## Post-review navigation handoff physical retest — 6 October 2026

**POST-REVIEW I1 NAVIGATION HANDOFF PHYSICAL RETEST PASSED.** Owen reports testing fix commit **22c761dbd064c376bb610a3cbb72de4820abb642** on a physical iPhone through Expo Go/Metro, on `feat/manual-update-reconciliation`. Ordinary downloaded-chapter reading and passage restoration still worked. Previous / Next / Contents / Library navigation worked normally with no update active. During Check for Updates, Read and Library navigation were blocked, native Back / swipe-back could not leave Story Contents, and Cancel remained available. After Cancel, navigation stayed blocked until the operation settled, then normal navigation returned. Opening a downloaded chapter afterward showed coherent navigation and restored passage. A subsequent normal Check for Updates completed, with ordinary navigation and gestures restored normally.

**Resume Download was not physically exercised:** the tested real stories were fully downloaded and did not display that control. Deterministic tests cover its disabled-during-operation behavior. **Natural live-source mutation cases remain physically unexercised:** new chapter, rename/reorder, removal, saved-unlisted reading and reappearance. The physical retest does not establish the exact held-COMMIT interleaving or delayed SQL-refresh timing; those remain automated evidence. This is Owen's reported device evidence, not an agent-operated iPhone run or wire inspection. Core I1 acceptance remains passed; S2B remains deferred and full v0 is incomplete.

This follow-up changes only the two I1 documentation files to record the reported retest. No production code, tests, dependencies, lockfile or new milestone changes are included; no live SpaceBattles requests are made by this bookkeeping pass. PR #5 remains unmerged. No merge or next product slice is authorized.
