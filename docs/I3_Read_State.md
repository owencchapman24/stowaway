# I3 — Read/Unread + Progress State

Implementation candidate, **7 October 2026, America/New_York**. Branch `feat/read-state`, base merged main **0518dd19ddd6053ef238dfb44ecbbe2961dece39** (PR #6 / I2). Node **22.23.3**, npm **10.9.9**, Expo SDK **57**; dependencies and lockfile unchanged. The [October audit](Stowaway_October_2026_Groundwork_Audit.md) remains controlling. Owen explicitly selected I3, superseding the previous current-status prohibition on starting read state.

**I3 IS NOT PHYSICALLY ACCEPTED.** All [I3 device checks](I3_Device_Checklist.md) are pending Owen's report. S0/S1/S2A are accepted; I0/I1/I2 are accepted and merged in PR #4/#5/#6. Historical evidence and its unexercised cases remain unchanged. S2B is deferred; full v0 is incomplete. No PR creation, merge or next milestone is authorized by this implementation request.

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

Opening, ready, restoration, programmatic scrolling without scrolling input, layout/restyle, image load/error/reflow, resize, background/pagehide and flushing do not independently complete a chapter. Restyle/restore clears the scrolling window; image load/error and viewport/height changes invalidate it. The threshold and gesture behavior need actual WKWebView acceptance, especially momentum/short chapters, restored end, selection and accessibility interaction; deterministic DOM geometry is not native proof.

The normal route supplies optional `onReachedEnd={repository.markChapterRead}` to the reused ChapterReader. S2A omits it. `ReadEndSession` admits only a ready completion, starts one local save and ignores duplicate events. Its pending write is awaitable; failed writes remain retryable on explicit exit. Exit flush waits for both read-state and locator writes, asks the WebView to flush, and then waits again for messages received during that handshake. Next/Previous/Contents navigation happens only after settlement. Read failure reports a local error and holds navigation for retry; locator writes settle independently and text stays readable. Last completed commits remain the durability boundary for an abrupt process kill.

## Manual correction and refresh

Every current and downloaded saved-unlisted Contents row shows textual **Read/Unread** plus **Mark Read/Mark Unread**, with an accessibility label naming the chapter. Pending text can be corrected. A manual write locks other local/source actions and navigation through the final authoritative SQL refresh; existing update/image locks also disable manual actions through settlement/refresh. Synchronous refs guard retained handlers, and focus/read-version guards discard stale route/refocus reads. Successful correction refreshes counts and states from SQLite; storage failure preserves the old authoritative flag, reports an error and permits retry. Opening Library/Contents performs local reads only.

## Deterministic evidence and validation

All automated source transports use original synthetic fixtures. Coverage includes populated v4 preservation/rollback, all historical migration paths, isolated S2A v1, pending/body/duplicate import and cancellation/resume, current-only counts, idempotent/manual/automatic failures and story isolation, unchanged/rename/reorder/append/insertion/removal/reappearance and cancelled/failed upserts, real source-image repair/regeneration independence, close/reopen and abrupt committed/uncommitted host-process exit, ~1,000 entries, exact bridge validation and trusted input/false-completion geometry, and real SQL with mocked native UI/WebView for correction, operation refresh, route ownership and immediate reader exits. Host process-exit recovery is a persistence seam, **not an iPhone force-quit pass**.

Final validation on Node **22.23.3** / npm **10.9.9**:

| Command | Result |
| --- | --- |
| `npm.cmd run check` | Strict TypeScript, lint and **540 tests / 26 suites passed**. **71 added cases**, all 469 baseline cases retained. |
| `npx.cmd expo install --check` | Dependencies up to date. Sandbox metadata access initially failed with EACCES; approved rerun passed without package changes. |
| `npx.cmd expo-doctor@latest` | **21/21 checks passed** using approved package metadata/cache access. |
| `npx.cmd expo export --platform ios` | Local iOS Hermes bundle, **1,249 modules**, plus bundled assets exported to ignored `dist/`. No signing/build service. |
| `git diff --check` | Passed; staged additions also checked before commit. |

The separate sequential completed-diff/security review checked every entry insertion/upsert, migration rollback and SQL joins, pending/current/saved counts, cross-story writes, bridge identity/trust/layout guards, save failures and immediate navigation, manual/source/image settlement/refocus, S2A reuse and local-only behavior. It tightened retained manual handlers to resolve currently displayed identities while preserving explicit Mark Read/Unread intent, rejecting an entry hidden after a pending removal. It also invalidated scrolling engagement on link/spoiler-summary actions. Added regressions hold a pre-correction refocus read, exercise retained actions, and prove legacy image discovery/repair preserves progress. Final inspection found no remaining blocking defect; this was a sequential review in the implementing session, not independent-agent/native certification.

Initial new test failures corrected harness assumptions: real UUIDs are supplied to old mocked WebView tests under strict message-shape validation; synthetic gesture events carry their event type; immediate Next has a downloaded successor; and the legacy-image fixture uses the importer's canonical wrapper rather than deliberately mismatching saved text. Historical v3→v4 migration coverage now explicitly targets v4, while latest/newer version expectations advance to v5/v6. Existing assertions and timeouts were not weakened. A nullable captured-value TypeScript check was resolved with a narrowed closure. Native UI test timers are drained under `act`; no warning suppression is added. Node's experimental SQLite and Metro color warnings remain informational.

Physical SQLite/WKWebView, actual iPhone gestures, force-quit and already-running offline checks remain pending. No live SpaceBattles requests occurred in implementation/review. Expo metadata validation and GitHub traffic are separate from source traffic. The export is compilation evidence, not S2B.

## Exact changed-file inventory (24 files)

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

Read state is local and independent of text/images/locators. No deletion, search, categories/sites, bookmarks, statistics, backend/sync/accounts, scheduled/automatic update or image work, S2B, EAS/signing/cloud/paid work, PR creation or merge is included. The authorized stopping point is the pushed implementation candidate; Owen supplies physical results before PR work or any subsequent milestone.
