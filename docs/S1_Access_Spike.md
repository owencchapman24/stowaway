# S1 access and primary-manifest spike — ready for iPhone testing

Status recorded: **5 October 2026, America/New_York**. Branch: `feat/spacebattles-access-spike`, based on `46e8ba2` (S0 merged into main). The [October audit](Stowaway_October_2026_Groundwork_Audit.md) remains the specification. S0 reader/storage behavior and dependency versions are unchanged; Contents gains a development-only diagnostic link.

## Goal

Test ordinary unauthenticated requests from Owen's actual iPhone, complete discovery of a public story's primary Threadmarks category, and minimal representative post-ID/body mapping. This is a feasibility spike, not an importer.

The earlier attempt stopped before story requests because the tool returned HTTP 403 for Terms/Site Rules and could not retrieve robots.txt. It produced these two S1 documents and passed the original 39-test S0 suite. That history is preserved in [the source-policy record](S1_Source_Policy.md). The retrieval failure did not establish an iPhone access failure.

Owen subsequently supplied current official policy text and selected A/B/C. The personal spike gate is now cleared on that supplied basis, without re-fetching policy pages. The bounded implementation and desktop probes below are complete. **S1 is not accepted:** actual unauthenticated iPhone access and Owen's complete primary-category comparison remain pending. Stop here for his phone test; no PR, merge, S2 or full importer work is authorized.

## Scope

SpaceBattles-specific URL recognition, conservative document fetching, complete primary-manifest traversal, minimal first/optional-last post mapping and a development diagnostic only. No full ingestion, production import/update UI, normal-library real content, RSS, additional sites, accounts/sync, background updates, backend, analytics, notifications or S2/native build work.

## Architecture added

- `src/sources/spacebattles/url.ts` recognizes HTTPS thread input, strips mutable slug/query/page/fragment metadata for identity, and restricts fetched documents/redirects to the selected thread and numeric post references. Unsupported hosts, HTTP, post-only story input and utility paths fail before transport. Numeric IDs remain strings.
- `types.ts` defines typed failures and discriminated COMPLETE versus INCOMPLETE/FAILED manifests. `src/domain/identity.ts` adds the `spacebattles` namespace alongside the existing fixture namespace; titles/order remain metadata.
- `request.ts` is the sole document queue, host/redirect/access/retry policy. `parse.ts` uses the already-installed htmlparser2/domhandler to inspect source structure. No scripts, source styles, images or subresources are executed/fetched.
- `diagnostic.ts` traverses the primary index/ranges and maps at most two selected posts. Identical document URLs, including hash variants and validated redirect aliases, share a per-run RAM cache. HTML is cleared after the run; the queue does not retain resolved HTML. Results contain manifest metadata and sample character counts/formatting tags, never prose.
- `native.ts` adapts installed `expo/fetch`; one shared client preserves serialization and cooldown across screens/repeated runs. `src/app/s1.tsx` is a dev-only, deliberate-action screen with URL input, optional last sample, cancel, state/classification, counts/IDs and a virtualized ordered manifest. Leaving aborts the run. Production cannot run this diagnostic.
- There are no S1 SQLite/filesystem writes, library/import hooks, sanitization/rendering changes, new packages, lockfile changes, generic source framework or build services. S0 remains the offline synthetic reader.

## Request policy

All GETs, including redirects/retries, use the same queue: **one document in flight through body consumption, >=2 seconds between starts**, a 20-second attempt timeout, and at most two retries for timeout/429/5xx. Transient delays grow from two to four seconds, taking the larger of that delay and Retry-After. Both seconds and HTTP-date forms are honored; response cooldown also applies to redirects and subsequent document requests. A wait beyond 30 seconds stops rather than shortening Retry-After; the shared client retains its cooldown for later runs. Ordinary network errors have no automatic retry. Redirects are manual, checked before the next GET and capped at four per document.

401/403, login/challenge/access interstitials (including HTTP 200), unsupported redirects/paths and unexpected status stop that run. A challenge-shaped 5xx/429 is not treated as an ordinary transient response. No endpoint rotation, browser sessions, authentication, Safari-cookie copying, proxy or bypass is present. Unread redirect/failure bodies are cancelled so they cannot continue behind the queue.

The requested User-Agent is exactly **`Stowaway/0.1 personal-reader-feasibility`**, with no personal data. Requests use `credentials: 'omit'`, `redirect: 'manual'`, `cache: 'no-store'` and the wire header `Cache-Control: no-store`; no Cookie/Authorization headers are supplied. Installed SDK 57 iOS source adds supplied headers to URLRequest, sets `httpShouldHandleCookies = false` for omit and declines automatic redirects in manual mode. This is source inspection, not packet inspection on Owen's phone. Native RequestInit does not expose a separate cache-policy field, so the JS cache flag alone is not proof of OS cache behavior; the HTTP no-store header is also requested. OS caching and actual wire headers remain device-unverified. No app-owned temporary prose files are required.

