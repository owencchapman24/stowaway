# I2 source images and offline asset persistence

Implementation date: **6 October 2026, America/New_York**, branch `feat/source-images`, base merged main **bba2c01** (PR #5/I1). **CORE I2 PHYSICAL ACCEPTANCE PASSED**, recorded from Owen's supplied physical-iPhone report after implementation/fix **fcd53badc5cf508e3adcca19832f04ffdf8a9caf**, through the existing Expo Go/Metro library. Real same-origin SpaceBattles images were downloaded, validated, persisted, rendered locally and regenerated while network-disabled on the already-running project. Conditional cancellation/destructive/rare live cases remain physically unexercised and retain deterministic/separate S2A evidence. This is Owen's reported evidence, not an agent-operated phone run or independent device/wire inspection. See the [reported device checklist](I2_Device_Checklist.md).

S0/S1/S2A/I0/I1 remain accepted; I0/I1 are merged in PR #4/#5. **S2B remains deferred; full v0 is incomplete.** No historical I0/I1 record is rewritten as image acceptance. Current authorization is the targeted five-finding post-acceptance review-fix pass and a commit/push to existing PR #6; no merge or next product slice is authorized. Historical acceptance below remains evidence for its tested implementation. **Focused post-fix physical regression is pending**; see the final section and device checklist.

## Implementation and maintenance history

| Commit | Change |
| --- | --- |
| `2ed0bbf5cc1428255d352fbc1505119d972bcb56` | Implement I2 offline source images |
| `5d5bd28c447953252075edb569852e813dbb0e72` | Remove I2 filesystem require cycle |
| `d41765a1c4f57e852bdd8446993d46df5fb91ecd` | Update Expo SDK 57 patch dependencies |
| `fcd53badc5cf508e3adcca19832f04ffdf8a9caf` | Fix I2 SpaceBattles image MIME compatibility |

Physical acceptance initially surfaced the Metro warning `src/images/files.ts -> src/storage/local-files.ts -> src/images/files.ts`. Shared `LocalFiles`, UUID and neutral path/file primitives moved to `src/storage/file-primitives.ts` in **5d5bd28**; behavior, schema and policy stayed unchanged. The subsequent development bundle showed no require-cycle warning.

During acceptance, Expo's expected SDK-57 patch set advanced. **d41765a** changed only `package.json` / `package-lock.json`, preserving SDK major/minor:

| Package | Before | After |
| --- | --- | --- |
| expo | 57.0.26 | 57.0.27 |
| expo-asset | 57.0.18 | 57.0.19 |
| expo-constants | 57.0.20 | 57.0.21 |
| expo-linking | 57.0.11 | 57.0.12 |
| expo-router | 57.0.24 | 57.0.25 |
| expo-sqlite | 57.0.3 | 57.0.4 |

Owen reports the intermediate CI run passed **332 tests / 22 suites** and failed only `expo install --check` because the expected patch set changed; this was compatibility maintenance, not a product defect. Subsequent dependency-update CI passed, as reported by Owen. No audit fix, SDK major/minor upgrade or unrelated package was added.

## Physical iPhone acceptance — Owen's reported results

### Library preservation and deliberate legacy scans — passed

The existing v3 library migrated to v4 without reset: **Eyes Open (Pokemon Fanfic) 34/34**, **Normal Isn't Ordinary [Pokemon SI] 25/25**, **The Lantern Cartographer 3/3**. Saved passages, font/theme preferences and I1 timestamps remained usable/intact. The synthetic harbor stayed confined to the fixture; real stories did not gain it. S1/S2A remained separate development diagnostics. Opening Library/Story started no image discovery/download.

Eyes Open initially showed **34 text chapters not scanned**; Normal Isn't Ordinary showed **25**. Deliberate Download Images scans each completed with **Images: no source images**, unchanged text counts and intact update timestamps. This establishes physical legacy zero-image discovery, not packet-level proof about historical body requests; exact saved-text compatibility remains implementation/test evidence.

### Aenys image persistence, placement and MIME fix — passed

**[ASOIAF SI] Aenys, King of Dreams**, author **Kingofwinter**, imported at **38/38 text chapters** with **58 image slots**. Before the MIME fix, the observed state was **0 local / 50 omitted / 8 pending**; those eight downloads became `content-type-mismatch`, leaving **0 local / 58 omitted / 0 pending**. Prose remained readable and explicit omission placeholders appeared. This exposed interoperability failure without reported data loss; the reasons for the initial 50 omissions were not supplied.

After **fcd53badc5cf508e3adcca19832f04ffdf8a9caf**, Owen retained the existing library and deliberately used Retry Images. Final observed state was **57 local / 1 omitted / 0 pending**, still **38/38 text**. Real local images rendered between surrounding prose at the expected positions, including **Chapter 2 A Funeral and War Against The Seas** and **Overview of the State in 37 A.C**. No fixture harbor appeared in Aenys.

**REAL SPACEBATTLES IMAGE DOWNLOAD + LOCAL RENDERING PASSED. I2 MIME INTEROPERABILITY FIX PHYSICALLY CONFIRMED.** Development diagnostics physically showed examples of **received image/jpeg / detected png / validated**, confirming that the live response can label PNG bytes as JPEG and that validated bytes correctly determine the accepted raster format. This is reported diagnostic/reader evidence, not raw response capture. No source image bytes are stored in Git.

The observed **57/1/0** supersedes the earlier eight-only retest expectation. Explicit retry considers all current stored MIME-only omissions, not a fixed eight; no reason is inferred for each initial omission. Owen quickly checked every chapter but did not visually locate the single final omitted slot. Its count is not a visible-placeholder pass and its rejection reason is not asserted.

### Already-running offline regeneration and reader regression — passed

After images were local, Owen left the reader normally, disabled phone networking while the Expo Go project remained running, and reopened image-bearing chapters. At least **two image-bearing chapter views** still showed real local images with readable surrounding downloaded prose and usable navigation. **LOCAL SOURCE IMAGE + TEXT REGENERATION WITHOUT NETWORK PASSED.** This does not establish independent installation, Metro-free cold start or first launch in airplane mode; S2B remains deferred.

Throughout I2, saved passage behavior, local placement, Previous / Next, Contents / Library and font-size/theme controls remained usable. Exact pixel restoration across changed image geometry is not promised; unrelated unreported accessibility/bridge/network diagnostics keep their prior status.

### I1 manual update after images — passed

With networking restored, Owen deliberately ran Check for Updates on Aenys. It completed with **Check finished. / Up to date.**, preserving **38/38 text** and **57 local · 1 omitted · 0 pending**. Displayed attempt/complete-check times advanced to approximately **10/6/2026, 9:09:56 PM / 9:10:02 PM**. This establishes working manual updates and preservation of visible persisted image state; no packet-level zero body/image request claim is made. Deterministic transport tests establish intended request behavior, and displayed timestamps are sequence evidence rather than wire timing.

### Conditional physical cases — not exercised

- **I2 multi-image cancellation / force-quit / relaunch / explicit retry:** the successful Aenys retry was allowed to complete to establish first real-image acceptance. Deterministic cancellation/retry/settlement tests and separate synthetic S2A interruption evidence remain distinct from an I2 normal-library kill test.
- **Visible placeholder for the final single Aenys omission:** not located despite a quick check of every chapter. Pre-fix MIME-failure placeholders were observed separately.
- **Missing/corrupt normal-library source-image recovery:** not physically exercised; I2 intentionally has no destructive normal-library diagnostic. Host tests cover it; S2A's historical bundled-raster recovery remains separate.
- **Saved-unlisted chapter retaining source images:** no natural case was available.
- **Naturally new I1 chapter with same-body I2 image extraction:** not physically exercised.

These conditional omissions do not revoke core I2 acceptance. Saved-text mismatch and other unreported natural mutations/native-control/accessibility cases remain automated/conditional evidence. Exact iOS/Expo Go versions and native wire headers/cookies/cache/timing were not freshly verified. Global `PRAGMA foreign_key_check` performance and concurrent S1 diagnostic request-budget accounting remain deferred; prior image traffic is already excluded by S1's per-run baseline.

The demonstrated physical loop is existing or newly imported story → deliberate discovery → eligible slots → source-byte download → actual raster validation/dimensions/budgets → generated local file/reference → image at the expected chapter position → leave/reopen → text + image from local state without network → preserved ordinary manual updates.

## Persistence and identity

Normal storage migrates non-destructively to **v4** in the existing serialized exclusive transaction/FK-check path. `chapters.image_discovery` distinguishes unknown, scanned (including zero images), saved-text-mismatch and fixture. Existing real chapters become unknown; fixtures retain their independent harbor semantics. `chapter_images` has a composite primary key `(chapter_id, slot)`, a unique chapter/block mapping, source URL and bounded alt metadata, pending/downloaded/omitted state and reason. Accepted references contain an app-generated relative path, validated format, byte length, dimensions and SHA-256 digest. SQL constraints prevent partial downloaded-reference records. Existing manifest membership/order, update timestamps, bodies/hash/version/block IDs/links, locators/preferences and `assets` are preserved. There is no reset or generic media ledger.

Fresh/v1/v2/v3 migrations and rollback are covered with real host SQLite. S2A still explicitly uses its isolated v1 schema and exact resource paths; source-image APIs return no refs to its reader. Fixture `assets/` and its validation constants/digest remain separate from production `source-assets/`.

## Discovery and existing-library safety

`extractPostContent` selects the accepted exact post, records ordinary `src` or recognized `data-src`/`data-url` before blanking source image src, and normalizes links/spoilers/inline runs as before. A temporary ordinal attribute associates descriptors with the actual sanitizer traversal; the attribute never survives canonical serialization. Discarded source containers and spoiler chrome cannot shift the mapping. No srcset/CSS/media engine is added. Limits are 3,000 slots per chapter, 2,048 characters per resolved URL and 200 characters per alt label.

The sanitizer observer records existing omission-placeholder block IDs. Its canonical HTML, sanitizer version `s0-allowlist-1`, block numbering and content-hash input remain unchanged. Source URLs live out of band in `chapter_images`, never as image src in canonical content. Safe source links remain deliberate-action links under the existing bridge.

Existing downloaded/current chapters are scanned only after **Download Images**. The current source body is sanitized through the saved-text path. Version, hash, exact canonical HTML, block IDs and links must match the saved chapter before slots attach. An image URL/alt-only change ignored by that path does not replace prose. A mismatch persists bounded unavailability with no guessed mapping, body replacement or locator invalidation, and is not automatically retried. This is a mapping safety check, not general historical-edit detection.

New import/update bodies produce descriptors from the **same fetched body**. Text and discovery metadata commit together; bytes follow afterward. A failed image never rolls back committed text. Permanent image failures become omissions; source/network/storage interruption stops the foreground operation with earlier text/local refs retained. Ordinary unchanged updates and duplicate import/resume never backfill historical bodies. Download/Retry Images handles old discovery and pending/repair work explicitly. Only omissions whose stored reason is `content-type-mismatch` can also be reconsidered by deliberate image work; all other omissions remain permanent.

## Source and binary request boundary

Eligible URLs require HTTPS and the exact existing canonical origin `https://forums.spacebattles.com`, with no credentials, backslashes/control characters, encoded path separators or known account/administrative/action utility routes. External origins, alternate subdomains/hosts and non-HTTPS sources are omitted without a request. Source filenames never become local paths. Clearly unsupported GIF/SVG/AVIF extensions are omitted; bytes remain the authority for eligible URLs. Every redirect hop is checked before following; leaving the origin is rejected. There is no proxy, authentication or copied session.

HTML and image traffic share the existing single `RequestClient` queue, one in-flight request/body consumption, >=2-second start spacing, honest User-Agent, `credentials: omit`, manual redirects, no-store and bounded timeout/retry/Retry-After behavior. Binary requests have a raster Accept header and never become chapter documents. Content-Length is checked; the native Expo fetch ReadableStream is consumed with an independent actual-byte cap and cancellation. The fallback arrayBuffer seam is for transports without streaming and is checked before use, but cannot prebound that transport's allocation. Native headers/cookies/redirect behavior and wire timing have not been physically inspected.

Owen explicitly authorized selected public source images for this personal I2 slice. The [historical S1 policy review](S1_Source_Policy.md), including its narrower public-document/attachment gate, remains historical; it is not rewritten as affirmative attachment/site/distribution permission. Public/commercial, republication and App Store authorization remain unresolved. No live SpaceBattles request occurred in implementation/review.

S1 snapshots the shared request count at diagnostic start, so prior image traffic does not permanently consume the diagnostic budget. Concurrent traffic can still affect its global count/budget. The smallest permitted fix was unnecessary for the prior-traffic concern; the existing **concurrent S1 budget follow-up remains deferred**, with no independent client introduced.

## Raster validation and budgets

No processing/decoder dependency was added. Accepted formats are PNG, JPEG and WebP. Byte parsers independently check signatures/container lengths and dimensions: PNG requires IHDR, supported depth/color/compression/filter/interlace, valid chunk CRCs/order, IDAT and final IEND; JPEG walks marker lengths, a supported 8-bit SOF, SOS/entropy marker structure and terminal EOI; WebP walks exact RIFF/chunk lengths/padding and VP8/VP8L/VP8X dimensions. APNG control/data markers, WebP animation flags/ANIM/ANMF, GIF/SVG/XML/HTML/arbitrary content, truncation and invalid/zero dimensions are rejected.

Content-Type is a secondary veto after all byte checks. Accepted normalized labels are `image/png`, `image/jpeg`, `image/jpg`, `image/pjpeg`, `image/webp` and `application/octet-stream`; missing/blank MIME remains permitted only with valid raster bytes. Case and surrounding whitespace are normalized, parameters are discarded, and disagreement among those raster labels does not reject independently validated bytes. HTML/XHTML, XML/SVG, GIF, AVIF, APNG and every other unsupported or malformed label still reject even valid accepted raster bytes. Bytes alone determine the actual format, generated extension, dimensions, animation checks and limits. No byte parser was changed for MIME compatibility.

Budgets are **2,000,000 compressed bytes**, **2,048 pixels per axis**, **4,194,304 pixels total**. These match the conservative existing fixture dimension/byte ceilings and bound a typical four-byte decoded surface to about 16 MiB. They are Stowaway application limits, not SpaceBattles rules. Validators establish bounded raster structure, not complete decoder correctness; a native decode failure still degrades through the reader's existing local-image error placeholder. The original constant-black lossless WebP fixture decoded in the host image viewer; the lossy VP8 header fixture exercises structural parsing only. Owen's Aenys run establishes real iPhone image decoding/rendering for the observed local images, not an exhaustive physical PNG/JPEG/WebP/animation-variant matrix.

### Physical MIME failure and explicit retry

The first Aenys attempt above failed the old exact MIME/byte-format equality gate after structural validation. MIME values were not captured during that failed attempt. The subsequent accepted retest supplied `received image/jpeg / detected png / validated`, physically confirming the safe raster-label disagreement addressed by the fix; no particular live JPEG alias is asserted.

The existing v4 reason identifies all stored MIME-only retry candidates without a migration or reset. Contents shows **Retry Images** and the retryable count even when every slot is omitted. Opening screens still performs no source work. A deliberate retry uses existing slot mappings and source URLs, skips non-MIME omissions and valid local files, and commits fresh validated references through the unchanged staging/transaction order. Network/access failure or cancellation retains untouched MIME omissions for a later explicit retry. No body rescan, text replacement or manifest check is required for this already-scanned story.

Each operation returns at most eight transient MIME diagnostics, prioritizing rejections over successful samples, shown only by the development Contents UI: chapter ID, slot, normalized received MIME, byte-detected accepted format and validated/rejected status. The media-type token is bounded to 97 characters; malformed/overlong tokens or CR/LF/NUL values become `invalid`, missing MIME becomes `(missing)`, and parameters are discarded. Diagnostics contain no bytes, prose, source URLs, credentials or raw headers, and are neither logged nor persisted. `validated` describes byte/MIME validation, not successful reference commit; use authoritative local counts for persistence. The [Aenys retest](I2_Device_Checklist.md#i-aenys-mime-compatibility-retest) is physically confirmed at **57 local / 1 omitted / 0 pending**.

## File/reference recovery and cleanup

Accepted paths are exactly `source-assets/<UUID>.png|jpeg|webp`, with the extension from validated bytes. Absolute/traversal/malformed/unrecognized paths are rejected. Staging checks nonexistence, exclusively creates a fresh file, writes complete bytes, re-reads and validates format/dimensions/length/digest before any SQL reference. Local staging corruption is a retryable storage failure, not permanent source omission. Referenced files are never overwritten or deleted before replacement commits. DB failure retains the prior ref and leaves the completed new file orphaned; retry uses a fresh UUID.

Completed image results are batched at chapter boundaries/up to eight changes per reference transaction. Previously validated candidates can commit during cancellation settlement, while no new request/stage starts after observed cancellation. UI navigation waits for this settlement and its final SQL refresh. Earlier references/text remain authoritative; uncommitted files are harmless orphans. The global `PRAGMA foreign_key_check` infrastructure/rollback guarantees are unchanged. Its performance follow-up remains deferred; batching avoids a transaction per metadata field or per image when practical. Generated multi-chapter/many-image cancellation/retry tests have no timing-based assertions.

Cleanup runs best-effort only at a deliberate image operation and can also be exercised through the internal file seam. It considers every chapter reference, including other stories and saved-unlisted chapters. Only direct generated source filenames can be removed; current refs, active stages, directories and foreign names are protected. Fixture/S2A/render directories are outside its namespace. Active-at-snapshot protection plus a root-scoped cleanup gate prevents new stages racing a stale reference snapshot. There is no launch cleanup, orphan promotion or file-manager UI.

## Local render and locator invariants

The reader gets only that chapter's SQLite image slots, re-reads/checks each accepted source file (including size before read), copies accepted bytes under an app-owned `source-image-<slot>.<format>` into a fresh disposable directory, and substitutes the known placeholder only in render-time HTML. The same logical placeholder block ID is retained. Missing/corrupt/wrong-format/digest/over-budget files produce an explicit **local** placeholder; prose still opens and the reader never fetches a repair. Explicit Retry Images validates/reuses good refs and stages replacements for damaged ones.

Canonical HTML/hash/version/block IDs/locator identity never changes merely because image availability changes. Geometry can change; same-version block restoration and progression fallback remain, without an exact pixel promise. CSP stays `img-src 'self' file:`, no connect/fonts/media/source script, and existing WKWebView navigation/file-access restrictions remain. No remote source image URL can become active image/CSS/script content. Disposable render loss regenerates from SQLite and accepted local files without a source request.

Saved-unlisted chapters retain body/locator/images and remain locally readable. Source image work lists only currently listed downloaded chapters; unlisted bodies/assets are not refetched or deleted. Reappearance reuses identity/text/locator/valid image refs, with missing/pending work available to explicit retry.

## Ownership and restrained UI

`acquireStory` is the same narrow module-level ownership for import/update/resume/images across screens/repository handles, not a background framework. Different stories can operate logically independently; all native requests still serialize through one source client. Image-result transactions also verify story/chapter/current membership.

Story Contents shows scanned/unknown/mismatch and local/omitted/pending counts separately from text downloaded/total. One contextual Download Images / Retry Images action scans or repairs; valid local refs are not re-downloaded. A local count describes accepted SQLite references; render/retry revalidates actual file integrity, so a damaged file can show a placeholder before the next explicit retry. The fixture has no source-image action. Opening Library/Story performs local reads only. During image work, progress/Cancel remain visible, and Read/Library/Resume/Check/image controls plus native Back/gesture removal stay blocked through settlement and authoritative final refresh, extending the I1 handoff fix. Background/blur abort and route identity/focus guards suppress late results. Text remains readable after pending/failure states.

## Validation and sequential review

The implementation adds deterministic extraction/byte/network tests, real host SQLite/files/recovery/operation stress tests, image screen/settlement tests and bridge logical-block restoration cases. All 223 baseline tests remain; historical v3-specific tests explicitly target v3 while new migration tests exercise latest v4. No live transport or story captures/prose/image bytes are used. Synthetic PNG/JPEG bytes and generated WebP fixtures are original host test inputs.

Original feature-candidate validation used Node **22.23.3** (follow-up validation is recorded below):

| Command | Result |
| --- | --- |
| `npm.cmd run check` | TypeScript/lint passed; **332 tests, 22 suites passed**. **109 added cases**, all 223 baseline cases retained. |
| `npx.cmd expo install --check` | Dependencies up to date. |
| `npx.cmd expo-doctor@latest` | **21/21 checks passed**. |
| `npx.cmd expo export --platform ios` | Local iOS Hermes bundle exported successfully; ignored `dist/`, no signing/build service. |
| `git diff --check` and staged equivalent | Passed after removal of an extra EOF blank line. |

The dependency/doctor checks needed sandbox escalation for npm metadata/cache access, then passed. No package or lockfile change was needed. SQLite experimental warnings and Metro informational warnings do not change the successful exit results. Logs, design notes and generated preview/export outputs remain ignored.

The separate sequential completed-diff review covered production modules, integration/UI/bridge tests, documentation and historical-test adjustments. It found and fixed two request-classification gaps: an oversized 429/5xx response must remain a retryable transient failure instead of becoming a permanent omission; an unvalidated transport-followed final URL must stop as blocked instead of being hidden as an ordinary image omission. New regression tests cover both. Review also strengthened full migration snapshots, coherent body/discovery rollback, SQL rejection of partial downloaded metadata, failed-reference no-promotion behavior, and queue ownership through binary body consumption. Final review of those changes and the green check/export left no known blocking finding. Earlier implementation checks also fixed local staging corruption classification and SQLite CHECK/NULL completeness; neither was left as an unresolved limitation.

### Explicit security audit

| Boundary | Review result and deterministic evidence |
| --- | --- |
| Canonical remote src | Extraction blanks source src; sanitizer retains only inert placeholders, never URL/alt/temporary mapping attributes. Canonical output/hash compatibility is tested. |
| Rendered remote URL | Only matching chapter/block slots with validated local bytes become `source-image-<slot>.<format>` src. Source URL is never substituted; hostile alt is escaped. Safe links retain deliberate-action semantics. |
| CSP | Existing `img-src 'self' file:` and disabled network/media/font/source-script policy remain; trusted app bridge only. |
| Local paths | Exact generated UUID source namespace, extension/metadata validation and injected relative-file guard reject absolute/traversal/foreign names. |
| Redirects/origin | Exact HTTPS origin at input and every hop; external Location is refused before follow. Unexpected transport-followed URL stops blocked. Native transport behavior is not wire-verified. |
| MIME/magic | Independent raster signatures/containers remain authoritative. The bounded MIME allowlist tolerates safe raster-label disagreement; HTML/XHTML/XML/SVG/GIF/AVIF/other unsupported labels veto even valid raster bytes. Filename/MIME cannot authorize invalid bytes or control the local extension. |
| Animation | GIF/unsupported formats, APNG markers and WebP animation flags/chunks reject. |
| Budgets | Content-Length and independent streamed-byte cap; parser/reference/local pre-read dimensions/bytes/digest validation. Oversized transient HTTP failures stay retryable. |
| Traversal/overwrite | Source names never become paths. Exclusive fresh generated file creation refuses collision; old referenced files remain until new reference commits. |
| DB/file ordering | Validate/write/re-read/digest first, then batched serialized SQL refs with FK/rollback intact. Commit failure leaves orphan, never implicit promotion; body/discovery rollback is coherent. |
| Cleanup | Every story/current/unlisted reference plus stages and snapshot-active files protected. New stages wait for cleanup; only direct generated unreferenced files removed, no fixture/S2A/foreign/directory wipe. |
| Missing/corrupt fallback | Explicit local placeholder and readable unchanged text; deliberate retry uses a fresh validated replacement. No reader repair fetch. |
| Cancellation | Abortable cooldown/read, no next request after observed cancellation; earlier validated candidates may commit during settlement. UI navigation remains blocked through settlement/final local refresh. |
| Same-story ownership | Shared import/update/resume/image lock plus SQL chapter/story/current-membership checks; lock-busy, cancellation and route/focus settlement tests. |

This security audit establishes code/host-test evidence, separate from Owen's reported physical acceptance above. No agent-operated phone run or wire-level result is claimed. The [physical checklist](I2_Device_Checklist.md) distinguishes observed preservation/discovery/local rendering/offline regeneration/I1/reader passes from unexercised cancellation/relaunch, the final natural omission and normal-library missing/corrupt recovery.

### MIME compatibility follow-up validation

The narrow MIME follow-up adds **61 deterministic cases**: 50 MIME/byte-policy cases, nine host SQLite/files/download cases and two Contents UI cases. All prior cases remain; the old benign PNG-bytes/`image/jpeg` assertion now expects byte-authoritative acceptance, while its HTML/SVG rejection cases remain intact. Coverage includes every allowed raster-label/byte-format pairing, JPEG aliases, normalization/opaque MIME, unsupported labels with valid raster bytes, invalid/animated/oversized/trailing-HTML bytes under allowed labels, byte-derived extensions, the synthetic 58-slot/eight-old-failure retry, unchanged text/locators/schema, cancellation/access stopping, permanent non-MIME omissions and bounded/redacted/development-only diagnostics including a later rejection after successful samples.

Validation on Node **22.23.3**: `npm.cmd run check` passed TypeScript/lint and **393 tests / 23 suites**; `npx.cmd expo install --check` reported dependencies up to date; `npx.cmd expo-doctor@latest` passed **21/21**; `npx.cmd expo export --platform ios` exported the **1,248-module iOS Hermes bundle**; working/staged `git diff --check` passed. No dependency/lockfile changes or live SpaceBattles requests were made. Generated output/logs remain ignored.

A separate sequential diff/security review verified the unchanged byte parsers and budgets, unsupported MIME vetoes even for accepted raster bytes, conservative pre-validation login/challenge detection, byte-derived local format/extension, unchanged fresh-file/reference ordering and ownership checks, and the reason-specific deliberate retry boundary. Review refined the bounded diagnostic sample to retain later MIME rejections in preference to successes; the added regression and final check/export passed. No blocking finding remained. At that review checkpoint the phone retest was still pending; Owen's subsequent accepted Aenys rendering/offline result is recorded above. The synthetic 58-slot/eight-MIME-failure test is a fixture scenario, not an inventory of the live story's initial omission reasons.

Follow-up files: `src/images/validate.ts`, `src/images/types.ts`, `src/images/download.ts`, `src/images/repository.ts`, `src/images/summary.ts`, `src/app/story.tsx`, `tests/i2-mime.test.ts`, `tests/i2-images.test.ts`, `tests/integration/i2-images.test.ts`, `tests/i1-screens.test.tsx`, `docs/I2_Source_Images.md`, `docs/I2_Device_Checklist.md`.

### Original feature changed-file inventory (37 files)

```text
AGENTS.md
README.md
docs/I2_Device_Checklist.md
docs/I2_Source_Images.md
src/app/add-story.tsx
src/app/story.tsx
src/content/sanitize.ts
src/images/download.ts
src/images/files.ts
src/images/native.ts
src/images/render.ts
src/images/repository.ts
src/images/slots.ts
src/images/source-url.ts
src/images/summary.ts
src/images/types.ts
src/images/validate.ts
src/importing/import-story.ts
src/importing/native.ts
src/importing/ownership.ts
src/reader/ChapterReader.tsx
src/sources/spacebattles/parse.ts
src/sources/spacebattles/request.ts
src/storage/files.ts
src/storage/local-files.ts
src/storage/migrations.ts
src/storage/repository.ts
tests/bridge.test.ts
tests/fixtures/images.ts
tests/i0-reader.test.tsx
tests/i0-screens.test.tsx
tests/i1-screens.test.tsx
tests/i2-images.test.ts
tests/integration/host-files.ts
tests/integration/i0-import.test.ts
tests/integration/i1-update.test.ts
tests/integration/i2-images.test.ts
```

No read/unread, deletion, automatic/background/scheduled update/image job, additional site/category, media/gallery/transcoding, revisions/sync/backend, S2B or EAS/Apple/signing/paid work is included. Core I2 acceptance is recorded with the qualifications above. Acceptance documentation, full validation, a separate acceptance commit/push and PR preparation against main are authorized; no merge or next product slice is authorized.

## Acceptance-bookkeeping validation and PR preparation — 6 October 2026

This follow-up started on clean `feat/source-images` at **fcd53badc5cf508e3adcca19832f04ffdf8a9caf**. Fetch confirmed `origin/main` at merged I1 **bba2c01ef6d984a8dc3b330bd4e7b84ee6d39e74**. Tracked changes are limited to **AGENTS.md, README.md, docs/I2_Source_Images.md and docs/I2_Device_Checklist.md**. No production code, schema, request policy, tests, dependencies or lockfile changed. Historical S2A/I0/I1 acceptance records and the audit were read and retained unchanged. No live SpaceBattles request or prose/raw-page/image-byte/screenshot capture was made during bookkeeping; no private download, credential or build output is committed.

Current validation on Node **22.23.3**:

```text
npm.cmd run check                    TypeScript + lint + 393 tests / 23 suites passed
npx.cmd expo install --check          Dependencies are up to date
npx.cmd expo-doctor@latest            21/21 checks passed
npx.cmd expo export --platform ios    Local iOS Hermes bundle, 1,248 modules, exported to ignored dist/
git diff --check                     Passed, including the staged documentation
```

Expo metadata/npm-cache checks used approved access without changing packages. Host SQLite's experimental warning is informational. The export is compilation evidence, not S2B acceptance. The sequential documentation review matched physical checkmarks to Owen's supplied report, corrected the earlier eight-only retest expectation to the observed **57/1/0**, retained the final omission as visually unexercised, separated I2 from historical S2A/I0/I1 evidence, and preserved both deferred technical follow-ups. No unreported conditional/native/wire check was marked passed.

GitHub CLI is unavailable on PATH. PR title: **I2: Offline SpaceBattles source images**. The prepared body is outside tracked Git at ignored **.tools/I2_PR_Body.md**. For manual creation, open the [main-to-I2 comparison](https://github.com/owencchapman24/stowaway/compare/main...feat/source-images?expand=1), confirm base **main** / compare **feat/source-images**, paste that title and the saved body, then click **Create pull request**. No PR was created by this fallback and **no merge is authorized**. No read/unread, deletion, additional image feature, automatic/background work, S2B or next product slice was started.

## Post-acceptance adversarial review fixes — PR #6

The review at **9c14b7d8a08e055876452e0334ca127126bf2cfa** found four required defects and one small PNG compatibility defect. Owen authorized all five corrections on the same branch. Before editing, fixture-only probes reproduced replacement-token markup expansion (3,873 to 3,117,015 characters across ten slots), historical-reference loss followed by cleanup deletion, excessive retained tiny/empty chunk objects, encoded login/admin transport calls and rejection of a decodable empty-IDAT PNG. These are host/code observations, not native failure evidence.

| Finding | Correction and deterministic evidence |
| --- | --- |
| Replacement-string tokens in alt text | A function-valued replacement inserts escaped generated markup literally. Real host staging/readback/digest/copy tests cover match/prefix/suffix tokens, `$$`, combinations, hostile quotes/markup and ten slots; literal parsed alt, unique blocks/prose, local filenames and proportional output bounds are asserted. Canonical SQLite content/locator stay unchanged. |
| Rejected historical-image repair | Initial pending rejections retain ordinary omission semantics. Rejected repairs stop with an explicit retryable storage failure while retaining the downloaded metadata/reference. The SQL transaction also refuses downloaded-to-omitted changes. Real SQLite/files tests cover one-shot read failures plus invalid bytes or vetoed MIME, cleanup protection, recovered offline rendering, truly missing/corrupt refs, earlier completed candidates, batch rollback and fresh successful JPEG replacements. Old ownership remains until the new reference commits; only then may cleanup remove the old file. No migration is needed. |
| Tiny/empty stream chunks | Streaming uses one 2,000,000-byte buffer, checks remaining capacity before each copy, ignores empty chunks and returns an exact-size copy. Application accumulation is bounded by at most two max-size buffers, independent of chunk count; transport-owned memory is separate. Tests cover thousands of tiny/empty/mixed or reused-buffer chunks, exact limit/overflow, cancel/error/timeout, reader cancellation/release and queue ownership through settlement. The documented no-reader arrayBuffer allocation limitation is unchanged; native Expo supplies a reader. |
| Encoded utility routes | Parse with URL, decode the pathname once for policy inspection and retain the original parsed request URL. Malformed escapes/UTF-8, decoded controls/backslash and nested encoded octets are rejected; encoded separators remain vetoed before decoding. Existing utility and unsupported-extension restrictions inspect the decoded path without reparsing it as a URL. Initial/redirect tests cover mixed/double/triple encoding and dot-segment variants; ordinary attachment paths, encoded spaces/Unicode/literal percent and exact-origin rules remain coherent. No broader asset-route architecture is added. |
| Empty PNG IDAT | Empty chunks are permitted within a contiguous IDAT run; aggregate data must remain nonempty. Tests cover before/between/after/multiple empties, all-empty/missing data, closed/resumed runs, CRC and APNG vetoes. JPEG/WebP parsers, MIME policy and budgets are unchanged. |

Focused regressions are in **tests/i2-review-fixes.test.ts** and **tests/integration/i2-images.test.ts**. No source requests, schema/dependency/sanitizer/slot/CSP/I1/ownership/cleanup-namespace changes or new product scope are included. Deferred global foreign-key-check and S1-budget code remains unchanged. A separate sequential review and full validation of this fix set are recorded after implementation.

**Physical status:** historical core I2 acceptance is preserved. Hostile-alt native rendering, changed native stream/cancel/retry behavior and historical-reference repair have **not** been physically established by this pass. The [focused post-fix checklist](I2_Device_Checklist.md#post-fix-physical-regression--pending) remains pending. Existing Aenys 57/1/0 is suitable for local-render/reuse/offline regression, but an image-bearing story with genuinely pending/retryable images is needed to exercise changed network body consumption. Do not delete good files or reset the normal phone library to manufacture that condition. PR #6 remains unmerged.

Post-fix validation on **Node 22.23.3**:

```text
npm.cmd run check                    TypeScript + lint + 469 tests / 24 suites passed
npx.cmd expo install --check          Dependencies are up to date
npx.cmd expo-doctor@latest            21/21 checks passed
npx.cmd expo export --platform ios    Local iOS Hermes export passed, 1,248 modules
git diff --check                     Passed
```

The fix adds **76 deterministic cases** (64 URL/stream/PNG cases and 12 host SQLite/files/render/recovery cases). The first full run had one five-second timeout in the unchanged I1 handoff removal case while local validation overlapped; its isolated rerun and the subsequent serial full check both passed. No test assertion or timeout was weakened. A separate browser-DOM host probe with real validated/copied PNGs confirmed literal replacement-token alts, unique prose/blocks and **3,873 to 4,073** characters for the former ten-slot expansion, plus eleven hostile markup/mapping cases with no active remote resource attributes.

The separate sequential review inspected only this fix set after implementation: callback insertion preserves escaping/local filenames; failed repairs cannot demote historical references at either orchestration or transaction boundaries; cleanup still protects SQL/active ownership; accumulation retains no chunk collection and enforces capacity before copying; utility-route inspection cannot decode an external origin into eligibility; empty IDATs cannot bypass aggregate-data/order/CRC/APNG checks. No additional defect was found. Canonical sanitizer/hash/locator persistence, v4 migration, I1 reconciliation, CSP, operation ownership, cleanup namespace, Expo dependencies and deferred FK/S1-budget code are unchanged. No live SpaceBattles request or additional physical pass was made; PR #6 is not merged.
