# I0 — persistent SpaceBattles import and offline text reading

Implementation date: **5 October 2026, America/New_York**. Started on clean `main` at **11d6e43a77aa92c3f3e232c2c5534f3b60c36537**, the expected PR #3 S2A merge, with `owencchapman24/stowaway` origin. Fetch and fast-forward pull confirmed main was current. Implementation branch: **feat/spacebattles-import-slice**. Actual environment: system Node **22.23.3**, npm **10.9.9**, existing Expo SDK **57** dependency graph and lockfile unchanged.

**CORE I0 PHYSICAL ACCEPTANCE PASSED.** Acceptance recorded **5 October 2026, America/New_York**, from Owen's supplied physical-iPhone report for the I0 implementation checkpoint **d09ff85518a08fa002c28861666125643e047753** on `feat/spacebattles-import-slice`. Testing used Expo Go and Metro. These are user-reported device results, not an agent-operated phone run or independent inspection. S0/S1/S2A retain their accepted status. **S2B remains deferred**: Expo Go/Metro relaunch and already-running network-disabled reading do not prove independently installed, Metro-free offline cold start. Exact iOS/Expo Go versions remain unconfirmed.

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

## Physical iPhone acceptance — Owen's reported results

### Migration and existing fixture — reported passed

The actual normal v1 database migrated to v2 on Owen's physical iPhone **without reset**. The Lantern Cartographer remained present at exactly **3/3** downloaded chapters; its existing passage and preferences remained usable, the bundled harbor image remained available and normal fixture navigation continued to work. This is physical evidence of preservation of the existing local fixture state, separate from the host-SQLite migration test.

### Story A — complete import, reading and idempotency reported passed