Budgets: 80 GET attempts per diagnostic including redirects/retries; 10,000 unique entries; range depth 20; documents rejected above 3,000,000 advertised bytes or decoded characters. The latter is a response-size check, not a streaming allocation guarantee. Budgets and spacing are Stowaway choices, not SpaceBattles quotas. Excluded paths include all supplied wildcard robots exclusions; only specific public document routes and numeric query parameters are allowed.

## Observed SpaceBattles structure

Current public pages expose `data-content-key="thread-<ID>"`, threadmark category tabs, a default **bare `/threadmarks` link**, an active pane labeled `threadmark-category-<ID>` and a matching active body class `category-<ID>`. The default active tab identifies the primary category; its display label and numeric category value are not hard-coded. All observed examples currently use category 1; generated tests use category 9 and a renamed label. Side categories are excluded.

Entries come only from the primary body's `structItem--threadmark` rows and title post links. Numeric `#post-<ID>`, `/posts/<ID>/` or `/post-<ID>` references determine post/chapter identity; source entry IDs are retained if exposed. Titles are separate metadata. First-post links, comments, author identity, timestamps and chapter numbers do not define the manifest.

## Primary manifest completeness rules

Pagination follows observed next links in `threadmarks-pagenav--wrapper category-<ID>`; advertised page controls must agree and reach their terminal page. There is no assumed entries-per-page. Range placeholders use observed `data-fetchurl` on `threadmark-fetcher`, including `/threadmarks-load-range?threadmark_category_id=<ID>&min=…&max=…`. Range results expand in place, recursively, without sorting. HTML and recognized JSON HTML envelopes are accepted; cycles, missing continuation, wrong category, error envelopes, interrupted requests and unsupported structure fail explicitly.

COMPLETE requires all observed continuations to terminate coherently and at least one unique entry. A category-scoped expected count, when exposed, must equal the final unique count; changed or mismatched counts fail. Duplicate post IDs preserve their first source position and are reported separately. The observed global header count combines categories on B and cannot be used as a primary expected total. None of A/B/C exposed a separately scoped expected count, so the diagnostic reports it as unknown and **manual count/order comparison remains required**. COMPLETE means traversal of the observed source controls, not an atomic website snapshot or immunity to simultaneous source edits.

After a COMPLETE manifest, only the first primary entry and optionally the last are sampled. Their observed post links are fetched directly; no Reader pages are calculated. The exact `message--post` article ID/data-content and primary category must match, with a nonempty `message-body`/`bbWrapper`. Only numeric ID, character count and formatting-tag names leave the operation. Source image tags are reported as structure, not downloaded. A sample failure is shown even if index traversal itself was COMPLETE.

## Test stories

