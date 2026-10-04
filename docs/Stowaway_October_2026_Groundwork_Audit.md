# Stowaway October 2026 Groundwork Audit

**Audit date: 3 October 2026, America/New_York. Recommendation: begin implementation with a small offline reader slice.**

The September reports provide enough foundation to start. Their core architecture remains sensible, but their combined roadmap is too large to serve as the v0 specification. The remaining uncertainty is concentrated in phone access to SpaceBattles, complete chapter discovery, WebView behavior, and preservation of local data.

This audit reviews **SpaceBattlesXenForo Fanfiction Reader Product Technical and Commercial Development Plan** (“Product plan”) and **Personal-Use iPhone Reader for SpaceBattles Fanfiction** (“iPhone report”). References below identify the relevant report sections. Current primary documentation was checked only where it affects the build. Recommendations are engineering judgments; no Stowaway code, live importer, or physical-device prototype has been validated in this audit.

For v0, use this audit as the working specification. Keep the September reports as background and a later-feature backlog. The working assumptions remain Owen developing primarily on Windows and reading on an iPhone.

## Conclusions that remain sound

| September conclusion | October assessment |
| --- | --- |
| Personal usefulness is the first success criterion. | Keep. The product succeeds if Owen prefers it for ordinary reading; commercial viability remains unvalidated. |
| SpaceBattles only, public threadmarked fiction, local storage, no backend. | Keep. This isolates the source problem and avoids accounts, hosting, sync, and monitoring infrastructure. |
| React Native, Expo, and TypeScript suit the Windows development setup. | Keep. Expo still documents cloud iOS builds from any operating system. Local iOS compilation requires the Apple toolchain. |
| Use a controlled WebView for rich chapter content. | Keep provisionally, subject to the first phone prototype. Strip source scripting and forum chrome; render app-controlled content. |
| Thread/post identity must survive renaming and reordering. | Keep without qualification. Preserve source ordering separately from IDs and publication timestamps. |
| Manual updates, polite requests, fixture-based tests, and preservation of downloaded content. | Keep. These are essential behavior, not polish to add after v0. |

