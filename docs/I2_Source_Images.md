# I2 source images and offline asset persistence

Implementation candidate: **6 October 2026, America/New_York**, branch `feat/source-images`, base merged main **bba2c01** (PR #5/I1). **I2 is not physically accepted.** Owen must report the [device checklist](I2_Device_Checklist.md) before PR creation. S0/S1/S2A/I0/I1 remain accepted; I0/I1 are merged in PR #4/#5. S2B remains deferred and full v0 is incomplete. No prior physical image support is inferred from historical I0/I1 records.

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

Budgets are **2,000,000 compressed bytes**, **2,048 pixels per axis**, **4,194,304 pixels total**. These match the conservative existing fixture dimension/byte ceilings and bound a typical four-byte decoded surface to about 16 MiB. They are Stowaway application limits, not SpaceBattles rules. Validators establish bounded raster structure, not complete decoder correctness; a native decode failure still degrades through the reader's existing local-image error placeholder. The original constant-black lossless WebP fixture decoded in the host image viewer; the lossy VP8 header fixture exercises structural parsing only. Actual iPhone decoding remains physical acceptance work.

### Physical MIME failure and explicit retry

Owen reported that `[ASOIAF SI] Aenys, King of Dreams` imported **38/38 text chapters**, discovered **58 slots (50 omitted, 8 pending)**, then finished image work at **0 local, 58 omitted, 0 pending**. All eight previously eligible downloads became `content-type-mismatch`; placeholders and prose remained usable. This is reported phone evidence of failure, not real-image acceptance or wire inspection. The old exact MIME/byte-format equality gate ran after structural validation; the actual response MIME values were not captured, so no particular live alias is asserted.

The existing v4 reason identifies those eight retry candidates without a migration or reset. Contents shows **Retry Images** and the retryable count even when every slot is omitted. Opening screens still performs no source work. A deliberate retry uses existing slot mappings and source URLs, skips other omissions and valid local files, and commits fresh validated references through the unchanged staging/transaction order. Network/access failure or cancellation retains untouched MIME omissions for a later explicit retry. No body rescan, text replacement or manifest check is required for this already-scanned story.

Each operation returns at most eight transient MIME diagnostics, prioritizing rejections over successful samples, shown only by the development Contents UI: chapter ID, slot, normalized received MIME, byte-detected accepted format and validated/rejected status. The media-type token is bounded to 97 characters; malformed/overlong tokens or CR/LF/NUL values become `invalid`, missing MIME becomes `(missing)`, and parameters are discarded. Diagnostics contain no bytes, prose, source URLs, credentials or raw headers, and are neither logged nor persisted. `validated` describes byte/MIME validation, not successful reference commit; use authoritative local counts for persistence. The [Aenys retest](I2_Device_Checklist.md#i-aenys-mime-compatibility-retest) remains pending.

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

This audit establishes code/host-test evidence. No phone run or wire-level result is claimed. The [physical checklist](I2_Device_Checklist.md) covers v3 preservation, deliberate natural discovery/local rendering, already-running offline regeneration, practical cancellation/relaunch/retry, natural omissions, host-only missing/corrupt recovery and reader/I1/navigation regression.

### MIME compatibility follow-up validation

The narrow MIME follow-up adds **61 deterministic cases**: 50 MIME/byte-policy cases, nine host SQLite/files/download cases and two Contents UI cases. All prior cases remain; the old benign PNG-bytes/`image/jpeg` assertion now expects byte-authoritative acceptance, while its HTML/SVG rejection cases remain intact. Coverage includes every allowed raster-label/byte-format pairing, JPEG aliases, normalization/opaque MIME, unsupported labels with valid raster bytes, invalid/animated/oversized/trailing-HTML bytes under allowed labels, byte-derived extensions, the synthetic 58-slot/eight-old-failure retry, unchanged text/locators/schema, cancellation/access stopping, permanent non-MIME omissions and bounded/redacted/development-only diagnostics including a later rejection after successful samples.

Validation on Node **22.23.3**: `npm.cmd run check` passed TypeScript/lint and **393 tests / 23 suites**; `npx.cmd expo install --check` reported dependencies up to date; `npx.cmd expo-doctor@latest` passed **21/21**; `npx.cmd expo export --platform ios` exported the **1,248-module iOS Hermes bundle**; working/staged `git diff --check` passed. No dependency/lockfile changes or live SpaceBattles requests were made. Generated output/logs remain ignored.

A separate sequential diff/security review verified the unchanged byte parsers and budgets, unsupported MIME vetoes even for accepted raster bytes, conservative pre-validation login/challenge detection, byte-derived local format/extension, unchanged fresh-file/reference ordering and ownership checks, and the reason-specific deliberate retry boundary. Review refined the bounded diagnostic sample to retain later MIME rejections in preference to successes; the added regression and final check/export passed. No blocking finding remains. This is host evidence only; the Aenys image-rendering/offline retest and physical I2 acceptance remain pending.

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

No read/unread, deletion, automatic/background/scheduled update/image job, additional site/category, media/gallery/transcoding, revisions/sync/backend, S2B, EAS/Apple/signing/paid work, PR creation or merge is included. Stop after candidate commit/push and Owen's report handoff.