[Normal Isn't Ordinary [Pokemon SI]](https://forums.spacebattles.com/threads/normal-isnt-ordinary-pokemon-si.1234421/) imported successfully with **25/25 primary text chapters** and persisted in Library. Title parsed as **Normal Isn't Ordinary [Pokemon SI]** and author as **sabhnc**. Primary contents/order matched the previously verified S1 source; this report does not add a fresh exhaustive post-ID audit beyond Owen's supplied comparison.

Real chapter text rendered through the existing normal reader, without the fixture harbor image. Previous/Next stayed within this real story and Contents returned to its own contents screen. Real chapter position restoration worked across typography/theme changes, leave/reopen and force-quit/relaunch through Metro. Already-downloaded chapters remained readable with phone networking disabled **while the Expo Go project was already running**. Re-importing the same completed URL neither created another story nor restarted a fresh body download.

### Story C — cancellation, real restart and resume reported passed

[Eyes Open](https://forums.spacebattles.com/threads/eyes-open-pokemon-fanfic.1129205/) began from a **COMPLETE 34-entry primary manifest**. Owen deliberately cancelled after **four** bodies committed. Import reported Cancelled, committed text retained, **4/34**, and Resume Download available. Library showed **Eyes Open (Pokemon Fanfic)**, author **ViridiMayai**, **4/34**, and the pending-chapters message.

Contents showed exactly the committed early entries as Text downloaded; subsequent entries were Not downloaded with disabled controls. A downloaded chapter opened/read successfully while partial. At the partial boundary, **Next was disabled** when the next primary entry was not downloaded, with no fake/empty chapter.

Owen force-quit Expo Go and relaunched through Metro. The same committed partial story persisted at **4/34**, download did not start automatically and previously committed chapters remained locally readable. Owen explicitly resumed; missing work completed to **34/34**. The final story remained one logical Library entry and its real text rendered successfully. Implementation/tests establish missing-only requests; the phone report establishes visible persistence/resume behavior, **not packet-level proof that prior bodies were never requested again**.

### Final Library and normal-reader result — reported passed

| Story | Downloaded / primary total |
| --- | ---: |
| Eyes Open (Pokemon Fanfic) | 34 / 34 |
| Normal Isn't Ordinary [Pokemon SI] | 25 / 25 |
| The Lantern Cartographer | 3 / 3 |

No duplicate real story appeared. The synthetic fixture remained intact; S1/S2A stayed development-only diagnostics. Real Eyes Open examples **Prologue**, **Chapter 3: Trespassing** and **Chapter 12: Racketeering** rendered readably through the normal reader. Standard font/theme controls, Previous/Contents/Next and persistent locator behavior worked. Chapter titles here are metadata only; no story prose or screenshot capture is retained in Git.

The demonstrated user loop is: paste a public SpaceBattles thread URL → retrieve a COMPLETE primary manifest → persist story/manifest → download sanitized text → cancel with completed bodies retained → survive app restart → explicitly resume only missing work → complete the story → read local real chapters → preserve reading position → avoid duplicate story creation. Story A establishes the complete reading/idempotency path; Story C establishes the deliberately partial cancellation/restart/resume path. See the [reported acceptance checklist](I0_Device_Checklist.md).

## Remaining limits and next scope

I0 is text-first: source images are not downloaded and remain placeholders. No manual check for new chapters, rename/reorder/removal reconciliation after initial import or historical edit detection exists. No Sidestory/Apocrypha/Informational/Omake import, read/unread state, download/story deletion, search, sync, backend or notifications exists. Full v0 is not complete; the next product slice must be explicitly chosen.

**S2B standalone/Metro-free offline cold start remains deferred.** Public/commercial, republication and App Store authorization remain separate. Exact iOS/Expo Go versions remain unconfirmed; the previously reported phone was an iPhone 17 Pro. This report is not a fresh client-version confirmation or native packet inspection. Image variants, VoiceOver and direct script/network diagnostics were not newly supplied as I0 results; their earlier statuses remain. Source structure can change; COMPLETE means coherent observed traversal, not an atomic website snapshot.

This acceptance pass changes documentation/status only. No importer/storage architecture, source networking, tests, dependencies or lockfile changes, live source requests, source-image/update/read-state feature, EAS/Apple/build-service setup, paid action or S2B work occurred. No real prose/raw pages/screenshots, credentials or build outputs are committed. A separate acceptance commit, branch push and PR preparation against main are authorized; **no merge** is authorized.

## Acceptance-bookkeeping validation — 5 October 2026

The follow-up began on clean `feat/spacebattles-import-slice` at **d09ff85518a08fa002c28861666125643e047753**, with the expected `owencchapman24/stowaway` origin. Fetch confirmed `origin/main` still at the S2A merge **11d6e43**. Changes are limited to `README.md`, `AGENTS.md` and the two I0 records. Library/import/contents status copy was inspected and remains accurate. Historical S0/S1/S2A acceptance documents were not rewritten.

Using system Node **22.23.3** / npm **10.9.9**, the requested checks were rerun for this acceptance pass:

```text
npm.cmd run check                   Strict TypeScript + lint + 148 tests / 17 suites passed
npx.cmd expo install --check         Dependencies are up to date
npx.cmd expo-doctor@latest           21/21 checks passed
npx.cmd expo export --platform ios   Local iOS Hermes bundle + harbor.png export passed
git diff --check                    Passed
```

Expo metadata checks used approved network access; they made no SpaceBattles requests. The export remains compilation evidence, not S2B installation acceptance. Node's experimental host SQLite warning and Git's LF/CRLF conversion notices are informational. A separate sequential diff review matched every recorded physical pass to Owen's report, assigned the partial cancellation/restart test to Story C and kept Story A's offline result limited to an already-running project. No old test or unreported diagnostic was marked passed.

GitHub CLI is unavailable on PATH and in its standard installation locations. PR title: **I0: Persistent SpaceBattles story import**. The prepared body is saved outside tracked Git in ignored `.tools/I0_PR_Body.md`. For manual creation, open the [main-to-I0 comparison](https://github.com/owencchapman24/stowaway/compare/main...feat/spacebattles-import-slice?expand=1), confirm base **main** / compare **feat/spacebattles-import-slice**, paste the title/body and click **Create pull request**. No PR was created by this fallback and **no PR merge** is authorized. The next product slice remains unchosen.
