# I0 — persistent SpaceBattles import and offline text reading

Implementation date: **5 October 2026, America/New_York**. Started on clean `main` at **11d6e43a77aa92c3f3e232c2c5534f3b60c36537**, the expected PR #3 S2A merge, with `owencchapman24/stowaway` origin. Fetch and fast-forward pull confirmed main was current. Implementation branch: **feat/spacebattles-import-slice**. Actual environment: system Node **22.23.3**, npm **10.9.9**, existing Expo SDK **57** dependency graph and lockfile unchanged.

**I0 implementation is ready for Owen's physical test; I0 physical acceptance is pending.** S0/S1/S2A retain their user-reported accepted status. **S2B remains deferred**: Expo Go/Metro relaunch and already-running local reading do not prove independently installed, Metro-free offline cold start. No phone was operated by the agent.

## Persistent model and migration

The normal `stowaway-s0.db` now uses schema **v2**. A single exclusive transaction creates v1 on fresh storage if necessary, adds `stories.source_url` and `stories.primary_category_id`, creates `threadmark_entries` and backfills existing chapters into ordered manifest rows. Existing story/chapter IDs, canonical bodies/hashes/sanitizer versions/block IDs/links, reading positions, timestamps, settings and the harbor asset reference remain untouched. Backfill orders by existing position/ID and assigns contiguous manifest positions without changing chapter metadata. Repeat migration is a no-op; a newer database fails safely. There is no reset, delete/reseed or automatic download.

`threadmark_entries` stores only story ID, numeric post ID, title, source position and observed public retrieval URL. Its primary key is `(story_id, post_id)`; positions are unique within a story. Source/category identity belongs to the story. Chapter bodies remain separate, keyed by stable story/post identity. LEFT JOINs derive downloaded counts/status from body existence; there is no competing progress ledger. Missing author is stored as the existing non-null column's empty string and exposed as `null` / **Author unavailable**. Missing author never fails import.

Fresh fixture seeding creates its three manifest rows with conflict-safe inserts. Existing v1 fixture bodies, asset and preferences survive migration. The real SQLite migration test builds the historical v1 schema, stores a locator/preferences/asset and renamed/reordered chapter metadata, migrates twice, and compares all body rows and saved state without reseeding.

The S2A diagnostic deliberately continues creating/inspecting its isolated **v1** database via `migrate(db, 1)`. It receives no automatic migration, repair or source traffic. Its exact directory guards, inspection-before-mutation rules and checkpoint behavior remain intact. Normal v2 APIs are not invoked against S2A v1.

## Initial import sequence

1. A deliberate Import tap validates/canonicalizes the selected public HTTPS thread URL using S1 identity logic.
2. Stable source/thread identity acquires an in-memory operation lock shared across import/resume screens and repository handles.
3. If already stored, use the committed manifest: resume only missing bodies, or report complete with **zero source requests**. I0 does not check for updates or replace metadata/order.
4. For a new story, fetch the ordinary public root and parse its unique `h1.p-title-value`; take author only from the thread's `p-description` username when unambiguous. Never infer it from later posts or request a profile.
5. Reuse S1's complete primary category, pagination/range traversal and count/continuation validation. FAILED/INCOMPLETE stops without persisting a story or partial manifest.
6. Atomically commit story metadata and all COMPLETE primary entries. Storage failure rolls back both. Existing stories are left alone.
7. Iterate primary entries in source order, skip existing bodies, fetch their observed URLs, verify/extract the exact post, sanitize/hash, then atomically insert the chapter's HTML/hash/version/block IDs/links together. Conflict-safe insertion does not replace existing content or locator state.
8. Report downloaded/total counts and completion, cancellation or typed failure. Release raw documents and operation ownership.

The operation keeps at most one cached source document plus the transient root during manifest discovery. Consecutive links to the same normalized document reuse it; redirects must pass the S1 route checks. Index documents are discarded before body download. The validated root is reused only if the first primary entry's observed document URL matches it; it is released when the queue leaves that document. There is no entire-story HTML cache, fixed Reader page size, numeric URL arithmetic, batching framework or new network stack.