| Local label | Selection | Desktop primary result, 5 October |
| --- | --- | --- |
| A | [Normal Isn't Ordinary](https://forums.spacebattles.com/threads/normal-isnt-ordinary-pokemon-si.1234421/) — thread 1234421 | COMPLETE; 25 unique, 1 index page, no duplicates; first 111923315, last 124318183 |
| B | [I Will Touch the Skies](https://forums.spacebattles.com/threads/i-will-touch-the-skies-a-pokemon-fanfiction.1057023/) — thread 1057023 | COMPLETE; 421 unique, 17 index pages, no duplicates; first 88726515, last 123429160 |
| C | [Eyes Open](https://forums.spacebattles.com/threads/eyes-open-pokemon-fanfic.1129205/) — thread 1129205 | COMPLETE; 34 unique, 2 index pages, no duplicates; first 96961304, last 112431089 |

These are time-specific desktop observations, not permanent expected fixture values or iPhone acceptance. The URLs exist only in this documentation and ignored probe arguments, not tracked application/test source.

## Live development probes — 35 GET attempts total

All used the Stowaway request client/honest User-Agent with omitted credentials and manual checked redirects. Each operation was serial and spaced; processes were run sequentially with no overlapping source probes. Policy pages were not re-fetched. Output was structural/status/ID metadata, never chapter prose or cookies. No raw HTML/body was written to disk or Git.

| Operation | Attempts | Observation |
| --- | ---: | --- |
| Initial permitted structure inspection: A root/index (four), B index (one) | 5 | HTTP 200; established default category/body/pagination and A's observed range URL; B's combined header count was 468 |
| Full diagnostic A, first + last samples | 4 | Canonical-root 301 followed by three 200s; first reused root RAM cache; samples 7,430 / 9,020 characters, emphasis tags |
| Full diagnostic B, first + last samples | 20 | Canonical-root 301 followed by nineteen 200s; 17 index pages; samples 11,125 / 2,040 characters, bold/emphasis/image tag structure |
| Full diagnostic C, first + last samples | 5 | Canonical-root 301 followed by four 200s; samples 16,023 / 26,229 characters, heading/bold/emphasis structure |
| A's already-observed primary range `min=1&max=22` | 1 | HTTP 200 HTML fragment; 20 rows, no further continuation; first 112062353, last 123067386 |

No retry, access denial, login or challenge was encountered. An initial structural log included unrelated public account/utility links; the output filter was narrowed immediately to exclude them. No account data/captures are retained or committed. Ignored `.tools/S1_*.cjs` helpers and `.tools/s1-build/` contain probe code/compiled application code only, no captures. They are unnecessary for the app or CI and can be removed. Actual native iPhone access may differ from Node fetch on Windows.

## Automated tests

Validation uses existing ignored portable Node **22.23.3 / npm 10.9.9**; system Node 20.12 is too old. Generated XenForo-like fixtures are original, not page captures. Added tests cover URL/string identity, source order, duplicates, pagination/ranges, expected-count/category changes, missing/cyclic continuations, exact post/category mapping, arbitrary observed post-page numbers, request serialization/body consumption/spacing, path/redirect restrictions, bounded transient/timeout retries, Retry-After/cooldown, 401/403/200/503 access failures, and deliberate UI action/unmount cancellation. Screen tests mock the native diagnostic; every automated request test uses an injected fake transport. No S0 test was changed.

Commands run for this implementation:

```text
npm.cmd run check
npm.cmd test -- --runTestsByPath tests/s1-screen.test.tsx
npm.cmd test -- --runTestsByPath tests/s1-screen.test.tsx --no-cache
npm.cmd test -- --no-cache
npx.cmd expo install --check
npx.cmd expo-doctor@latest
npx.cmd expo export --platform ios
git diff --check
```

The first full check passed TypeScript/lint but the new screen test exceeded its five-second limit. Cached reruns passed; an explicit no-cache run reproduced the cold-start issue. RN lazily compiles list/scroll modules at first render. A synchronous setup render now initializes those modules before the async action test; the no-cache screen tests pass without removing assertions or increasing the timeout. A separate blocked-result screen test was added. Strict TypeScript/lint and the full suite results are recorded below after final validation. Compatibility reports dependencies up to date; Doctor passes **21/21**; iOS Hermes export succeeds with `harbor.png`. Export is a compilation check, not a physical diagnostic run. Node's host SQLite experimental warning and Metro's color-environment warnings are informational.

Other read-only commands included `git status --short`, `git branch --show-current`, `git log -1`, Node/npm version checks and `rg` source inspection. A temporary pure-module build for the ignored live helpers used:

```text
node.exe node_modules/typescript/bin/tsc --ignoreConfig --strict --target ES2022 --module commonjs --skipLibCheck --outDir .tools/s1-build --rootDir src src/sources/spacebattles/diagnostic.ts
node.exe .tools/S1_probe.cjs <selected URL> [observed document URL]
node.exe .tools/S1_structure.cjs <selected URL> [observed document URL]
node.exe .tools/S1_run.cjs <A, then B, then C URL>
node.exe .tools/S1_range.cjs <A URL> <observed range URL> 1
```

These helpers were manual developer probes only; they are not tracked or invoked by tests/CI. No package installation/update, audit fix or overrides were run for S1.

Final validation: **`npm.cmd run check` passes TypeScript, lint and 98 tests / 11 suites; the entire `--no-cache` suite also passes 98/98**. `git diff --check` and no-index whitespace checks for all 14 untracked S1 files pass. Expo compatibility and Doctor results above remain valid with the unchanged dependency graph; a final iOS Hermes export after the last code correction also passes.

A separate sequential diff review covered URL/path/redirect restrictions, native cookie/header handling, primary/category identity, source ordering/completeness, partial failures, representative ID mapping, transient-cache disposal and unchanged S0 persistence. It found and fixed Retry-After handling on redirects and missing-trailing-slash thread input normalization, with tests. Two redirect test doubles initially returned the Location value for every header name; they now model headers by name. No assertions or S0 tests were weakened. The final review found no remaining implementation blocker for the phone test. Changes remain uncommitted on the required branch.

## Physical-iPhone checklist — all pending

On Windows, remain on `feat/spacebattles-access-spike`. Use Node 22 LTS >=22.13 or Node 24 LTS >=24.3. If the supported portable toolchain already installed here is needed, prepend it for this PowerShell session:

```powershell
$env:Path = (Join-Path (Get-Location) '.tools/node-v22.23.3-win-x64') + ';' + $env:Path
node.exe --version
npm.cmd ci
npx.cmd expo login
npm.cmd start
```

Install/update **SDK 57 App Store Expo Go** on the iPhone and sign in to the same Expo account as CLI. No Apple Developer membership, TestFlight or `eas go` is required. Keep Metro running, use the same Wi-Fi, permit Node on Windows Firewall's private network and grant Expo Go local-network access. Scan the terminal QR with the iPhone Camera. See [README](../README.md) for the already-corrected Expo guidance. This is a dev-network test, not S2 offline cold start.

1. From Contents tap **S1 diagnostic (dev only)**. Keep phone networking enabled. No SpaceBattles account/session is needed; Safari sign-in is not copied.
2. Paste **A's URL above**, enable **Also sample the last primary post**, tap **Run S1 diagnostic**. Wait for final output; record state, thread/category IDs, unique/expected count, first/last IDs, samples, requests/elapsed time and any typed failure. No automatic run occurs merely from opening/pasting.
3. Compare against A's ordinary site **primary/default Threadmarks** UI. Compare the entire ordered list of post IDs/titles, unique count and first/last, across any pages/ranges. Confirm the sampled IDs correspond to their actual posts. Do not compare to a combined header or a side category.
4. Repeat the same process for **B**, keeping the last-sample option on. Allow time for all index pages (desktop observed 17; spacing alone takes roughly 40 seconds). Compare every primary page/range in source order, not only the endpoints. Never infer missing entries from timestamps or Reader page arithmetic. Source counts may change since the desktop observation.
5. Repeat for **C**. Confirm both sample IDs map correctly and reported heading/emphasis structure corresponds to those posts. Full prose intentionally does not appear in Stowaway.
6. Run A once more, return to Contents, and leave/reopen the diagnostic screen. Results reset on a new screen/run. The normal library still contains exactly the original three synthetic chapters, and S0 saved passages remain intact. No real story is added or retained for normal reading. Optionally cancel a run/leave mid-run: no further GET should start after cancellation is observed; an already waiting cooldown may need to finish before a new run.
7. If any response is blocked, login/challenge/interstitial or a typed access failure, **stop that story's run** and report the code/HTTP status/request count. Do not retry through alternate endpoints, copy cookies, log in to SpaceBattles, spoof a browser, use a proxy or solve a challenge for Stowaway. Ordinary Safari viewing is only for manual comparison, not for supplying a session.

For **each A/B/C**, all remain pending until Owen reports results:

- [ ] Ordinary unauthenticated iPhone request succeeds.
- [ ] No login, challenge or interstitial is returned, including with HTTP 200.
- [ ] The complete primary Threadmarks manifest is retrieved.
- [ ] Owen compares unique count, source order and post IDs with the site's own primary-category UI.
- [ ] Minimal representative content maps to the discovered post IDs.
- [ ] Repeated runs/returning to Contents leave only the synthetic library and preserve S0 progress.
- [ ] No bypass, proxy, copied-cookie or authentication workaround is used.

Please supply the actual iPhone/iOS/Expo Go versions, each example's classification/count/first/last/sample outcome, and whether the full primary source order matched. Titles/IDs/status are sufficient; do not send prose, cookies or sessions. A screenshot of diagnostic metadata can help.

## Failures / limitations

Still unverified: native iPhone public access, actual on-wire User-Agent/cookie/redirect/cache behavior, full source-count/order comparison by Owen, and changing source structure during a traversal. Parser fixtures plus desktop success do not establish these. Actual range HTML was exercised once on desktop; JSON/nested/error ranges and challenge/retry behavior were tested with deterministic fixtures, not induced on the site. No native physical result is invented.

The supplied policy identifies neither explicit automated-reader prohibition nor authorization. Its narrow personal engineering gate is cleared; public/commercial deployment, App Store authorization and copyright/reuse remain unresolved separately. Generic robots allowance is not legal permission; Yandex's one-second crawl delay is not applied to Stowaway.

## S1 result

No full story was downloaded; only manifests and minimum representative public pages were retrieved. No real story was persisted into the normal library. No authentication, browser cookies, proxy, anti-bot/challenge bypass or blocked-crawler/browser impersonation was added. No live tests/CI requests, new dependencies, PR, merge or S2 work exist. **Ready for Owen's phone test; S1 acceptance pending.**