Current support: [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Expo WebView](https://docs.expo.dev/versions/latest/sdk/webview/), and [FanFicFare’s XenForo 2 adapter](https://github.com/JimmXinu/FanFicFare/blob/main/fanficfare/adapters/base_xenforo2forum_adapter.py). FanFicFare is implementation precedent, not evidence that Stowaway’s phone requests will work or that its access is authorized.

## Corrections to the September recommendations

**Move the source feasibility test forward.** The Product plan’s first-year backlog places importer proof after substantial reader and persistence work. Perform it immediately after the smallest reader slice. Months of interface work should not precede testing the dependency that can invalidate direct import.

**Use sanitized HTML as the v0 content format.** The Product plan’s “Technical architecture and reader experience” requires a semantic block representation; the iPhone report permits normalized local HTML. Resolve this in favor of sanitized, deterministic HTML with generated block IDs and a sanitizer version. Building a custom document tree, renderer, and conversion layer is unnecessary now. Keep a module boundary so the representation can change later.

**Put chapter text in SQLite initially.** The iPhone report’s “Storage split” discourages large HTML/image BLOBs, but neither report supplies a benchmark showing that chapter HTML stored as TEXT is a problem. SQLite supports TEXT. My recommendation is metadata, current sanitized chapter HTML, and reading state in SQLite; raster images in app document storage. Read one chapter body at a time. This keeps a text replacement and its metadata inside one database transaction. Revisit text files only if profiling reveals a concrete problem. [SQLite types](https://www.sqlite.org/datatype3.html)

**Replace vague “atomic DB/file commit” language with a recovery rule.** A database transaction does not make filesystem operations part of that transaction. For an image, finish and validate a new file before committing its database reference. If the commit fails, the unreferenced file is harmless and can be cleaned up later. Preserve any old referenced file until replacement succeeds. A missing image must never make otherwise valid chapter text unreadable.

**Numbered paragraph IDs are only stable within a content version.** The iPhone report’s `block-0042` example survives typography changes but shifts when earlier paragraphs are inserted. Store the content hash with the locator. Guarantee same-version restoration in v0; defer text-quote matching across edits. Do not call numbered blocks edit-proof.

**Remove RSS and comprehensive revision handling from v0.** Both reports correctly treat RSS as a hint, but the proposed pipelines still add feeds, tokens, and reconciliation schedules prematurely. A manual check can inspect the complete primary threadmark index. Detect new posts and changed titles/order; do not promise detection of every historical body edit.

**Retire the 25-phase calendar as the implementation schedule.** The effort ranges are unvalidated estimates of a much larger product, not measured delivery forecasts for this scope. Estimate the next slice after observing the preceding one. The roadmap’s beta/permission ordering is also inconsistent across sections: resolve the intended distribution policy before inviting external testers.

**Do not carry forward volatile claims as requirements.** September competitor ratings, precise XenForo version, commercial costs, and an approximately tenfold Reader-mode saving are not v0 design inputs. FanFicFare still describes that request reduction, but its adapter also handles irregular Reader-page sizes. Follow observed pagination and match post IDs; never calculate correctness from “ten posts per page.” [FanFicFare configuration](https://github.com/JimmXinu/FanFicFare/blob/main/fanficfare/defaults.ini) and [adapter](https://github.com/JimmXinu/FanFicFare/blob/main/fanficfare/adapters/base_xenforo2forum_adapter.py)

A concrete tooling update: use Expo FileSystem’s current `File`, `Directory`, and `Paths` APIs. Several old methods throw when imported from the current module instead of its legacy entry point. Choose an Expo-compatible stable dependency set at scaffolding and commit the lockfile; the reports are not package-version specifications. [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/)

## Decisions to lock for v0

These are the recommended defaults. Reopen one only when a prototype fails a stated criterion or Owen changes the requirement.

| Decision | Lock |
| --- | --- |
| Product | Stowaway, an unofficial personal iPhone reader. No public-release commitment. |
| Stack | React Native + Expo + strict TypeScript; npm and one lockfile; Expo Router for the small navigation shell. |
| Content | Sanitized HTML, local block IDs, content hash, sanitizer version; one current body per post. |
| Storage | SQLite for metadata, HTML, progress, and preferences. App document files for accepted images; no ORM initially. |
| Source | One SpaceBattles module. Separate fetch, parse, sanitize, reconcile, and persistence functions. No plugin registry or generic capability framework. |
| Identity | Story key: source + numeric thread ID. Chapter key: story + numeric post ID. Store source IDs as strings. Category/title/order remain metadata. |
| Reader | One chapter per WebView, vertical scrolling, app-owned CSS and a small trusted position bridge. |
| Updates | User-triggered complete primary-index reconciliation and download of new chapters. No RSS or scheduled refresh. |
| Installation | Expo Go for the earliest slice; development build for native debugging; bundled internal preview build for independent offline acceptance. |
| Repository | One private Git repository and one app package. No monorepo, server package, or public license choice yet. |

Use a TypeScript-compatible HTML parser and an explicit allowlist serializer; `htmlparser2` is the initial candidate, not a proven Hermes dependency for this project. Validate the exact package on the phone in the first spike. Do not solve compatibility by silently adding browser DOM emulation or a large Node polyfill stack.

The source boundary needs only URL recognition/canonicalization, complete primary-manifest retrieval, and post-content retrieval. Inject the request client for fixture tests. Return explicit completeness and typed failure states; do not give an incomplete result the same type/status as a successful full manifest.

Expo’s current development-build and [internal-distribution guidance](https://docs.expo.dev/build/internal-distribution/) support this installation route. A development session reaching Metro is not evidence of independent cold-start behavior. Apple membership is currently **$99 annually**; Expo’s free plan currently lists **15 iOS builds**. Neither justifies buying services before the fixture prototype. [Apple membership](https://developer.apple.com/programs/) · [Expo pricing](https://expo.dev/pricing)

## Exact v0 scope

**The complete loop:** paste a supported public thread URL, import its main Threadmarks, read downloaded chapters offline, resume the last passage, and manually fetch newly added chapters.

| Capability | Required behavior |
| --- | --- |
| Add story | Accept HTTPS SpaceBattles thread URLs, including ordinary page/query/fragment variants that contain a thread ID. Reject other hosts and standalone post-only input with a clear explanation. Internal chapter references may use post URLs. |
| Chapter coverage | Import the primary Threadmarks category in source order, including pagination/range-loaded entries. Identify it by source category ID, not its display label. Do not infer chapters from comments, author-post searches, or first-post link lists. |
| Other categories | Identify that additional categories exist and state that they are excluded. No Sidestory/Apocrypha import, category picker, or custom reading order in v0. |
| Library and contents | Title, available author metadata, last position, downloaded/total count, unread count, update state, chapter list, and source links. Missing author metadata does not fail otherwise valid content. |
| Initial download | User import starts one foreground queue for the selected story’s primary chapters. Reading becomes available as chapters commit. Pause/cancel keeps completed work; a later resume retries pending work. No background-completion promise. |
| Reader | Previous/next chapter, contents, font-size adjustment, light/dark themes, sensible fixed line spacing/margins, selectable text, and source navigation. No page-turn pagination. |
| Formatting | Paragraphs, headings, emphasis, lists, quotes, scene breaks, basic tables, nested spoiler disclosure, and safe links. Unsupported active media becomes a labeled source link. |
| Images | Download validated JPEG/PNG/WebP images served from the allowed SpaceBattles origin. External hosts, redirects outside that origin, SVG, animated formats, and failed/oversized assets get explicit placeholders. No remote image loads from the reader. This deliberately limits v0 fidelity. |
| Offline | Downloaded text and accepted images remain readable after force-quit and relaunch with network disabled. Missing chapters clearly say “not downloaded.” |
| Position | Save chapter ID + content hash + block ID + offset within block + progression fallback. Restore the same block after font changes and relaunch. Preserve expanded spoiler ancestors needed to reveal the passage. |
| Manual updates | Re-fetch a complete primary manifest; add new IDs, update labels/order, retain progress, and download new chapters. Repeating the check produces no duplicates. |
| Removed entries and edits | Only a complete manifest may mark a reference absent. Keep its local copy in a separate “Saved chapters no longer listed” group. Do not automatically re-fetch old bodies, erase read state, or claim historical edits were checked. |
| Progress | Track read state per stable chapter ID, independently of resume position. Mark read at chapter end; allow manual read/unread correction. New or inserted IDs start unread. |
| Deletion and errors | Remove downloads while retaining metadata/progress; separately remove the story and all local state with confirmation. Distinguish blocked access, incomplete index, parser failure, network failure, and storage failure. |

Foreground interruption leaves unfinished rows pending; resume is explicit. Persistence covers app restarts, not uninstall/reinstall; backup/export remains deferred. Text completion and image completion have separate statuses. “All text downloaded” must not claim that skipped or failed images are offline.

**Excluded:** additional sites/platforms, authenticated threads, comments, share extension, EPUB import/export, search, annotations, text-to-speech, revision history, cross-edit locator recovery, accounts, sync, backend, notifications, RSS, analytics, monetization, branding work beyond a usable name/icon, and App Store submission.

Baseline accessibility is included: labeled controls, readable contrast, large text, and usable spoiler disclosure with VoiceOver. Advanced accessibility customization can follow actual device findings.

**v0 is finished only when** three representative public stories match the site’s primary contents, repeated updates remain idempotent, interrupted operations preserve existing text/progress, and a bundled preview passes airplane-mode cold start. Owen should then complete at least three normal reading sessions without a blocking defect and prefer it to the forum browser. These are proposed acceptance targets, not results already achieved.

## Remaining gaps and bounded prototypes

Only three technical spikes are warranted. Their timeboxes are investigation limits, not delivery promises. If one overruns, record the specific failure and choose a fallback instead of expanding the research program.

| Spike | What to prove | Exit and stop rule |
| --- | --- | --- |
| S0 — offline reader slice, target 1–2 focused sessions | The selected parser runs on the phone; sanitized HTML, a local image, nested spoilers, SQLite, and the position bridge work together. | Same passage after font change/reopen; no content-triggered remote load; no source script execution. Expo Go is sufficient for the initial functional check. If the renderer fails, isolate that failure before building the library UI. |
| S1 — SpaceBattles access and manifest, target 1 focused session | After policy review, test ordinary unauthenticated requests from the actual iPhone against three public examples: ordinary, long/range-loaded, and rich formatting. The examples can overlap. Retrieve manifests and minimal sample content, not three full stories. | Primary chapter count/order/IDs match the site; returned pages contain the expected post bodies; Reader navigation works without fixed page-size assumptions. A 200 challenge/login page is a failure. If ordinary access is blocked, stop; separately reconsider a user-supplied-file/EPUB product. That is a scope change, not a hidden proxy fallback. |
| S2 — persistence and installation, target 1 focused session | Interrupt a text transaction and image save, relaunch, retry, and run a bundled preview with Metro unavailable. | Old text and progress remain valid; incomplete images become placeholders; restart/resume creates no duplicate records; offline cold start works on Owen’s iPhone. |

**Before S0:** record the actual iPhone/iOS version and Windows/Node environment in the setup notes. Use synthetic content immediately; the absence of selected real stories is not a blocker.

**Before S1:** choose up to three stories Owen actually wants to read and inspect current [SpaceBattles terms](https://forums.spacebattles.com/pages/terms/), [site rules](https://forums.spacebattles.com/pages/site-rules/), and [robots.txt](https://forums.spacebattles.com/robots.txt). Search located the terms page, but this environment could not retrieve the full terms or robots file. Their policy remains unverified. This does not establish permission or prove the phone will be blocked. Record the applicable policy and any uncertainty; if automated-client use remains unclear, resolve that narrowly with the site before making live importing a normal feature. Synthetic development can continue.

**Before external testing:** settle authorization for the intended distribution. Apple’s current 5.2.2 requires permission under the service’s terms and evidence on request. Written staff approval is one route when terms are unclear; it is not a substitute for assessing other applicable rights. Robots rules alone do not establish content rights or App Store approval. [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/)

**Stop researching after these decisions.** No further competitor survey, TAM estimate, framework comparison, or platform roadmap is needed for S0. Later lookups must answer a named implementation failure or a specific source-policy question.

## Implementation rules that prevent rework

**Complete indexes and safe reconciliation.** Stage the primary manifest before changing its stored order or absence flags. Require successful traversal of every discovered page/range, coherent post IDs, and a count match where the source exposes a total. A partial fetch cannot mean deletion or “no updates.” Keep last-attempt time separate from last-successful complete check. Allow one import/update mutation per story at a time.

**Small database model.** Start with stories, chapters, threadmark entries, reading positions, assets, and settings. Keep read state on chapters and derive unread totals. Keep entry order separate from the body so duplicate references do not duplicate downloads. Use versioned SQL migrations, foreign keys, and parameterized writes. Store current HTML, hash, and sanitizer version together; no revision table, sync-run ledger, FTS index, or generic source registry yet. Serialize database writes and use Expo’s transaction API deliberately: its documentation warns that ordinary async transactions can include concurrent queries outside the apparent callback scope. [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

**Image recovery.** Use generated filenames and validate bytes before referencing an image. Store relative paths, resolve the current app directory at runtime, and check for missing files when opening content. A crash before the reference commit can leave an orphan; a crash after commit must leave a readable completed file. Never overwrite a referenced image in place. Establish explicit byte/dimension budgets as app settings in code; exceeding them produces a placeholder. Do not call those limits SpaceBattles policy.

**Safe rendering.** Parse and serialize an allowlist; never sanitize HTML with regex alone. Remove source scripts, handlers, forms, frames, arbitrary CSS, remote fonts, and active URLs. Give each chapter a generated local rendering directory with narrowly scoped file access. The canonical HTML remains in SQLite; the rendering file is disposable and regenerated from it.

Allow only bundled app code for the position bridge. Validate bridge message type, shape, and current chapter identity; never evaluate message content. Use a restrictive Content Security Policy, local-only resources, and explicit navigation handling. Permit browser navigation only from a deliberate safe-link action; block automatic navigation. Do not treat `originWhitelist` as a resource firewall. Test the actual settings against the selected WebView version. [React Native WebView reference](https://github.com/react-native-webview/react-native-webview/blob/master/docs/Reference.md)

**Conservative network policy.** One request in flight, with a starting minimum two-second spacing; these are Stowaway defaults, not an official site quota. Cache identical requests within an operation. Honor `Retry-After`, cap transient retries at two, and use increasing delays. Stop source-document fetching on authentication/403/challenge responses rather than cycling endpoints; a rejected optional image becomes a placeholder without erasing text. Validate parsed hosts and redirects, not URL string prefixes. Choose observed Reader links for normal batching; never use a proxy, copied browser cookies, or a challenge bypass to rescue the importer.

**Privacy.** No app backend or analytics. Development logs contain status/parser diagnostics, not story bodies or credentials. “Local storage” does not promise exclusion from the user’s operating-system backups. Do not send real chapter text to coding agents when a synthetic or minimized example suffices.

## Repository and development workflow

Use a single application rooted at `stowaway/`. The following is a target layout; create modules when their slice needs them rather than generating empty frameworks.

| Location | Responsibility |
| --- | --- |
| `src/app/` | Thin Expo Router screens: library, story contents, reader. |
| `src/domain/` | Shared IDs, manifest/content types, progress rules, typed errors. No Expo imports. |
| `src/sources/spacebattles/` | URL handling, index/post parsing, source-specific selectors and orchestration. |
| `src/content/` | HTML allowlist, normalization, block IDs, image references. |
| `src/network/` | Request queue, redirect/host validation, retry and cancellation policy. |
| `src/storage/` | SQLite access, migrations, repository functions, image and render files. |
| `src/reader/` | WebView wrapper, CSS/template, trusted bridge, locator restoration. |
| `src/features/` | Library/import/update workflows and reconciliation. |
| `tests/fixtures/` | Synthetic HTML/manifests and minimized regression examples with provenance. |
| `tests/integration/` | Storage/reconciliation/failure scenarios. |
| `docs/` | Working v0 spec, short decisions log, source-policy note, device test checklist. |
| Root | README, AGENTS.md, app/package configuration, package-lock.json, EAS configuration when needed, and one CI workflow. |

Archive the two September reports under `docs/research/` when the repository is created. State their background status in README and AGENTS.md; the active v0 specification controls implementation.

Use short branches and reviewable pull requests against a runnable `main`. One issue should describe one observable behavior, the relevant invariant, and its acceptance check. Merge after relevant checks and a diff review; reserve physical-device verification for changes that depend on native behavior. Tag useful working milestones. Avoid a separate long-lived development branch.

CI runs clean install, TypeScript, lint, fixture/unit tests, and deterministic integration checks. It never fetches live fiction. Do not run paid EAS builds for every commit; use them for native configuration changes and acceptance milestones. Keep credentials, private downloads, raw captures, and generated builds out of Git.

No new global-state library, ORM, backend service, custom plugin system, or orchestration framework until a concrete need appears. Use the scaffold’s supported tooling and plain module boundaries.

## Testing and AI workflow

Choose **Jest with jest-expo** and React Native Testing Library for relevant screen behavior. Expo’s preset mocks native modules, so a green unit suite cannot establish that SQLite persistence or WKWebView works on the phone. Keep those device checks explicit. [Expo unit testing](https://docs.expo.dev/develop/unit-testing/)

| Test layer | Required evidence |
| --- | --- |
| Pure fixture tests | URL variants map to one story; duplicate IDs collapse; source order is retained; partial indexes fail safely; rename/reorder never clears progress. |
| Sanitizer tests | Scripts, event handlers, malformed tags, encoded active URLs, remote styles/images, and malicious bridge-shaped input cannot become active reader content. Also test that legitimate prose and spoilers survive. |
| Reconciliation tests | Insert before a read chapter, rename/reorder, remove a reference, repeat the update, and interrupt fetching. Stored content/progress remain correct. |
| Storage integration | Real SQLite transaction/migration behavior and staged-image recovery, with failures injected before and after commits. Do not count a mocked repository as this test. |
| Physical iPhone | Local images, nested spoilers, VoiceOver, large text, selection, same-block resume, background/kill/reopen, and bundled offline cold start. |
| Small live smoke | Only during S1, source-adapter changes, or suspected breakage, using the selected public examples and agreed access policy. |
| Bounded stress | Generated 1,000-entry manifest and one long chapter; confirm only the active body is loaded. No live mass download or speculative benchmark program. |

Write tests around failure risks and product behavior, not component internals or arbitrary coverage percentages. Migrate from the previous schema when a migration actually exists; there are no “two prior schemas” to test on day one.

**Use one implementing AI session at a time.** Give it the current repository state, one issue, acceptance criteria, and explicit exclusions. Keep source-specific and platform-independent code boundaries clear. Ask it to report changed files, commands run, results, and anything still unverified.

Then use a separate review pass—another session or model can help—to inspect the diff, tests, and acceptance evidence. For parser, sanitizer, and storage changes, prioritize that review before adding features. This is a sequential workflow recommendation; simultaneous agents and custom coordination infrastructure are unnecessary for v0.

AGENTS.md should record the stack, identity rules, offline invariant, fixture-only CI policy, source-access rules, authority of the v0 spec, and the requirement to report device tests honestly. Coding agents must not invent successful iPhone runs, broaden source support, install speculative dependencies, weaken tests, or commit story captures. A failed spike should produce a concrete diagnosis and decision, not an unrequested rewrite.

Owen owns reading comfort and accepts the actual phone behavior. AI can implement and review; it cannot certify an unseen physical-device experience.

## Exact first implementation task

**Task S0 — Build the offline fixture reader slice.** Suggested branch: `feat/offline-reader-slice`.

**Deliverable:** a runnable Expo/TypeScript project with one synthetic three-chapter story stored in SQLite, a simple contents screen, and a reader that saves and restores a passage.

1. Scaffold the app with a current stable Expo setup compatible with the intended iPhone/Expo Go environment. Record the Node/Expo versions, use npm, commit the lockfile, and install native dependencies with `npx expo install`.

2. Add minimal README/AGENTS.md instructions and typecheck, lint, and test commands. Record the v0 boundaries; do not recreate the September roadmap.

3. Define story/post identity and a small versioned schema. Seed a synthetic story once, without resetting it on launch. Give one chapter enough text to scroll for several screens, quotes, a list, a nested spoiler, a safe link, and one bundled raster image.

4. Run that fixture through the selected parser and allowlist serializer. Store sanitized HTML, a content hash, and block IDs. Include malicious fixtures to check removal of active content.

5. Render one chapter at a time with light/dark themes and font-size controls. Save chapter/hash/block/offset through a validated app-owned bridge, debounce writes during scrolling, and flush on navigation/backgrounding where possible.

6. Add deterministic tests for stable identity, sanitizer behavior, repeat seeding, and locator persistence. Check real SQLite/WebView behavior on the iPhone separately.

7. Report the runnable commands and precise validation status. If the phone is unavailable, mark device acceptance pending; do not call the spike passed.

**Acceptance:** chapters remain after app relaunch; reseeding creates no duplicates; typography changes preserve the visible paragraph; spoilers and the local image work; a deliberately inserted source script never runs; the chapter causes no remote content requests; and typecheck, lint, and relevant tests pass. An abrupt kill restores the last completed save. Bundled airplane-mode cold-start proof is completed in S2, not inferred from Expo Go.

**Out of scope for this task:** live SpaceBattles requests, import/update UI, broad category support, RSS, cloud accounts, EAS purchases/submission, production styling, and a full download manager.

**Begin by scaffolding Stowaway and making one synthetic chapter survive a SQLite save, app relaunch, and same-paragraph resume on the iPhone.**

