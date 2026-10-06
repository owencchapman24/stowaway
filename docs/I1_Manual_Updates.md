# I1 — Manual Updates + Safe Reconciliation

Implementation candidate: **6 October 2026, America/New_York**. Branch: `feat/manual-update-reconciliation`, clean base **181feecd1e4ae4f14f86b862757246d60114956b**, merged main including I0 PR #4. Fetch confirmed `origin/main` at that base. Environment: Node **22.23.3**, npm **10.9.9**, Expo SDK **57**; dependencies/lockfile unchanged. The [October audit](Stowaway_October_2026_Groundwork_Audit.md) controls v0. Owen explicitly selected I1, replacing current I0 instructions against manual updates.

**I1 is implemented but NOT physically accepted.** Owen must report [the I1 device checklist](I1_Device_Checklist.md). S0/S1/S2A/I0 remain accepted from his earlier reports, I0 is merged, S2B remains deferred and full v0 is incomplete. Historical evidence documents are unchanged.

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

Contents shows checking/reconciling/downloading progress, Cancel, concise update result, typed source/storage/busy failures, both timestamps and Resume when current text is pending. No Check action is shown for the synthetic fixture. Leaving/backgrounding aborts active work. Story and Resume components are keyed by stable route identity; Contents also invalidates stale local reads and tracks focus/operation ownership. Late results, progress and actions cannot attach to another story. A retained outcome claiming another story is rejected.

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

No old-body edit detection/re-fetch, revision history, source images, read/unread, deletion, extra categories/sites, auth/accounts, backend/sync/search, RSS/notifications or automatic/scheduled/background updates. No S2B, EAS/signing, Apple/App Store, cloud build or paid work. No PR creation or merge. Public/commercial, republication and App Store authorization remain unresolved separately from Owen's personal scope.

Known deferred technical follow-ups remain **global `PRAGMA foreign_key_check` validation performance** and **S1 diagnostic request-budget accounting under concurrent source traffic**. Their code is unchanged; I1 has not measured or solved either. No timing-based CI assertion was added. Physical iPhone migration/update/cancellation/reader/offline behavior and native wire headers/cookies/cache remain unverified for this candidate.