## Cancellation, restart and errors

Cancel, leaving the import screen and backgrounding request cancellation. Cancellation is checked before queued requests, after fetching/preparing and inside the chapter transaction. An unfinished chapter rolls back; a transaction that has already committed remains downloaded. A real process kill may retain the last completed chapter, independently of the UI's last displayed count. The authoritative count is always SQLite after reopening.

Later **Resume Download** reads the stored manifest/URLs and skips existing bodies without requesting a new index. Reopening screens or editing/pasting a URL performs no source requests. No automatic clipboard access, automatic resume, scheduled work or background-completion promise exists. The module lock prevents simultaneous same-story import/resume mutations; stable database constraints prevent duplicate stories, entries and bodies. Other stories and S1 may queue source requests through the same client, serially.

Network, transient, blocked/challenge, unsupported URL/structure, parser/incomplete, cancellation, storage and busy failures are explicitly reported. Completed text remains readable after failure. Retry is explicit. The original source client stops on 401/403/login/challenge/interstitial and performs only bounded transient/timeout retries with Retry-After handling. Nothing logs real prose or raw documents.

## Shared source policy and content boundary

`sourceClient` in the existing SpaceBattles native module is the **single native RequestClient** used by S1 and I0. The request layer remains unchanged: honest Stowaway User-Agent where supported, credentials omitted, no cookies/session copying/authentication, checked public paths and redirects, one document request/body consumption in flight, at least two seconds between request starts, existing retry/response budgets and cooldown. Utility/private/attachment routes remain excluded.

The [historical policy review](S1_Source_Policy.md) is preserved. Owen's explicit I0 request extends the personal feasibility scope to downloading selected public story text for personal offline reading. It does not establish affirmative site permission, public/commercial or App Store authorization or republication rights. No broad policy research or live desktop probe was performed for I0: **zero desktop SpaceBattles requests**.

Body extraction shares the proven S1 exact numeric article mapping. Selected-thread identity must be present and conflicting thread identity fails. Article ID/data-content must agree, there must be exactly one matching article and exactly one message-body/bbWrapper, and any exposed category markers must match primary identity. S1 sampling still requires an explicit primary marker. Signatures, neighboring posts and forum chrome are outside the extracted body. Raw extraction stays transient and always passes through the existing explicit allowlist sanitizer before persistence.

Recognized XenForo spoiler containers become nested native `details`/`summary` content for the existing reader. Relative links resolve against the fetched public URL, then pass the existing HTTPS safe-link allowlist. Direct inline text/BR runs become paragraph-sized local blocks, preserving existing block markup, so plain XenForo bodies do not use one chapter-sized locator. Bodies with no readable sanitized text fail. Source scripts, handlers, arbitrary CSS and active embeds never survive. Hash/version/block IDs/links remain deterministic and commit with HTML.

**Text downloaded/offline. Source images are not downloaded in I0.** Every source image, including an attempted `fixture://` image, becomes the existing explicit omitted-image placeholder. No image/attachment request, source-image file, remote WebView image or media-complete claim is added. Chapter-aware bundled-asset lookup returns harbor only for the original fixture identity; real chapters receive no fixture image.

## Library, contents and reader

Library shows one row per story, title, available author, downloaded text/total primary counts, Add Story and a pending-download indication. S1/S2A appear separately under Development diagnostics in `__DEV__`. Contents lists one story's ordered manifest; missing bodies are labeled **Not downloaded** and disabled. Resume opens the Add Story screen using stored metadata without fetching until tapped. Source links open only on deliberate action. Development contents exposes numeric post IDs for manual comparison.

The existing ChapterReader reads SQLite HTML, locator and global preferences, regenerates disposable local render files and loads its existing trusted WebView/position bridge. It queries navigation chapters for the current story only and routes Contents back to that story. Previous/Next navigate among already downloaded bodies; there is no source access, second reader or change to the position/reflow protocol. Fixture image and S2A asset lookup remain usable. S0/S1/S2A assertions were not weakened.

