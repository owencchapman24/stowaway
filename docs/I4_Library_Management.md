# I4 — library management, deletion and v0 error polish

Implementation: **7 October 2026, America/New_York**, `feat/library-management`, based on merged I3 main **beb9bab8513053c84bb01b05747529a4b63e2ab9** (PR #7). The October audit controls. **I4 physical acceptance is pending.** Historical I0–I3 evidence is unchanged; the I3 post-acceptance recovery/handoff fixes retain deterministic evidence only. S2B remains deferred, the final Astra whole-repository audit follows v0 feature work, and full v0 remains incomplete. This candidate may be committed/pushed; no PR creation or merge is included.

## Storage and migration

Normal storage advances to **v6** with exactly one schema addition:

```sql
ALTER TABLE chapters ADD COLUMN body_available INTEGER NOT NULL DEFAULT 1
  CHECK(body_available IN (0, 1));
```

The existing exclusive migration transaction preserves every old row and initializes all existing bodies, including fixture chapters, as available. There is no table rebuild, storage reset, cascade change, locator migration or inference of Read from progress. Fresh/v1/v2/v3/v4/v5 migration, populated v5 rollback/retry, constraints and future-version rejection have real host-SQLite tests. The historical v4-to-v5 test explicitly continues targeting v5; tests of the latest schema now expect v6. S2A continues calling `migrate(db, 1)` on its exact isolated resources and never receives the new column.

Chapter rows serve as stable identity/FK targets for `reading_positions` even when their body has been removed. `body_available = 0` means an unavailable shell. Remove Downloads clears HTML, body hash, sanitizer version, block IDs and links, deletes every chapter-image slot/reference for the story (current and historical), and resets image discovery to unknown. The retained locator still holds the old hash, block/offset, progression, expanded spoilers and save time exactly. Empty shell HTML is never treated as readable content.

Availability is checked in Library/story counts, Contents download flags, saved-unlisted lists, reader navigation/listing, `getChapter`, last-readable-chapter lookup, locator validation, automatic Read completion, content replacement, image listing/work/summaries and discovery/result commits. Manifest reconciliation counts use availability too. Historical v1–v5 callers use the prior availability rule, without exposing I4 management there. Source-reference cleanup deliberately sees **all** committed references, including other stories and saved-unlisted rows.

## Two separate actions

**Remove Downloads** keeps the story in Library. It retains source/thread/post identity, story title/author/source/category, the committed primary manifest and current/unlisted membership/order/labels, each entry's Read/Unread flag, exact reading positions, and attempt/success timestamps. Current downloaded count becomes zero; total/unread counts do not change. All current entries are Not downloaded and cannot open. Removing downloads again is safe and idempotent. Manual Read/Unread correction of pending current entries remains available.

Downloaded saved-unlisted copies cease being locally readable and disappear from the saved-local group. Their chapter shell, manifest identity, Read state and locator remain internally. A later COMPLETE reconciliation can reactivate the same post ID and explicitly download it without resetting those states. No unavailable unlisted shell is counted as downloaded or queued by Resume.

**Remove Story and All Local State** deletes the selected imported story's image rows, reading positions, chapters/shells, current and historical manifest entries (including Read flags), then story metadata/timestamps in one transaction. Settings and the global fixture asset table are untouched. No per-story state is stored elsewhere in the current schema. The story disappears from Library; an old route only reports that it is missing. Stale update/body/read/locator/image calls cannot recreate it. A later deliberate Add Story starts a fresh manifest with Unread entries, no locator and no update history.

This is application-visible deletion, **not forensic secure erasure** of SQLite pages, device backups or unused filesystem blocks. There is no VACUUM or secure-delete promise.

## Confirmations and ownership

Imported-story Contents has a separated footer after the chapter list, with labeled destructive controls and explanatory copy. Fixture contents exposes neither production removal action. Native `Alert.alert` supplies Cancel and explicit Remove Downloads. Full removal first explains all local state to be removed, then requires a **second explicit destructive Remove Story confirmation**, naming the story again. Cancel or dismissal preserves everything.

A synchronous route-specific confirmation/operation token prevents rapid duplicates and rejects old callbacks after blur/unmount/route replacement. The native wrapper and repository capture source/thread identity immediately, so a queued call cannot be redirected by mutation of the caller's object. The repository independently verifies canonical source/thread ID against the actual stored row inside the transaction and rejects fixtures, missing stories, mismatches and non-v6 databases. Missing stories are never silently recreated.

The existing same-story owner now also covers management. Local Read and locator writes register with that owner boundary, including queued writes; source/management operations exclude them. Contents observes ownership across repository handles with a small subscription on the existing owner set, without adding a state library. Same-story source/image/read work disables management and navigation; other stories remain independent. Each operation holds its owner through the authoritative refresh. Management also holds it through post-commit cleanup, including cleanup retry. Disabled controls have synchronous retained-handler guards, and native back/gesture removal is prevented through settlement. Backgrounding does not undo an already-started local removal transaction.

## Files, commit ordering and crash recovery

1. Inside the transaction, capture distinct source-image paths referenced by the selected story.
2. Mutate/delete SQLite state, run the existing FK validation and commit.
3. Only after successful COMMIT, clean captured source paths against a new snapshot of **all** committed source references.
4. Clean safely identifiable disposable renders for the selected story, then refresh authoritative screen state before releasing ownership.

Source cleanup extends I2's existing generated `source-assets/UUID.(png|jpeg|webp)` path checks, shared root lock and staged-file protection with an optional candidate list. Initial removal only considers captured paths. Shared references, another story's files, active stages, directories, foreign names, fixture `assets/` and S2A resources survive. Cleanup retry is explicit and may reuse I2's safe generated-orphan scan. No launch/screen opening or timer initiates cleanup or source/image work.

New imported-story renders have a small versioned `owner.json` beside disposable HTML/copies. Cleanup validates the UUID directory, exact marker shape/story/chapter identity and a strict generated-child allowlist. Reference-counted protection covers generation through delivery to the live renderer, releasing on disposal. Other/active/foreign render output and S2A/fixture renders are protected. Legacy render directories without an ownership marker cannot be safely attributed and are retained; no blanket reader-directory wipe is performed.

Pre-COMMIT failure rolls back every database change and makes **zero filesystem cleanup calls**. Existing bodies/references/files stay usable. A kill after COMMIT but before cleanup can leave harmless unreferenced files; it cannot leave retained DB rows pointing at files deleted by this operation. A cleanup failure reports logical removal success plus a bounded local warning and Retry local cleanup, even after full story removal. It never restores references, recreates a deleted story or describes the committed removal as a DB failure. Source orphans can also be recovered by the existing safe cleanup during later deliberate image work. No background cleaner is added.

## Explicit redownload and image behavior

Library/Contents opening remains local-only. Resume Download and duplicate Add Story use the saved primary manifest and fetch only current missing bodies; they do not implicitly check the index. A shell is updated in place with the new canonical body and normal body-time image descriptors, with availability set to one in the same transaction. The entry's Read state and locator are untouched. Transaction failure leaves the shell unavailable and rolls back all body/discovery changes.

The existing bridge receives the saved locator unchanged. Equal canonical hashes allow normal same-version block restoration. Different hashes use the established progression fallback; the code never rewrites an old locator hash to manufacture an exact match. I3's opening/restoration/typography false-completion protections are unchanged.

Check for Updates still stages/reconciles a COMPLETE same-thread manifest, then downloads current missing text as already authorized by I1. Removed old bodies count as missing in this deliberate flow. Available old bodies are still never re-fetched for edit detection. Unlisted missing shells stay out of current queues. Body-time image discovery restarts normally after redownload; explicit Download/Retry Images only sees available current bodies. After removal, summaries cannot claim old local files, pending slots or legacy scans. No image work starts on screen opening.

## Failure presentation

Typed codes/details remain visible. A small shared explanation accompanies them in Add Story and Contents, including image failures:

| Failure | User-facing meaning |
| --- | --- |
| blocked / challenge | Source access blocked; requests stopped, no access/login bypass retry. |
| incomplete | Primary index incomplete; previous complete contents retained, not “no updates.” |
| parser / unsupported-structure | Content could not be parsed safely; retained local content stays usable. |
| network / transient | Request failed; earlier local commits retained; retry deliberately. |
| storage | Local storage failed; earlier successful commits retained. |
| busy / unsupported-url / cancelled | Operation settling, unsupported source/identity, or user stop, respectively. |

Removal rollback explicitly says removal was not saved and prior local data/downloads were retained. Missing/changed identity has separate truthful wording. Post-commit cleanup warning says removal completed and unused local files remain. Library/local Contents read failures identify local storage. No source prose or telemetry is logged, and no new error framework or network retry behavior is introduced.

## Deterministic evidence and validation

New tests: `tests/integration/i4-management.test.ts` and `tests/integration/i4-ui.test.tsx`. They use actual host SQLite, generated raster files and original synthetic source pages/injected transports; native Alert/router/Expo seams are mocked in UI tests. Device SQLite/WKWebView/Alert behavior is not certified by those mocks.

| Requested risk matrix | Evidence |
| --- | --- |
| Remove Downloads 1–24 | Preserved exact metadata/entries/flags/locator rows/timestamps, zero readable/current downloads, cleared slots/summary/work, post-COMMIT file ordering, isolated/shared/staged/foreign assets, rollback/idempotence/cleanup failure, explicit resume with same/changed hash, body-time discovery and reappearing saved-unlisted identity. |
| Full deletion 25–37 | Both confirmation stages and cancellation; actual child-table deletion, Library/stale route behavior, other-story/settings/fixture/S2A preservation, rollback and cleanup warnings, rejected stale mutations and fresh Unread import. |
| Ownership/UI 38–42 | Source/image/manual and cross-handle ownership, controls/back guards through commit + refresh and blur/refocus, duplicate action suppression and story-specific retained callbacks. |
| Errors 43–49 | Add Story/Contents blocked/challenge/incomplete/parser/network/storage presentation, no misleading Up to date, actual removal rollback and post-commit cleanup warning/retry. |

No physical I4 run is claimed; follow [the device checklist](I4_Device_Checklist.md).

Final validation on **7 October 2026**, Node **22.23.3** / npm **10.9.9**:

| Command | Result |
| --- | --- |
| `npm.cmd run check` | TypeScript, lint and **638 tests / 28 suites passed**. All 579 previous tests retained; **59 added** (30 management/SQLite/file cases, 29 UI cases). |
| `npx.cmd expo install --check` | Dependencies up to date; package/lockfile unchanged. |
| `npx.cmd expo-doctor@latest` | **21/21 passed**. |
| `npx.cmd expo export --platform ios` | Local Hermes export passed, **1,254 modules**, to ignored `dist/`. |
| `git diff --check` | Passed; staged diff also checked before commit. |

Expo metadata/npm registry checks first encountered sandbox EACCES and passed with the required network access. No SpaceBattles request was made. Generated output is uncommitted. Node's experimental host-SQLite notice and Metro color-environment notices are informational. The final suite has no React act warnings.

## Separate sequential review

After the initial completed candidate passed full checks/export, a separate sequential self-review traced every chapter-row-existence query, locator FK retention, same/changed-hash redownload, current/unlisted reconciliation, FK deletion order, source/image cleanup snapshots and staged/shared files, rollback, native confirmation callbacks, cross-handle ownership, blur/refocus and final refresh, fixture/S2A isolation and truthful failure wording. This is a scoped diff/security self-review, not an independent agent review, physical certification or the deferred Astra whole-repository audit.

Findings/fixes included immediate identity snapshots for queued destructive calls (with an actual queued-write/object-mutation regression); an Add Story missing-prefill error update outside its active-screen guard; and propagation of render-marker I/O failure into the post-commit cleanup warning instead of treating it as an unidentifiable marker. Regressions also exercise failed shell repopulation, partial cleanup after one file was removed, and nested render-generation/live-owner protection. The implementation pass separately corrected the S2A render allowlist regression by tagging only imported-story renders, and restored README setup text after a CRLF-sensitive status edit. No historical evidence or previous test was removed. Targeted post-review tests and final full validation passed. No remaining blocking defect was identified in this review.

## Performance and boundaries

Removal uses batched SQL updates/deletes and one transaction per action, plus a distinct path capture and linear candidate cleanup. No per-chapter deletion transaction or obvious quadratic deletion loop is introduced. Render inspection is linear in existing render directories. Existing global `PRAGMA foreign_key_check` code remains unchanged; I4 adds no per-row FK checks and generally reduces referenced rows, but does not claim measured performance improvement. Concurrent S1 diagnostic request-budget accounting is unchanged; its prior-image baseline still applies.

No live SpaceBattles requests, automatic source/image jobs, additional categories/sites, backend/sync/accounts, search, backups/exports, scheduling, notifications, analytics, S2B, EAS/signing/paid build, Astra whole-repository audit, PR creation or merge. Unmarked legacy disposable renders are intentionally left for safety. Native confirmation/accessibility, v5-to-v6 preservation on the existing phone library, physical relaunch/offline deletion/redownload, genuine saved-unlisted mutations, native failure recovery and interrupted cleanup remain unverified until Owen reports them.

## Candidate file inventory

Exactly 27 files, relative to the repository root:

```text
AGENTS.md
README.md
docs/I4_Device_Checklist.md
docs/I4_Library_Management.md
src/app/add-story.tsx
src/app/index.tsx
src/app/story.tsx
src/images/download.ts
src/images/files.ts
src/images/repository.ts
src/importing/failure-presentation.ts
src/importing/import-story.ts
src/importing/ownership.ts
src/reader/controls.tsx
src/storage/availability.ts
src/storage/files.ts
src/storage/local-files.ts
src/storage/management-native.ts
src/storage/management.ts
src/storage/migrations.ts
src/storage/render-cleanup.ts
src/storage/repository.ts
tests/integration/i0-import.test.ts
tests/integration/i2-images.test.ts
tests/integration/i3-read-state.test.ts
tests/integration/i4-management.test.ts
tests/integration/i4-ui.test.tsx
```

No dependency/lockfile, source-request/parser/sanitizer, trusted bridge, S1/S2A implementation or generated build output changes are intended.