## Automated verification and sequential review

Added original generated XenForo-like fixtures only. Coverage includes title/author/unknown author; exact body/thread/category/ambiguity rejection; formatting/nested spoilers, relative safe links, scripts/handlers, omitted images and deterministic block/hash output; real v1 → v2 SQLite preservation; COMPLETE-only commit/rollback; partial cancellation, unfinished-body cancellation, close/reopen and missing-only resume; network/parser/storage failure retention/retry; stable locks/idempotency and shared diagnostic/import queue; story-specific listing/assets; roughly **1,000 entries** with coherent order/counts and locator preservation after metadata rename; Library/import/contents actions, typed failures/background cancellation and reader routing/navigation bounds.

Final commands/results on Node 22.23.3 / npm 10.9.9:

```text
npm.cmd run check                   Strict TypeScript + lint + 148 tests / 17 suites passed
npx.cmd expo install --check         Dependencies are up to date
npx.cmd expo-doctor@latest           21/21 checks passed
npx.cmd expo export --platform ios   Local iOS Hermes bundle + harbor.png exported to ignored dist/
git diff --check                    Passed
```

The 31 added cases across four suites include the real host-SQLite migration/import suite; all 117 original cases remain. Initial test-harness corrections addressed Jest dynamic imports, typed AppState listeners and a fake native View ref lacking the WebView flush API; no old assertion was removed or relaxed. React list timers are flushed within `act` in the new screen suite. Host SQLite/WebView mocks are not physical iPhone evidence. The unchanged CI runs generated fixture tests only; its display name is now **Stowaway checks**.

The first Expo compatibility/Doctor attempts failed on sandbox network/cache permissions (`EACCES`); the same requested checks passed when rerun with approved metadata access. No dependencies or lockfile changed. The local export rebuilt an unreadable Metro cache through its automatic full-crawl fallback and succeeded; Node's experimental host SQLite warning and Metro color-environment warnings are informational. These commands performed no SpaceBattles requests and no cloud build.

A separate sequential diff review followed the first green full check/export. It inspected migration/backfill/fixture preservation, foreign keys and transaction boundaries, COMPLETE-only persistence, partial state/cancel/resume, duplicate avoidance, current-story navigation/assets, source-only sanitization, the single native queue, fixture-only CI and normal/S2A isolation. Review fixes give direct text/BR bodies paragraph-sized locator blocks, reject sanitized bodies without readable text and reuse a validated root when the first observed entry targets it. Regression tests cover these findings. The full check and iOS export were rerun successfully after the final code change. Every new source/test/document was inspected before staging; no real capture, credentials or build output is included.

Changed files: Library/reader routes and new `add-story.tsx`/`story.tsx`; `domain/types.ts`; `storage/migrations.ts`, `repository.ts`, `context.tsx`; existing `ChapterReader.tsx` and new shared screen styles; SpaceBattles `parse.ts`/`native.ts` and two new `importing/` modules; the one-line S2A schema-target change; four I0 test suites and `tests/fixtures/import.ts`; the two I0 documents, narrow README/AGENTS updates and CI display name only. Historical acceptance/source-policy records, sanitizer/bridge, request policy, dependency files and original tests are unchanged.

## Remaining limits and handoff

Follow the [I0 device checklist](I0_Device_Checklist.md) using Story A. Actual title/author extraction, all 25 real body matches, formatting, cancellation timing, device SQLite migration, locator restore, already-running network-disabled reading and absence of reader source traffic require Owen's results. There is no agent-operated iPhone run or native wire-level inspection. S1 source structure can change; COMPLETE is coherent observed traversal, not an atomic website snapshot.

No manual updates/reconciliation, body edit checking, read/unread, deletion, extra categories/sites, source images, EPUB, search, accounts, backend, sync, RSS, notifications, production polish, EAS/Apple signing/build service, paid action or S2B was added. No real source bodies/raw pages/captures, credentials or build outputs are committed. No PR is created or merged. Stop after the reviewed implementation commit/push for Owen's physical I0 acceptance.
