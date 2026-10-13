# M1a - EPUB runtime and security feasibility

**M1a STATUS: ACCEPTED — SUPPORTED FEASIBILITY SCOPE**. Owen reports successful physical iPhone Quick, Extended and repeated Quick runs, followed by selected-file processing/cancellation and existing application checks. See **section R** for final acceptance and its evidence boundaries. This is not production EPUB support: persistent EPUB imports, Library integration and general third-party EPUB compatibility remain unimplemented. Peak memory remains unmeasured. Schema 3 / suite `m1a-3` remains current.

**Historical record:** sections A-Q retain the original readiness assessments, independent findings, failed physical Extended runs and successive corrections as recorded at each stage. Their pending-acceptance and no-commit statements describe those earlier passes; section R and the current closeout authorization supersede them. In particular, section P's 2,857.95 ms failure remains a failure, not retroactive acceptance.

**Independent-audit remediation, 12 October 2026:** The audit invalidated the original readiness assessment through a demonstrated XML slowdown and a canonical-output false positive. Sections A-N and the original closeout below are retained as historical pre-audit evidence. The current corrections and verification are recorded in **section O**; the historical 39/48 corpus counts and schema-v1 reports are superseded by Quick **48**, Extended **64**, and report/schema suite **v2**. Actual iPhone acceptance remains pending.

12 October 2026, America/New_York. Local implementation on `feat/m1a-epub-feasibility`, based on M0 merge `066516cdf794a66cdc9aa6b734f4f8390eee0505`. The starting tree was clean on `main`; the requested branch already existed at that same commit and was selected. No commit, push, PR, EAS build, signing change, or M1b work is authorized or performed.

## A. Executive decision

**READY WITH LIMITATIONS - Prototype implemented, with identified feasibility concerns requiring device investigation.**

The isolated pipeline processes synthetic reflowable EPUB 2/3 packages through bounded ZIP reads, strict XML and namespace validation, spine interpretation, the unchanged canonical sanitizer, and existing PNG/JPEG/WebP structural validation. It does not publish anything to the Library. An internal, explicitly enabled diagnostic runs the shared synthetic corpus and exports a content-free JSON report through the iOS share sheet.

Host correctness and direct-Node responsiveness evidence are positive. Actual Hermes/iPhone execution, native provider behavior, JSON sharing, native allocation pressure and standalone usability remain **unverified**. Synchronous XML parsing, accepted sanitizer calls and raster validation cannot be interrupted mid-call. The diagnostic is ready to investigate those limits; persistent EPUB integration is not yet authorized or justified by this evidence.

The design reference is [the multi-source architecture report](Stowaway_Multi_Source_Architecture_Report.pdf), especially pages 16-20 and 26-29. The [October audit](Stowaway_October_2026_Groundwork_Audit.md), accepted SpaceBattles evidence and [M0 policy boundary](M0_Capability_Boundary.md) retain their scope. This task does not change the [public-release/permissions boundary](Stowaway_Public_Release_Readiness_and_Source_Permissions.md).

## B. Dependencies and runtime evidence

| Dependency | Exact addition / license | Used public APIs and evidence |
| --- | --- | --- |
| `pako` | `3.0.2`, MIT AND Zlib | `ZStream`, `zlibInflateInit2`, `zlibInflate`, `zlibInflateEnd` from the public package root. Caller supplies fixed output storage. `deflateRaw` is used only to generate bounded original fixtures. Installed declarations and implementation inspected; real host-file tests, Metro and Hermes bytecode compilation passed. |
| `@noble/hashes` | `2.4.0`, MIT | Public `sha2.js` SHA-256, incremental `create().update()` for the exact package and bounded canonical/image hashes. Installed ESM exports inspected and compiled by Metro. No Node crypto polyfill enters the app. |
| `@rgrove/parse-xml` | `5.0.0`, ISC | Public `parseXml` and node classes. A synchronous tree parser, not a streaming or interruptible API. Its built-in duplicate-attribute/well-formedness validation is supplemented by an independent namespace pass. A lexical preflight limits structural tokens/depth/attribute literals before tree construction. |
| Expo FileSystem | Existing `~57.0.7`; unchanged | Installed SDK 57 `File.open(FileMode.ReadOnly)`, `FileHandle.offset`, `readBytes`, `writeBytes`, `size`, `close`, `Paths.cache`, disk-space and picker APIs. Native Swift and TypeScript inspected. Real native behavior remains a device gate. |
| React Native Share | Existing `0.86.3`; unchanged | `Share.share({url: generatedJsonFile})`. Installed iOS implementation passes the local URL to `UIActivityViewController`. No sharing module/native configuration addition. |

Only three packages were added; their lockfile integrity and license metadata are retained. No existing dependency version changed. No document-picker fallback was necessary at this stage; there is no new native module, ORM, DOM emulator, Node filesystem/zlib/crypto stack, backend or state manager in mobile code.

The SDK57 object-form `File.pickFileAsync` catches every native error and returns `canceled: true`. The still-supported deprecated two-argument overload preserves errors. M1a uses that overload, recognizes `ERR_FILE_PICKING_CANCELLED`, and classifies other failures without exporting their messages. This is a deliberate compatibility debt to recheck on SDK upgrades. Native Swift creates the picker with `asCopy: true`; a provider copy can happen before JavaScript checks the selected length. M1a never deletes the picker-returned file or provider original.

Official references inspected: [Pako public API](https://nodeca.github.io/pako/), [parse-xml source](https://github.com/rgrove/parse-xml), [Noble hashes source](https://github.com/paulmillr/noble-hashes), [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/), [React Native Share](https://reactnative.dev/docs/share). Published package metadata was also verified with `npm.cmd view` and the exact installed files. Browser/Node support and compilation are not evidence of actual iPhone execution.

## C. Architecture and ownership

- `bytes.ts`, `paths.ts`, `zip.ts`: strict UTF-8, incremental CRC32, separate archive-name/reference policies, seekable ZIP32 indexing, selective bounded extraction and incremental package hashing.
- `xml.ts`: lexical allocation guard, strict XML parser and namespace validation. Namespace scopes are shared through parent scopes, avoiding an inherited-map copy for every sibling.
- `package.ts`, `canonical.ts`: container/OPF/nav/NCX/metadata/spine handling, one XHTML spine item per chapter, body-only preprocessing and unchanged sanitizer invocation. Processing retains one current chapter body and bounded summaries, not an array of all chapter bodies.
- `fixtures.ts`, `corpus.ts`: original deterministic synthetic content. No private EPUBs, fanfiction, captures or fetched images.
- `diagnostic.ts`, `report.ts`: the same automated runner on host and device, typed outcomes, cleanup accounting, heartbeat and a versioned report. Reports contain no selected title, author, identifier, archive/member path, provider URI, prose or package fingerprint.
- `policy.ts`, `native.ts`, `app/epub-diagnostic.tsx`: static eligibility, native scratch-file access, one active native diagnostic operation, manual picker and deliberate local report sharing.

All native scratch files use `Paths.cache/stowaway-m1a/<generated UUID>/<generated UUID>.epub`. The archive namespace is never used as a disk path. Handles close before deletion. Only file/directory objects generated by the current operation are cleaned; no recursive scan of normal storage, S2A, source images or provider paths occurs. The parent cache directory may remain empty. Export uses its own generated JSON file and removes it after the share sheet settles.

An abrupt process kill can leave files in this dedicated cache namespace. M1a does not add a startup sweep, forensic erasure, durable recovery or an orphan-repair UI. Cleanup failures produce failed diagnostic results; retry is deliberate. The OS may reclaim cache files. This is a temporary feasibility sandbox, not a future retained-original implementation.

## D. Supported profile

Synthetic EPUB 2.0 and 3.0 with one selected OPF rendition, bounded title/creator/language/identifier/description/rights metadata, local XHTML spine resources, front matter, end matter and `linear="no"` auxiliary entries in their declared positions. Title, language and exactly one nonempty identifier selected by `unique-identifier` are required; creator, description and rights are optional. Duplicate titles do not imply identity. EPUB3 TOC navigation and EPUB2 NCX supply labels without changing chapter order. Empty supported sections retain their ordinal and receive an empty-section notice.

ZIP32 stored and raw-DEFLATE members, signed/unsigned ordinary data descriptors, explicit zero-payload directories, nested resource directories and UTF-8 NFC names are supported. Required `mimetype` is first, stored, exact and has no extra field. Optional shared archive-local static PNG/JPEG/WebP resources use existing validation and explicit omission reasons. Required member integrity failures, including an already-selected image's CRC/length failure, fail the package.

The canonical proof preserves paragraphs, headings, emphasis, lists, blockquotes, breaks and supported inline formatting. It removes active markup, source styling/attributes and all original image sources, including forged fixture markers. Image references are mapped out of band to generated canonical placeholder blocks. Availability never changes canonical HTML/hash/blocks. Validated explicit external HTTPS links use the existing `safeLink` policy; internal links preserve text but remain inert. No EPUB HTML is loaded directly into a WebView.

## E. Explicit incompatibilities

Not a conforming general EPUB reading system. Rejected: ZIP64/split/encrypted ZIP, unsupported compression/host attributes, symlinks/special entries, conflicting headers/ranges/descriptors, duplicate names or file/directory aliases, prepended/gapped archive layouts, ambiguous encodings, non-NFC member names, spaces/control characters/backslashes/percent aliases in literal archive names, multiple rootfiles, repeated spine resources, unsupported primary media, fixed-layout declarations, media overlays and declared scripted items.

UTF-16, unsupported encoding declarations, **all DTDs including legacy XHTML external doctypes**, custom named entities, XInclude and `xml:base` are rejected. The architecture's optional legacy-doctype compatibility allowance is not implemented. XML predefined/numeric entities and UTF-8 are supported. Namespace names use a deliberately conservative Unicode QName profile.

Meaningful encryption is rejected. Only the recognized IDPF obfuscation algorithm on a validated manifest font that is discarded, never a spine/cover/raster resource, is allowed. Unknown algorithms, key/transform structures, extra attributes and invalid/duplicate references fail. No font deobfuscation occurs.

Remote images, `file:`, data/blob/executable references, SVG/MathML, source CSS/fonts and unsupported images are not acquired. Internal hyperlinks, source typography, full layout fidelity, image rendering, actual raster decoder conformance, a persistent import UI and Library/Reader behavior for EPUB are outside this prototype.

## F. Resource limits and what they establish

| Limit | Enforcement |
| --- | --- |
| Selected archive 100 MiB | Checked before app-owned copy/open/index; does not bound the OS provider's preceding copy. |
| 10,000 members / 4 MiB central directory | EOCD checks before iteration; central records read selectively. All entries, including ignored ones, count. |
| 256 MiB declared total / actual produced output | Declared total covers every member. Actual extraction charges every emitted byte, including repeated reads and rejected processed resources. |
| 64 KiB input / output | Every seek read is capped. Raw inflater output is caller-owned; remaining budget + one byte detects a forged output length before retaining excess. EOCD search combines at most 65,557 bytes from bounded reads. |
| Expansion ratio | Reject declared output above 1 MiB when greater than 200:1. Actual output accounting remains authoritative. |
| XML | Container/encryption 65,536 bytes; OPF/nav/NCX 1,000,000 bytes; raw XHTML 4,000,000 bytes. Fatal decoding stops at 1,000,000 UTF-16 units; rewritten sanitizer input has the same ceiling. |
| XML structure | Depth 64; 30,000 nodes; 64 attributes/element. Lexical preflight rejects excessive opening tokens/depth/literal attributes early. Full-tree node and namespace acceptance checks still follow parsing. Additional conservative attribute-value cap: 65,536 units. |
| Paths | 1,024 UTF-8 bytes, 255 per segment. References decode once and resolve within the virtual root. |
| Spine / metadata | 2,000 items; metadata total 65,536 UTF-8 bytes; title/creator 512 characters, language 64, description/rights/identifier 8,192. Truncation is plain text, not active markup. |
| Canonical totals | 64 MiB charged for serialized HTML, block IDs, links, version and hash, not only visible text. No durable stage is published. |
| Images | 2,000 accepted unique digests; 64 MiB accepted bytes; existing 2,000,000-byte, 2048-dimension, 4,194,304-pixel validation. 32 accepted display instances and 8,388,608 pixels/chapter count repeated occurrences. |
| Disk / report | At least 512 MiB reported free before selection/copy; write failures still handled. Export JSON capped at 2,000,000 string units, explicit schema and bounded strings. |

These are actual acceptance/allocation controls, **not a proof of total heap safety**. Parser trees, namespace scopes, canonical/escaped strings, output summaries, hashing and native copies add overhead. There is no trustworthy supported peak-process-memory instrumentation in this implementation; `peakMemoryBytes` is explicitly `unavailable`. The Expo/Hermes presence indicator is not an invented engine version or memory reading. Native decoding/rendering memory is not exercised.

## G. Automated verification and reproducibility

Commands available from a clean source checkout:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run test:epub
npm.cmd run test:epub-security
npm.cmd run test:epub-report
npm.cmd run epub:fixtures
npm.cmd run epub:host-report
npx.cmd expo install --check
npx.cmd expo-doctor
git diff --check
```

The normal Jest discovery includes all EPUB suites in `npm run check`; no extra test runner or ignored script is needed. `epub:fixtures` generates the same corpus plus expected-outcome manifest under ignored `dist/m1a-fixtures`. `epub:host-report` uses the same runner and real host file handles outside Jest's VM, writes ignored `dist/m1a-reports/host-direct.json`, and exits nonzero on correctness, cleanup or responsiveness failure. Its small host-only TypeScript loader uses the existing TypeScript dev dependency; it is not bundled into the app.

The GitHub workflow continues lockfile install/full check and now explicitly exports public-disabled and internal-enabled iOS JavaScript. It performs no EAS build or device operation, and uploads no EPUB/prose. No remote CI run is claimed before a push.

Final local export commands (the deliberately enabled flag in the public export tests denial):

```powershell
$env:CI = '1'
$env:EXPO_PUBLIC_STOWAWAY_BUILD_AUDIENCE = 'internal-personal'
$env:EXPO_PUBLIC_STOWAWAY_EPUB_DIAGNOSTIC = 'enabled'
npx.cmd expo export --platform ios --output-dir dist/m1a-internal --clear
$env:EXPO_PUBLIC_STOWAWAY_BUILD_AUDIENCE = 'public'
npx.cmd expo export --platform ios --output-dir dist/m1a-public --clear
```

| Verification | Evidence |
| --- | --- |
| First runtime gate | Three real-file tests passed: raw DEFLATE, absent/signed/unsigned descriptors, fixed read/output buffers and exact content. |
| Final full repository check | `npm.cmd run check`: TypeScript, lint, **64/64** acquisition-boundary cases, **1,025/1,025 Jest tests / 40 suites** passed on the final runtime code. No tests skipped. |
| Final EPUB checks | **142/142 tests / 7 suites** passed from the clean source copy, including **48/48** budget tests, real 9,999/10,000/10,001-member archives and declared-total boundaries. No existing assertions/timeouts were changed. |
| Shared host/device corpus | **48/48** Extended cases passed in the direct-Node report, zero skips and cleanup failures. Quick contains 39 cases. |
| Expo dependency check / doctor | Passed; dependencies up to date, **21/21** doctor checks. |
| iOS exports | Internal-enabled and public-with-enabled-flag exports passed, **1,300 modules / 24 assets** each. |
| Protected production diff | Empty for storage/schema/migrations, reader/bridge/template, canonical sanitizer, image validation, sources/policy/registry, imports/ownership, domain and native app configuration. |
| Clean-copy verification | An ordinary OS-temp source copy with fresh `npm.cmd ci --offline --no-audit --no-fund` passed the then-current full check (**1,021 tests / 40 suites**, TypeScript/lint/64 boundary cases), generated all 48 fixtures, and passed the direct report. After review corrections, the final runtime/tests were synchronized, hashes matched, and **142/142 EPUB tests / 7 suites** plus the **48/48** direct report passed again. This is a clean source copy of the uncommitted candidate, not a pushed checkout or remote CI run. The first copy under `.tools` installed successfully but Jest discovered no tests beneath that hidden ancestor; discovery rules were not weakened. |

Coverage includes valid EPUB2/3/order/nav/auxiliary/shared images, forbidden headers/paths/encodings/descriptors, truncated/overlong streams, CRC and forged output, XML namespace collisions/unbound/reserved names, DTD/entities/XInclude, structural/string/attribute boundaries, inherited namespace pressure, exact canonical hashes and image-availability invariance, all accepted raster formats, animation/dimensions, explicit omissions, font obfuscation, four cancellation phases, repeated runs, real host file cleanup, denied native entry, stale UI handlers and report privacy/schema.

Not every maximum is expanded end to end on a phone or host: e.g. an actual 256 MiB preflight, 64 MiB canonical stage, 2,000 accepted images and all provider/storage failures are not claimed. Aggregate emitted-budget tests position the real counter near its cap and exercise bounded actual output. Declared totals are tested before payload access. Existing raster tests provide additional deterministic coverage, not new native evidence.

## H. Performance and bundle evidence

Windows, Node **22.23.3**, npm **10.9.9**. In the final direct-Node Extended run: **48 passed; 60.77 ms longest heartbeat delay; 1.00 ms worst injected cancellation latency; no cleanup failures**. The final clean-copy direct run independently passed 48 cases with **55.97 ms** longest delay and **1.14 ms** worst cancellation. These are host measurements, not Hermes predictions. The content-free reports are generated at ignored `dist/m1a-reports/host-direct.json` and `dist/m1a-reports/clean-copy-host.json`.

The initial Jest-VM report measured a **341 ms** dense-case stall, and **289 ms** after introducing cooperative traversal (XML parse approximately 220 ms, sanitizer approximately 278 ms in that run). The report correctly returned a failing performance verdict despite passing correctness assertions. The unmodified direct-Node runner separates host application timing from Jest's instrumented VM overhead; both observations are retained. This does not excuse a future iPhone failure. If the actual iPhone reports a stall above 250 ms, unacceptable memory pressure or cancellation above one second, revisit M1a before persistence. A broad sanitizer/reader rewrite would require separate scope.

The 10 ms heartbeat measures excess timer delay across fixture generation, I/O, parsing, conversion and cleanup. It includes scheduling/GC and cannot isolate every uninterrupted native/JS task. Phase durations include awaited work; dedicated XML-parser and sanitizer counters isolate those synchronous calls. Checkpoint-injected cancellation measures observation after an abort is requested at a bounded unit; it is not a native touch-event latency claim or interruption inside a synchronous call. Native picker time is outside the processing report.

| Comparable iOS Hermes export | Bytecode bytes |
| --- | ---: |
| M0 baseline, explicit internal, same machine/toolchain | 3,097,264 |
| M1a internal + flag enabled | 3,363,590 |
| M1a public + flag deliberately enabled | 3,363,590 |
| Internal increase | **266,326 (about 8.60%)** |

These are `.hbc` bytecode sizes, not IPA/download/installed sizes. All exports contain 24 assets; the baseline had 1,266 modules. No phone run or peak-memory figure is available.

## I. Security evaluation

The ZIP boundary validates EOCD/CD bounds, all central/local records, version/flags/method/time/name/size agreement, descriptor CRC/sizes, exact contiguous nonoverlapping local ranges, special files, names and declared totals before extracting resources. It requires exact compressed consumption, stream end, actual length and CRC for processed members. Stored and DEFLATE data share cumulative output accounting. Inflater state is freed in `finally`; the package owner always closes its input. Ignored resources have structural checks, not invented CRC evidence.

XML is never fetched, externally resolved or passed directly to the reader. Preflight is a conservative allocation guard, not the well-formedness authority; parse-xml and the namespace pass supply that authority. Prefix scopes avoid multiplicative map copying. Source IDs, handlers, CSS, image sentinels and bridge-looking attributes cannot survive the body serializer/sanitizer boundary. Unknown image formats are omissions; corrupt selected archive members are fatal.

The diagnostic imports no repository/database, source client or production image-file writer. Native denial precedes picker/scratch/export work, and selection rechecks after picker completion. Its route checks permission independently. Report export rejects unexpected schema fields rather than accidentally including future private metadata. Selected file errors never include parser excerpts, provider paths or exception messages.

The code remains experimental, with a custom ZIP validator and a synchronous tree parser. Passing fixtures is not a formal security proof. Separate adversarial code review is appropriate before persisting arbitrary packages. Final sequential review findings are recorded below.

## J. On-device workflow and access control

Both `EXPO_PUBLIC_STOWAWAY_BUILD_AUDIENCE=internal-personal` and the exact `EXPO_PUBLIC_STOWAWAY_EPUB_DIAGNOSTIC=enabled` are required. Missing/empty/malformed values deny; `__DEV__` never grants access. Release-JS preview uses the same gate. The new `epub-diagnostic` EAS profile inherits `preview` and adds only explicit environment values. Existing preview/production profiles, signing and bundle identifiers are unchanged.

Library shows **EPUB feasibility diagnostic** only for eligible builds. Opening `/epub-diagnostic` directly does not grant permission. **Run EPUB Test Suite** runs Quick in one action; **Run Extended Suite** runs the full corpus. Each generated fixture is written/read through actual native file handles, processed, closed and cleaned automatically. The summary reports failures, stalls and cleanup; **Export JSON Report** opens local iOS sharing/Save to Files. No upload occurs automatically.

**Select EPUB File** is optional and deliberate. It copies at most the accepted file size into generated scratch, processes it and reports counters without titles/prose/URIs. Picker cancellation/provider access/large-file behavior still need limited manual interaction. Backgrounding aborts automated suites; the picker flow allows native modal interaction. Unmount/cancel aborts work cooperatively, and native ownership prevents overlapping suites/selections/exports.

Public export was deliberately built with flag `enabled`. Expo's actual release environment transform produced audience `public` and flag `enabled`; the resulting Hermes bytecode retains the strict internal-audience comparison in both `diagnosticAllowed` and `requireDiagnostic`. Unit/native-route tests cover denial before effects. Experimental modules are **still present** in public bytecode. Runtime denial is not module exclusion or public-release readiness; no public distribution is authorized.

## K. Short physical acceptance checklist

No cloud build was initiated. **Only after Owen separately authorizes a diagnostic build**, the command is:

```powershell
npx.cmd eas-cli build --platform ios --profile epub-diagnostic
```

Use the existing internal installation route and enrolled device; no signing/provisioning change is part of M1a. Install the resulting ad hoc build over the existing internal application. Do not uninstall/reset the Library. For a development-only preliminary check, set `EXPO_PUBLIC_STOWAWAY_EPUB_DIAGNOSTIC=enabled` and use `npm.cmd start`; this does not establish standalone acceptance.

1. Open Library -> **EPUB feasibility diagnostic** -> **Run EPUB Test Suite**. Export the completed JSON report using **Export JSON Report** / Save to Files.
2. Tap **Run Extended Suite** and export that report. Require every expected case to pass, no skips/cleanup failures, longest stall <=250 ms, cancellation <=1 s. Repeat Quick once to check native reuse.
3. Optionally select one original/synthetic EPUB from On My iPhone and one from iCloud Drive, then cancel the picker once. Save the automatic reports; note provider failures separately. Use generated `epub2.epub` / `epub3.epub` if convenient. No individual chapter inspection or repeated manual cancellation is required.
4. Return to an existing downloaded story and confirm ordinary reading/Continue still works and Library entries are unchanged. This is a focused regression sanity check, not new exhaustive v0 acceptance.

The owner can attach/share the exported reports for analysis. Native sharing/Save to Files, copy cleanup, Hermes globals, provider cancellation and actual memory pressure remain unobserved by the agent until evidence arrives.

## L. Remaining feasibility questions

Does the actual standalone Hermes binary keep the adversarial corpus within responsiveness limits? Do synchronous tree/sanitizer/raster allocations remain practical on Owen's iPhone? Do SDK57 native file handles report/seek/close correctly after failures? Does local JSON sharing finish before cleanup across target activities? Do local/iCloud providers distinguish cancellations and failures as expected, including oversize files copied before JS can inspect them? How should dedicated cache remnants after process kill be handled in a later durable lifecycle?

No answer is inferred from Node, mocks, bytecode export or prior SpaceBattles phone acceptance. Accurate peak memory remains unavailable; a future macOS Instruments/device observation can supplement this diagnostic without inventing measurements now.

## M. M1b implications (not implemented)

First complete the physical gate and separate adversarial review. Then separately scope persisted local import/chapter UUIDs, exact-package SHA-256 and immutable original retention, resource ownership and recipes, schema v7's explicit manifest chapter IDs/file sidecars, stored-owner validation, atomic complete-manifest publication before bodies, generated immutable image files before references, Read/locator preservation, rollback and management cleanup changes. Full deletion and Remove Reading Copy must distinguish retained originals from disposable reading assets, protect referenced/active resources and preserve logical success after cleanup failure. Recovery must verify original bytes and recipe compatibility; no network fallback or automatic changed-package reconciliation. S2A must remain isolated v1. None of those durable changes is in M1a.

## N. Automation strategy going forward

Automation-first verification is a standing convention. Reuse deterministic fixtures and the same processing/diagnostic runner across host tests, normal CI and actual phone tests. Native manual work should be limited to installation, starting Quick/Extended, sharing reports and unavoidable provider interactions. The requested 90-95% is a workflow target, not a measured coverage percentage.

| Future option | Assessment |
| --- | --- |
| Expo simulator + Maestro on macOS | Most practical next UI smoke-test option if later milestones need it. Expo documents simulator `.app` builds and Maestro workflows; a simulator profile can avoid device signing. Requires macOS/Xcode or hosted macOS, installation/flow maintenance and SDK57-specific validation. Windows cannot run the local iOS Simulator. Deterministic synthetic fixtures help; real iCloud/provider behavior still needs a device. |
| XCTest/XCUITest | Apple-native route with strong native UI integration, but Xcode/macOS, native test-target maintenance and real-device signing add substantially more work than this spike needs. Defer. |
| GitHub hosted macOS | Could host simulator/Maestro jobs integrated with current Actions. macOS runner usage has recurring billing considerations; the current Windows host tests remain the default. No runner/service was provisioned. |
| Hosted physical devices | Can broaden device coverage but requires signed artifacts, service setup, privacy review and recurring costs. Device-farm providers do not reproduce Owen's personal iCloud/provider state automatically. Defer rather than introducing a service for this milestone. |

Official references: [Expo Maestro workflow](https://docs.expo.dev/eas/workflows/examples/e2e-tests/), [Maestro platform support](https://docs.maestro.dev/platform-support), [Apple XCTest](https://developer.apple.com/documentation/xctest), [GitHub runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing), [AWS Device Farm pricing](https://aws.amazon.com/device-farm/pricing/). The recommendation is an engineering assessment, not a claim these services were configured or SDK57-native tests were run. No paid service costs were incurred.

## Closeout and separate sequential review

The separate sequential review covered ZIP structure and budgets, parser allocations, virtual paths/namespaces, canonical/image boundaries, cancellation and cleanup, report privacy, diagnostic access, network isolation, M0 preservation, lockfile changes and test quality. This was a self-review after implementation, not a claim of independent adversarial review or a phone run.

Review corrections: rejected inconsistent ZIP minimum versions, added yields while validating parent-file collisions, retained failed-phase timing evidence with `finally`, and rejected duplicate/empty OPF selected identifiers while accepting a valid selected identifier that is not first. Regression assertions cover the timing and identifier findings. Existing tests/assertions/timeouts were not weakened. Final verification and clean-copy results are recorded above.

One full check run overlapped two Metro exports and an existing I4 UI test exceeded its unchanged 5-second timeout. A serial full rerun passed 1,022/1,022 before the final identifier correction; the final serial result is recorded above. The cause of that one timeout was not proven, so it is retained as a validation limitation rather than hidden. The initial hidden-directory clean-copy discovery failure is also retained above.

The implementation is ready for a separate adversarial review. No known material correction remains within this isolated prototype's stated profile. Device findings may still require corrective work before persistence. All changes remain local and uncommitted; no push, PR, EAS build, signing/provisioning change or M1b work occurred. Physical acceptance remains pending.

## O. Independent-audit remediation - 12 October 2026

### Findings, corrections and regression evidence

**F1, P1 - XML amplification.** The independent reviewer measured approximately 280 / 10,444 / 33,048 ms for 100k / 200k / 400k character inputs, and roughly 33 seconds for a complete 402 KB EPUB. This was an actual vulnerability within the accepted limits, not an oversized-file rejection. Before editing `xml.ts`, the local reproduction used `x\r` repeated inside one XHTML paragraph: 100,111 / 200,111 / 400,111 source units and a 402,299-byte complete stored-XHTML EPUB. Local dependency-parser times were **297.64 / 10,323.83 / 33,141.89 ms**. The complete EPUB took **33,042.52 ms** total, with **32,795.50 ms** parser time and a **32,803.00 ms** timer stall. Output was correct and all byte/buffer limits were met, demonstrating why those limits alone were insufficient.

`src/epub-spike/xml.ts` now normalizes literal CR and CRLF to LF before declaration checks and the dependency parser. It scans UTF-16 units once, uses one 4,096-unit buffer, emits bounded chunks and joins once, with cooperative checkpoints. Output never exceeds input length; at the one-million-unit source cap there are at most 245 chunks including the final partial chunk. The original input, output chunks and joined output can coexist, each bounded by input length, plus the fixed buffer and runtime string/array overhead. This is bounded normalization work, not a measured parser/native heap ceiling. The original decoded limit applies **before** normalization can shrink CRLF. Numeric references remain undecoded until the XML parser, preserving `&#13;` / `&#xD;` as CR. UTF-8, strict well-formedness, namespace and resource restrictions remain intact. The dependency itself is unchanged.

`tests/epub-xml-remediation.test.ts` checks text, attributes, comments, CDATA, processing instructions, numeric references, chunk boundaries, surrogate pairs and pre-normalization budget enforcement. Shared complete-package fixtures add six large CR/CRLF/mixed/comment/CDATA/PI cases, a malformed CR-heavy document, and a small character-reference case. `scripts/epub-xml-benchmark.cjs` records comparable host inputs, parser/total duration, heartbeat, output correctness and resource counters; `--before` refuses any source other than the recorded original XML source hash, preventing accidental relabeling of corrected timings. Timing artifacts are local generated evidence under `dist/m1a-reports/xml-before.json` and `xml-after.json`.

**F2, P1 - canonical-output false positive.** The independent audit erased **1,642,406 canonical HTML characters** yet obtained **48 passed / 0 failed / verdict pass**. The first local empty-output regression likewise found **zero functional failures** in the old runner (its Jest-VM performance verdict separately failed). This defect is retained here rather than recast as valid acceptance evidence.

`src/epub-spike/expectations.ts`, `corpus.ts` and `diagnostic.ts` now require explicit output expectations on every accepted synthetic case. The real chapter callback checks exact independently authored canonical HTML, stable generated block IDs, formatting, links, image references/omissions, callback counts/order and package summaries. Expected HTML is never computed by calling the sanitizer or canonicalizer. Stress cases have explicit expected output. Linear block scanning avoids one full HTML search per block. Assertions run identically in host, Quick and Extended diagnostics, and retain no chapter body after its callback. Selected private files receive structural checks, not a claim of synthetic golden-text verification.

`tests/epub-mutation.test.ts` injects empty HTML, corrupted text, omitted paragraph content, surviving script markup, callback ordering corruption and an omitted chapter callback. Each must produce functional FAIL, independently of the timing verdict. A new shared hostile-content fixture checks removal of scripts, event handlers, embedded/form/style content, executable links and forged image/reader markers, while preserving safe formatting and explicit image omissions.

**F3, P2 - double BOM bypass.** Previously, the wrapper removed one BOM and the parser removed another, bypassing the wrapper's declaration policy for UTF-16 and XML 1.1. The wrapper now accepts at most one leading UTF-8 BOM and rejects another before declaration inspection. Tests cover no BOM, one/two/three BOMs, UTF-16 and XML 1.1 with one/two BOMs, and malformed declarations. Full package tests apply the matrix to container XML, OPF and XHTML; shared device cases cover chapter declarations. Rejections are typed `xml` failures.

An isolated regression-sensitivity run temporarily removed only the new BOM guard: all three selected double-BOM package tests failed because processing incorrectly **resolved**, including UTF-16 and XML 1.1. The exact corrected source bytes were restored in `finally` before normal verification. These intentionally failing tests are evidence that the new assertions detect the original bypass, not unclosed failures in the final candidate.

**F4, P2 - stale reports.** `src/app/epub-diagnostic.tsx` invalidates both visible and referenced reports synchronously when any new processing attempt starts. Export handlers read the current report reference, including retained old handlers. Early provider/policy/storage failures and picker cancellation show an explicit current-attempt state with no exportable old result. A valid new failure report can be exported as that failure. Repeated runs retain single-operation ownership. Tests cover Quick/Extended success followed by picker/provider failure, cancellation, failure before generation, pending attempts, repeated failures/successes, retained export presses and recovery to a new result.

Reports now use schema **2**, suite **m1a-2**, and an attempt ID made from the start timestamp plus a process-local sequence. The ID contains no device/file/user identifier and is not a durable cross-install identity. Pre-report failures have a numbered UI attempt state; they do not manufacture processing counters or export a fake completed report.

A second isolated sensitivity run removed current-report invalidation from the screen: the success-then-picker-failure test failed because the old export control remained present. Exact source bytes were restored in `finally`. Normal corrected screen tests retain the assertion and pass; no production bypass switch remains.

**F5, P2 - unenforced performance.** `.github/workflows/check.yml` now runs `npm run epub:host-report` serially after `npm run check` and before exports. Its nonzero exit is not ignored. `scripts/epub-host-report.cjs` verifies the full ordered corpus, removes its previous fixed report path before starting, validates the new report and fails on a non-pass verdict. `report.ts` independently recomputes summary values, validates fields/counters, rejects contradictory successes and prevents empty/skipped runs from becoming PASS. The **250 ms stall / 1,000 ms cancellation thresholds are unchanged**.

`tests/epub-host-gate.test.ts` launches the real host CLI in isolated child processes and intercepts only the runner result: valid success exits zero; performance, security, cleanup, invalid schema, inconsistent summary, skipped, cancelled and exception cases exit nonzero. Invalid/exception runs leave no stale success report. This is a failure-propagation test, not substituted processing evidence; the real complete host suite is also run normally. No production fault-injection switch was added. A workflow assertion detects removal or misordering of the host step.

**F6 - Expo validation discrepancy.** The five mismatches reproduced: `expo install --check` exited 1; doctor reported **20/21**, with the same five patch recommendations. Registry checks confirmed publication and SDK57 guidance. Installation used `npx.cmd expo install` for the four runtime packages and `npx.cmd expo install --dev jest-expo@~57.0.6`. No SDK or React Native major changed and no validation exclusion was added.

| Direct package | Before | After |
| --- | --- | --- |
| expo | 57.0.27 | 57.0.28 |
| expo-crypto | 57.0.3 | 57.0.4 |
| expo-router | 57.0.25 | 57.0.26 |
| expo-splash-screen | 57.0.9 | 57.0.10 |
| jest-expo | 57.0.5 | 57.0.6 |

The new package manifests require ten transitive changes: `@expo/fingerprint` 0.20.13 -> 0.20.14, `@expo/inline-modules` 0.1.7 -> 0.1.8, `@expo/local-build-cache-provider` 57.0.8 -> 57.0.9, `@expo/prebuild-config` 57.0.17 -> 57.0.18, `@expo/ui` 57.0.22 -> 57.0.23, `babel-preset-expo` 57.0.14 -> 57.0.15, `expo-modules-autolinking` 57.0.14 -> 57.0.15, `expo-modules-core` 57.0.21 -> 57.0.22, `expo-modules-jsi` 57.1.1 -> 57.1.2, and Expo's nested `@expo/cli` 57.0.28 -> 57.0.29. Incidental Radix/Vaul, nanoid, postcss and React Native Web Babel-plugin updates were restored to compatible prior lock entries, then validated with npm's offline lock resolution and a fresh `npm ci` (1,078 packages). No persistent overrides or unrelated direct upgrades were added.

These patches have native implications. Crypto changes how ArrayBuffer/DataView digest input reaches the native module; Stowaway's image path already supplies Uint8Array. Core/UI include hosted-content layout changes; JSI includes Xcode 26/Swift 6.2 build fixes. Existing app source is unchanged, but previous M0 phone acceptance does not validate this new native dependency set. Inspect installed changelogs and the official [crypto](https://github.com/expo/expo/blob/sdk-57/packages/expo-crypto/CHANGELOG.md), [core](https://github.com/expo/expo/blob/sdk-57/packages/expo-modules-core/CHANGELOG.md), [JSI](https://github.com/expo/expo/blob/sdk-57/packages/expo-modules-jsi/CHANGELOG.md), [UI](https://github.com/expo/expo/blob/sdk-57/packages/expo-ui/CHANGELOG.md) and [Jest](https://github.com/expo/expo/blob/sdk-57/packages/jest-expo/CHANGELOG.md) release notes. A fresh internal binary and focused existing-library/navigation/reader/native-provider smoke test are required when a build is separately authorized.

### Corpus and verification closeout

The corpus grew from Quick 39 / Extended 48 to **Quick 48 / Extended 64**. The 16 additions are one active-content golden, six long line-ending cases, one malformed CR case, one literal/reference semantics case, and seven BOM/declaration cases. Quick gains nine small cases; Extended additionally gains seven bounded stress/rejection cases. Fixtures remain original, deterministic and generated on demand.

The independently run focused regression command passed **46/46 tests across four suites**: six mutation tests, 17 XML-remediation tests, 12 host-gate tests and 11 screen tests. Empty-output mutation now fails every one of the 15 accepted corpus cases. It also disrupts later-stage rejection cases, so the test checks all 15 accepted results explicitly and permits additional failures in the aggregate; it does not assume only accepted cases can fail after a mutation. The erroneous aggregate equality was caught by a full check and corrected without removing the per-case assertions.

The serial working-tree `npm.cmd run check` passed **1,083/1,083 Jest tests across 43 suites**, TypeScript, ESLint and **64/64 acquisition-boundary checks**. The separately invoked `npm.cmd run test:epub` passed **200/200 tests across ten suites**, including the unchanged 48 resource-budget tests. The real `epub:host-report` passed **64/64**, with zero skips, cleanup failures or critical failures. `epub:fixtures` generated all 64 original fixtures. `expo install --check` reported dependencies up to date; `expo-doctor` passed **21/21**. Jest remains a dev-only dependency; the installer-added duplicate runtime entry was removed and npm's offline lock resolution passed.

One earlier serial full check after reinstall hit the existing I4 public-screen test's unchanged five-second timeout (1,082 other tests passed). Its isolated rerun passed all 38 I4 UI tests, with the previously timed-out case completing in 1.8 seconds; the final working-tree full run also passed. The cause of that initial timeout was not established. No existing timeout, assertion or production test was changed to obtain the pass.

### Measured F1 before/after and timing limits

Windows / Node 22.23.3 / npm 10.9.9; no install, export or second test workload overlapped these direct-host measurements. The complete EPUB used exactly 402,299 bytes in both runs.

| Input | Dependency parser before / after (ms) | Total before / after (ms) | Longest heartbeat stall before / after (ms) |
| --- | ---: | ---: | ---: |
| 100,111 XML units | 297.64 / 4.54 | 346.36 / 46.09 | 290.50 / 7.73 |
| 200,111 XML units | 10,323.83 / 2.18 | 10,358.61 / 51.37 | 10,319.33 / 8.10 |
| 400,111 XML units | 33,141.89 / 2.23 | 33,190.59 / 50.17 | 33,137.00 / 8.03 |
| Complete EPUB | 32,795.50 / 4.53 | 33,042.52 / 286.56 | 32,803.00 / 28.56 |

Every output-correctness assertion passed. Complete-package output remained **401,810 bytes**, with maximum input/output buffers **65,536 / 65,536 bytes**, within unchanged limits. Original total timing included the ending heartbeat observation wait; the corrected benchmark stops total timing before that wait (about 15 ms). Parser and stall comparisons use the same measurement definitions. These samples show removal of the demonstrated superlinear CR path, not a universal runtime bound or native heap measurement. Warm-up, timer scheduling and GC affect small timing differences.

The actual direct-host Extended report passed with **89.90 ms** maximum stall and **0.64 ms** worst injected cancellation latency. The optional Jest-VM report had 64 functional passes but a **282 ms dense-valid stall**, and correctly retained **verdict FAIL / one critical performance failure**. Dense-case dependency parse and sanitizer timings were **238 / 249 ms** under Jest versus **32.94 / 57.90 ms** in direct Node. The ratio-rejection fixture also showed **235 ms** in Jest versus **23.39 ms** direct; that case includes synthetic compression/generation before rejection. This is consistent with substantial VM/instrumentation overhead, but scheduling and GC were not separately isolated. The source, fixtures, assertions and thresholds are the same; no limit was raised and no failed report was rewritten as PASS. Normal CI now separately enforces the direct host verdict. A device or CI-host failure must still stop acceptance and be investigated; repeated noisy shared-runner failures would justify a separately reviewed calibrated/dedicated performance environment, not automatic retries or a disabled gate.

### Clean reproduction, exports and sequential review

A fresh source-only directory outside the repository copied tracked and nonignored candidate files, with no `.git`, `node_modules`, `.tools`, `dist`, private fixtures or build cache. `npm.cmd ci --offline --no-audit --no-fund` installed **1,078 packages** from the lockfile; the offline npm package cache supplies registry tarballs, not project-generated inputs. Its serial `npm.cmd run check` passed **1,083/1,083 tests / 43 suites**, type checking, lint and all 64 boundary checks. The earlier I4 timeout did not recur. Its actual `epub:host-report` passed **64/64**, zero skips/cleanup failures, **77.97 ms** maximum stall and **0.61 ms** worst cancellation latency. Fixture generation and `expo install --check` passed. All **64 regenerated EPUB SHA-256 values matched** the working-tree fixtures; the automated determinism test also regenerates every fixture twice. No ignored script or private file is required. A later source-comment clarification described allocation coexistence; executable code did not change after these checks.

The clean-copy report, logs and fixture hash manifest are preserved locally under ignored `dist/m1a-reports/`. The generated temporary copy was removed after validating its exact absolute target. Windows long-path cleanup was needed for nested dependency files; final absence was verified. An initial clean-install invocation was interrupted by PowerShell's terminating treatment of npm warning stderr; the subsequent complete install and checks used actual process exit codes. Neither that shell issue nor the earlier I4 timeout is presented as a package/test pass.

Both explicit local iOS exports passed serially, with the diagnostic flag deliberately **enabled in both**:

| Audience | Output | Hermes bytecode bytes |
| --- | --- | ---: |
| internal-personal | `dist/m1a-remediation-internal` | 3,382,297 |
| public | `dist/m1a-remediation-public` | 3,382,296 |

The commands were `npx.cmd expo export --platform ios --output-dir <the directory above> --clear`, with `CI=1`, the explicit audience and `EXPO_PUBLIC_STOWAWAY_EPUB_DIAGNOSTIC=enabled`. Each compiled 1,301 modules. Bytecode inspection confirmed the compiled audience values and the exact internal-personal/flag comparison; the public flag does not authorize execution. Native-entry and route tests deny before picker/filesystem/processing effects when permission fails. The route remains bundled and displays a disabled diagnostic for an ineligible audience; it is not a public importer. Existing M0 audience/acquisition tests and the complete library regressions passed. These exports verify JavaScript/Hermes compilation, not installation or actual Hermes execution on an iPhone. The size change also includes Expo patch maintenance and is not an isolated feature-size comparison.

After implementation and verification, a separate **sequential self-review** inspected the full tracked diff and untracked candidate files: bounded ZIP32/DEFLATE, virtual paths, XML/BOM handling and allocation, golden assertions and fault injection, attempt/report ownership, privacy and cleanup, policy gates, CI exit propagation, dependency classification and documentation history. No additional material code issue was identified. This does not substitute for a fresh independent adversarial review. `git diff --check` passed; no existing test timeout/assertion was weakened. The original 33-second parser failure and false-positive report remain documented above.

The protected production paths have **no diff against M0 HEAD**: schema v6/migrations, identities, canonical sanitizer, reader/bridge, image algorithms, SpaceBattles acquisition/pacing, ownership, locators/Read state, Continue Reading, management, M0 policy and S2A isolation are unchanged. Integration remains the gated diagnostic link/route and isolated modules. Expo patches can still affect native runtime behavior despite unchanged application source. No real source request, private EPUB, phone operation, data reset, cloud build or signing operation occurred.

### Current decision and device-gate answers

**READY WITH LIMITATIONS - Material corrections implemented; required automated commands pass, with the separately recorded Jest-VM timing failure and native evidence still pending.**

1. **Install on the existing iPhone:** suitable for a controlled internal update after independent re-review and separate build authorization. Preserve the existing installation/data. The diagnostic adds no migration or normal-library write. Host review cannot certify the untested native binary, and the new Expo patches require existing-library/navigation/reader smoke testing.
2. **Quick and Extended:** appropriate for the controlled physical gate. Run Quick **48/48**, then Extended **64/64**, export each current report and repeat Quick. Require no skips/cleanup failures, stall <=250 ms and cancellation <=1,000 ms. A device failure requires investigation, not threshold adjustment.
3. **Arbitrary EPUB selection:** not yet appropriate as unrestricted acceptance testing. First pass the synthetic device suites, then deliberately select a small known supported reflowable EPUB to exercise Files/provider cancellation and sharing. Provider copying before the JavaScript size check, native allocation and unsupported formats remain limitations.
4. **Report trust:** schema 2 / suite `m1a-2` reports now verify actual golden output for synthetic cases and identify the current completed attempt. Mutations, exceptions, cleanup failures, skips, cancellation and performance failures cannot become an ordinary PASS through the tested paths. Failed/cancelled pre-report attempts cannot export an earlier success. Reports exclude selected prose, metadata and private paths. This is scoped diagnostic evidence, not an EPUB conformance/security certificate or proof that every passage in an arbitrary book survived.
5. **Physical-acceptance blockers:** no remaining known material F1-F6 code blocker to starting controlled device testing. Actual Hermes/iPhone responsiveness, memory pressure, provider behavior, cancellation, JSON sharing, standalone behavior and regression checks with the new native dependencies must pass before physical acceptance. Peak memory remains unavailable and synchronous calls remain non-interruptible mid-call.
6. **Fresh independent review before a build:** recommended, especially the corrected XML/oracle/attempt/CI boundaries and dependency changes. This implementing agent's sequential review is not independent acceptance.

Ready for independent re-review and an eventual separately authorized commit. Everything remains local and uncommitted on `feat/m1a-epub-feasibility`; HEAD is still `066516cdf794a66cdc9aa6b734f4f8390eee0505`. No commit, push, PR, EAS build or M1b work was performed.

### Complete candidate working-tree inventory

This includes the original uncommitted M1a implementation and its remediation, not just files changed during remediation. **8 modified, 29 untracked**; generated evidence/build outputs remain ignored.

```text
M  .github/workflows/check.yml
M  AGENTS.md
M  README.md
M  eas.json
M  jest.config.js
M  package-lock.json
M  package.json
M  src/app/index.tsx
?? docs/M1a_EPUB_Feasibility.md
?? scripts/epub-host-report.cjs
?? scripts/epub-xml-benchmark.cjs
?? src/app/epub-diagnostic.tsx
?? src/epub-spike/bytes.ts
?? src/epub-spike/canonical.ts
?? src/epub-spike/corpus.ts
?? src/epub-spike/diagnostic.ts
?? src/epub-spike/expectations.ts
?? src/epub-spike/fixtures.ts
?? src/epub-spike/limits.ts
?? src/epub-spike/native.ts
?? src/epub-spike/package.ts
?? src/epub-spike/paths.ts
?? src/epub-spike/policy.ts
?? src/epub-spike/report.ts
?? src/epub-spike/xml.ts
?? src/epub-spike/zip.ts
?? tests/epub-budgets.test.ts
?? tests/epub-diagnostic.test.ts
?? tests/epub-host-gate.test.ts
?? tests/epub-mutation.test.ts
?? tests/epub-native.test.ts
?? tests/epub-package.test.ts
?? tests/epub-screen.test.tsx
?? tests/epub-security.test.ts
?? tests/epub-xml-remediation.test.ts
?? tests/epub-zip.test.ts
?? tests/fixtures/epub-report.ts
```

## P. Physical Hermes performance failure and correction candidate

### Physical evidence supplied by Owen

On 12 October 2026, Owen reported the actual internal, diagnostic-enabled iOS/Hermes execution below. The agent did not operate or observe the phone, receive a profiler trace, or independently inspect the complete native report. These exact measurements come from the remediation request. They supersede section O's host-only performance readiness judgment; none of the historical records above is retroactively changed into a physical pass.

- Quick: **48/48 PASS**, longest stall approximately **19.48 ms**.
- Extended: **64/64 functional PASS**, **zero skips**, **zero cleanup failures**, but overall **FAIL** because of performance. Latest attempt: `2026-10-12T23:46:22.043Z#3`.
- Longest stall: **2,857.95 ms**, repeatable; an earlier Extended execution was approximately **2,780 ms**.
- No normal-library mutation was reported. This is not an agent-observed inspection of the phone database.

| Case | Reported JS stall | Other reported measurements | Decision |
| --- | ---: | --- | --- |
| `dense-valid` | 2,857.95 ms | XML parsing 2,868.93 ms; XML stage 3,268.43 ms; whole case 4,124.55 ms | Violates 250 ms |
| `long-text` | 436.50 ms | Canonical 402.00 ms; hashing 259.90 ms; XML parsing 56.86 ms | Violates 250 ms |
| `ratio` | 261.53 ms | ZIP indexing 1.22 ms; no decompression or XML parsing | Violates 250 ms |
| `namespace-scopes` | 225.30 ms | XML parsing 235.94 ms | Below, but close to 250 ms |

The **250 ms stall / 1,000 ms cancellation** gates are unchanged. All four cases remain in Extended, with the same input generators, original expected outcomes and content goldens. No supported structure/resource limit was lowered. M1a physical acceptance remains **FAILED / awaiting a corrected run**.

### Diagnosis and evidence boundaries

**Dense XML: a demonstrated avoidable allocation mechanism.** The installed parser's `StringScanner.consumeUntilMatch` used `source.slice(currentOffset).search(pattern)` at each text/attribute scan. It has no namespace resolver: Stowaway's namespace pass runs after `parseXml` returns. Thus namespace-scope construction or later canonical traversal cannot account for this report's `xmlParse` interval. Namespace attributes increase the number of scans and the remaining input copied. Each element/text still allocates a tree node, attributes use null-prototype objects, names are scanned character by character, and those linear costs remain after the correction.

Hermes v0.17.0's [`StringPrimitive::slice` implementation](https://github.com/facebook/hermes/blob/hermes-v0.17.0/lib/VM/StringPrimitive.cpp#L303) constructs a new string and appends the selected characters. The installed dependency source, `node_modules/@rgrove/parse-xml/src/lib/StringScanner.ts`, uses suffix slicing before search. Repeated suffix work grows with both document length and token count. This explains why Node timings were insufficient evidence; it is not a claim that every millisecond of the iPhone trace has been attributed.

The independent synthetic driver `npm.cmd run epub:parser-benchmark` varies sibling count, attribute count, namespace declaration placement, depth, text length and empty-versus-text node count. It measures actual one-argument `String.prototype.slice` work in an isolated VM and checks complete edge-case trees/offsets and rejection parity. `npm.cmd run epub:parser-benchmark -- --hermes <explicit-exe>` runs the same experiment on a separately supplied CLI. No CLI is installed as an app dependency or downloaded by that script.

A separately downloaded official [Hermes CLI v0.13.0](https://github.com/facebook/hermes/releases/tag/v0.13.0) was used for mechanism investigation. It is **older than the app's installed Hermes compiler/RN revision, runs on Windows, uses a TypeScript-lowered standalone harness and has no iOS/native integration**. Its timings are not phone results, acceptance, or an exact forecast. One recorded comparison before the final slice-counter refinement was:

| Independent variation | Original parser | Corrected parser | Original suffix characters copied |
| --- | ---: | ---: | ---: |
| 1,000 siblings, two attributes each | 54 ms | 42 ms | 84,028,004 |
| 3,000 siblings, two attributes each | 662 ms | 129 ms | 756,084,004 |
| 9,000 siblings, two attributes each | 2,704 ms | 363 ms | 6,804,252,004 |
| 2,000 siblings, sixteen attributes each | 2,743 ms | 452 ms | 9,072,210,004 |
| 3,000 siblings, depth 10 / depth 40 | 276 / 266 ms | 131 / 129 ms | 758,065,289 / 764,022,944 |
| 981,000 text characters, few nodes | 171 ms | 178 ms | 981,004 |
| 3,000 siblings preceding 500,000 text characters | 1,462 ms | 138 ms | 3,108,551,004 |

The correction removes suffix copies while retaining scan counts, node counts and output. **Some corrected standalone calls still exceed 250 ms.** This is a real residual synchronous-parser concern, not a waived failure or a claim that the demonstrated iPhone problem is fully eliminated. If the actual phone still fails, do not broaden the patch into a streaming parser, split documents, lower arbitrary limits, or replace the architecture without a separate decision backed by the new measurements.

**Long text: insufficient old instrumentation, plus confirmed uninterrupted work.** In schema 2, `canonical` included XML-to-HTML rewriting, the production sanitizer, whole-string UTF-8 encoding and a one-shot SHA-256 call. There was no timer yield between sanitization and that hash. The separate `hash` timing was the package digest, already processed in 64 KiB reads with checkpoints; its 259.90 ms total was not evidence of one 259.90 ms synchronous call. The old report cannot uniquely locate the 436.50 ms heartbeat delay. The correction bounds text escaping/decoding and canonical/image hashing, and yields immediately after sanitization. New operation maxima separate the competing explanations; a corrected phone run must establish the remaining sanitizer/parser/native scheduling cost.

An isolated probe using the installed SHA-256 implementation over 981,045 synthetic bytes took **862 ms** in one call on the older Windows Hermes CLI; 16 KiB updates had a **24 ms maximum unit**, **922 ms total**, and the identical digest. This probe excludes encoding and does not install timers; it demonstrates bounded synchronous hash work, not an end-to-end phone latency. The current app inserts actual timer checkpoints between units.

**Ratio: fixture preparation was inside the old heartbeat.** The test creates and raw-deflates 1,048,577 repeated bytes, computes CRCs and assembles a synthetic ZIP before opening it. The high-expansion filter then rejects during index validation, so there is no extraction/XML work to explain the old stall. Source inspection and isolated synthetic measurements identify preparation as a credible large synchronous contributor; the old aggregate heartbeat cannot prove that GC/native write/scheduling contributed zero. Schema 3 reports preparation duration and its own heartbeat separately, drains that interval, then begins processing measurement **before scratch acquisition/copy**. This scope change is explicitly authorized by the remediation request, not a reclassification of the old Extended failure.

The same older-Hermes probe measured **468 ms** for ratio-fixture raw DEFLATE (1,034 compressed bytes), then **276 ms** for its CRC. These are artificial preparation costs; the phone's exact split remains unmeasured. The original case's rejection precedes any chapter expectation; suite-summary construction, JSON serialization and sharing happen outside the per-case heartbeat. No timing result is attributed to GC without evidence.

### Corrections and maintenance tradeoffs

1. **One pinned dependency method, unchanged parser grammar/tree.** `scripts/epub-patch-parser.cjs` replaces only the scanner's suffix-search implementation in the exact Node and Metro browser artifacts of `@rgrove/parse-xml` **5.0.0**. A per-pattern cached global regex searches the original string from the absolute UTF-16 offset. The existing scanner still consumes the matched span and maintains supplementary-codepoint offsets. All four private call-site patterns are unanchored, non-sticky and have no lookbehind; this correction is not a general replacement for arbitrary `String.search` semantics. No runtime prototype patch, source-dependent code generation, parser replacement or vendored parser fork enters the app. The third-party correction is deliberate maintenance debt, justified by the measured allocation problem. Both whole original artifacts are SHA-256 pinned; unknown versions/content/partial patch states fail closed. `npm` postinstall applies it; `precheck` and the host report require it. Dependency upgrades must revisit it. Existing package versions and lockfile integrity entries are unchanged by this pass; the lockfile adds only the root `hasInstallScript` marker relative to the incoming candidate.
2. **Bounded work with unchanged identities.** EPUB-only fatal XML decoding and escaping use bounded chunks. UTF-8 byte sequences and UTF-16 surrogate pairs remain intact at the relevant decoding/encoding boundaries. SHA-256 remains exactly `UTF8(sanitizerVersion + '\n' + canonicalHTML)`; incremental content/image hashes use 16 KiB units, with real timer checkpoints. The original sanitizer, block/link numbering, source image validator and ZIP/security budgets are untouched. XHTML is not split into independently sanitized fragments. Canonical output still goes through the unchanged sanitizer as one document.
3. **Measured operations and separation points.** XML decode/parser, canonical escaping/joins, sanitizer, content/package/image hashes, image validation, serialized-output assembly, assertions and cleanup have fixed-name call counts, total synchronous time and maximum call time. XML normalization/preflight/namespace validation, canonical rewrite/content hashing, scratch acquisition and cleanup have additional stage totals. Stage totals include yields and can nest; summing them double-counts work. Checkpoints separate sanitization, hashing, output assembly and assertions. No heartbeat is falsely labelled as caused by whichever stage last ran.
4. **Schema 3 / suite `m1a-3`.** Per-case `preparation` measurements are outside the unchanged processing gate; processing includes JS scratch writing/copying, reads, extraction, validation, output assertions and cleanup. GC/scheduling attribution and peak memory remain unavailable. Native Files selection and the OS-managed provider copy still happen before selected-file processing and are explicitly disclosed as unmeasured. Schema 2 reports remain historical evidence and are not relabelled; the new serializer deliberately rejects them. Additional fields remain strictly allowlisted and bounded, with no content, metadata, filenames or URIs added to exported reports.
5. **Single-case investigation.** Four explicit internal buttons rerun `dense-valid`, `long-text`, `ratio` or `namespace-scopes`, using the real corpus/oracle/IO path. Reports have tier `single` and are labelled investigation only. They cannot replace full Quick/Extended results. The same policy, native exclusive owner, cancellation, stale-report invalidation and export rules apply. No automatic work runs when opening the route.

### Validation and sequential review

Generated evidence lives under ignored `dist/m1a-hermes-remediation` and `dist/m1a-reports`; no generated reports, binaries or private books are added to Git. Windows PowerShell / Node **22.23.3**, npm **10.9.9**. All tests are synthetic/local. A test-authoring parameterization error in the first new UTF-8 test was corrected before the successful complete runs; no product assertion was relaxed.

| Verification | Result |
| --- | --- |
| `npm.cmd run check` | TypeScript, ESLint, **64** acquisition-boundary checks, **44 suites / 1,099 tests PASS**; final repeat exit 0 |
| `npm.cmd run test:epub` | **11 suites / 216 tests PASS**, exit 0 |
| `npm.cmd run test:epub-remediation` | **5 suites / 60 tests PASS**, exit 0; includes unchanged canonical mutations and hostile XML plus new performance/hash boundaries |
| `npm.cmd run epub:host-report` | Actual final serial **64/64 PASS**, zero skips/cleanup failures; processing stall **41.29 ms**, injected cancellation **1.21 ms**, exit 0 (earlier run: 48.25 / 2.98 ms, also PASS) |
| `npx.cmd expo install --check` | Dependencies current, exit 0 |
| `npx.cmd expo-doctor` | **21/21 PASS**, exit 0 |
| Fresh `npm.cmd ci --offline --no-audit` in a generated external temp directory | **1,078 packages installed**, postinstall correction applied, both artifact checks PASS; exit 0 |
| Internal and public `npx.cmd expo export --platform ios --clear` | Both PASS, exit 0; diagnostic flag deliberately `enabled` in both, distinct explicit audiences; no native build |
| Exported Hermes bytecode inspection | Internal `internal-personal` / public `public`, enabled flag, strict audience-and-flag tests, native entry denial and the corrected offset scanner present in both; bundle sizes **3,400,736 / 3,400,737 bytes** |
| `git diff --check` | PASS (only existing Windows line-ending notices) |
| Independent fixture preservation comparison | All **64** generated byte hashes, outcomes, order and tiers match the saved pre-remediation review; no exclusions or changes to the fixtures |

The final actual host report records the four processing stalls as **41.29 ms dense**, **14.99 ms long text**, **8.26 ms ratio**, **17.27 ms namespace scopes**. The dense parser's maximum measured call is **26.28 ms** and sanitizer's **39.74 ms**. Long-text content hashing's maximum update/digest call is **0.30 ms**. These numbers are **Node host evidence only**. New tests deliberately inject a >250 ms preparation stall and disclose it separately; a >250 ms scratch-acquisition stall still makes the real measured report FAIL. Unchanged CLI tests exercise performance/security/cleanup/skip/cancel/contradictory-report/exception failures. The report still cannot turn functional 64/64 into a performance PASS.

After implementation, a separate sequential diff/security pass compared the exact incoming uncommitted candidate with this result, including untracked files. It reviewed scanner-pattern equivalence and artifact drift guards, surrogate/UTF-8 boundaries and hash identity, unchanged resource limits/oracles, report privacy and unchanged failure thresholds, case selection, stale handlers/native ownership, scratch cleanup and compiled gates. No new material correctness/security/isolation blocker was found. This is the implementing session's separate review, **not an independent reviewer or physical acceptance**. The remaining synchronous-call performance concern and patch maintenance debt are explicit above. M0 policy and S2A storage/source isolation regressions passed; their production code and the normal database, reader, sanitizer and SpaceBattles implementation are byte-identical to the incoming candidate. No live fiction requests were made.

**Exact files changed in this remediation pass (25):** the incoming M1a work remains uncommitted separately from this incremental inventory. Four additions are marked `new`; all other listed files already existed in the incoming working tree.

```text
AGENTS.md
README.md
docs/M1a_EPUB_Feasibility.md
package.json
package-lock.json
scripts/epub-host-report.cjs
scripts/epub-parser-benchmark.cjs             (new)
scripts/epub-patch-parser.cjs                 (new)
src/app/epub-diagnostic.tsx
src/epub-spike/bytes.ts
src/epub-spike/canonical.ts
src/epub-spike/corpus.ts
src/epub-spike/diagnostic.ts
src/epub-spike/hash.ts                        (new)
src/epub-spike/limits.ts
src/epub-spike/native.ts
src/epub-spike/package.ts
src/epub-spike/report.ts
src/epub-spike/xml.ts
src/epub-spike/zip.ts
tests/epub-diagnostic.test.ts
tests/epub-native.test.ts
tests/epub-performance.test.ts                (new)
tests/epub-screen.test.tsx
tests/fixtures/epub-report.ts
```

### Minimal fresh iPhone gate

After focused independent review, load this exact candidate's JavaScript in an explicitly internal-personal, diagnostic-enabled SDK57/Hermes environment. Creating a new EAS build remains separately authorized work. Preserve the existing installation/Library; do not uninstall or reset storage.

1. Run **Quick 48/48**, export its current schema-3 report.
2. Run **Extended 64/64**, export its current report. Require overall **PASS**, zero skips/cleanup failures, processing stall **<=250 ms** and measured cancellation **<=1,000 ms**. Inspect `dense-valid`, `long-text`, `ratio` and `namespace-scopes` operation maxima and preparation fields. Functional 64/64 alone is insufficient. The prior approximately 2.8-second runs remain failed evidence.
3. Repeat **Quick 48/48** and export. Briefly reopen an existing local chapter and its saved passage/images/Contents to confirm ordinary Library behavior remains usable. No live source work is needed.
4. Only if a case fails, use its single-case button once more and export for diagnosis; record whether the UI can respond to Cancel/backgrounding. Do not treat a single-case pass as suite acceptance. Do not repeat unrestricted arbitrary-book selection before the synthetic performance gate passes.

This pass creates a **candidate for independent focused review**, not a phone-performance pass. The remaining decision is whether the unchanged synchronous parser/sanitizer can meet the original gates on the actual phone after the bounded corrections. A major parser or architecture replacement has not been undertaken or authorized here. No commit, push, PR, EAS build, normal-library write, schema migration, reader/sanitizer/SpaceBattles change, fiction-site request or M1b work was performed.

## Q. Final diagnostic reliability corrections

The independent review of section P verified the parser correction, incremental hashes, timer yields, dependency installation and local EAS source packaging, but required two diagnostic fixes before another controlled phone run. This section supersedes section P's diagnostic-readiness conclusion. The failed physical Extended evidence in section P remains unchanged.

**Closeout: READY FOR FOCUSED RE-REVIEW.** Both reliability corrections and automated verification are complete. This is not physical acceptance or authorization to start M1b.

### Independent reproductions and corrections

**F1, P2: acquisition failure could satisfy an expected validation rejection.** Injecting `EpubFailure('budget')` into acquisition of the unchanged `ratio` fixture produced **64 passed / 0 failed / 0 skipped / 0 cleanup failures / overall PASS**. That case read zero bytes and never entered ZIP processing. Native low-storage checking can produce that same category before processing. The independent artifact is `dist/m1a-independent-review/acquire-budget-false-pass.json`.

The runner now tracks preparation, acquisition, processing and assertion stages independently of error category. Synthetic preparation failure is no longer rethrown as acquisition failure. The processor supplies a typed `ProcessingFailure` with one of validation, read, assertion, unexpected, cancelled or cleanup origins. Its adapter boundary converts thrown/rejected reads, short or invalid read results, throwing size access and impossible size metadata to read-origin `io`, even if the underlying exception is already an `EpubFailure('budget')`. Chapter-output callback exceptions have assertion origin. No underlying exception message or cause enters the report.

A corpus rejection can pass only with processing-stage, validation-origin evidence and the expected category, or the deliberate cancellation checkpoint with cancellation origin. Merely invoking the processor, matching the category or reading some bytes is insufficient. Legitimate early ZIP checks remain eligible, including valid archive sizes that violate the existing size budget; extraction or canonical output is not required for early rejection. Accepted cases retain the same independent canonical assertions. Fixed notes disclose failure origin using the existing schema-3 fields; report shape, suite ID and validators remain unchanged. The existing `summary.warnings` counts all notes, so a normal Extended run now has 49 origin notes; those expected rejections/cancellations are not 49 failures and do not change the verdict.

The original fault now runs through the **actual Extended host CLI** with all real fixtures, expectations and host files, intercepting only ratio acquisition. It produces **63 passed / 1 failed / 0 skipped / 0 cleanup failures / overall FAIL**, exit **1**. Ratio retains `expected: budget` and `actual: budget`, but is `status: fail`, with acquisition origin and zero bytes read. The same CLI is the existing mandatory serial CI step after normal checks, without `continue-on-error`. The regression also verifies report serialization, summary consistency and absence of the injected private message. Evidence: `dist/m1a-reliability/acquisition-fault-host.json`. CI was exercised locally through its command; no remote CI run is claimed.

**F2, P3: cleanup timing measured an idempotent second close.** The independent 315 ms first-close injection produced a **322.0581 ms** heartbeat stall and overall FAIL, but only **0.0727 ms** cleanup stage time and **0.0431 ms** maximum cleanup operation. Evidence: `dist/m1a-independent-review/diagnostic-faults.json`.

`processEpub` now times its actual owning `finally` close with the existing cleanup stage and synchronous operation counters, on success, rejection, cancellation and unexpected failure. The diagnostic no longer makes a measured successful second close. It measures scratch cleanup separately, and only attempts an explicit close fallback/retry when ownership did not start or the first close failed. A first-close exception records a sticky cleanup failure before retry, so successful later release cannot erase the failed outcome. Native handle counters still increment only after successful close; native scratch ownership and generated paths are unchanged. Ordinary diagnostic cleanup has two measured operations: owning close and scratch cleanup. A real failed-close retry adds an operation; an external later idempotent close changes neither recorded operation counts nor closed-handle count.

The focused 315 ms regression requires cleanup stage and cleanup maximum **>=315 ms**, heartbeat **>250 ms**, and overall **FAIL**, while the legitimate ratio validation still passes functionally and resources balance. The serial corrected probe measured **325.7279 ms** heartbeat, **315.3476 ms** cleanup stage and **315.1292 ms** maximum cleanup operation, with exactly one owning close, balanced resources and zero cleanup failures. Its overall verdict remains **FAIL**, as required. The heartbeat stays active throughout owning close and scratch cleanup. Evidence and rerunnable synthetic probe: `dist/m1a-reliability/slow-close.json` and `slow-close.cjs`.

### Regression coverage and scope

`tests/epub-reliability.test.ts` covers real early ratio rejection; preparation failure; reserve/copy failures with matching category and partial-cleanup counters; synchronous/rejected native-style reads, short/invalid reads, throwing/invalid size; integrity-fixture short read; callback failure; ordinary close and subsequent idempotency; the 315 ms close; first-close exception on accepted and rejected input followed by successful retry; persistent close failure; cancellation, validation and unexpected processing failure followed by close; and scratch-cleanup failure. Reports are checked for private-message leakage and coherent verdicts.

`tests/epub-native.test.ts` additionally exercises the actual native adapter's low-storage branch and a mocked native scratch write throwing the matching budget category, including balanced writer/file cleanup. `tests/epub-host-gate.test.ts` reproduces the full-suite acquisition fault through the real host command. The reliability and native suites are now included in `test:epub-remediation`; normal `check` and `test:epub` also discover them. No fault switch or threshold override was added to product code.

The incremental implementation changes exactly seven files relative to the incoming uncommitted performance candidate:

```text
docs/M1a_EPUB_Feasibility.md
package.json
src/epub-spike/diagnostic.ts
src/epub-spike/package.ts
tests/epub-host-gate.test.ts
tests/epub-native.test.ts
tests/epub-reliability.test.ts                 (new)
```

Native adapter implementation and report structure did not need changes: acquisition provenance is established by the shared runner, and the processor enforces the read/close boundary. No dependency or lockfile change is part of this incremental pass. The incoming uncommitted M1a files remain separate from this seven-file inventory.

### Verification and separate sequential review

Windows PowerShell, Node **22.23.3**, npm **10.9.9**. All inputs are original synthetic fixtures. During test authoring, an operation-counter property typo (`count` instead of the existing `calls`) was corrected before successful checks; no assertion or threshold was weakened. Generated reports, source snapshots, the incremental diff and detailed inventory are ignored under `dist/m1a-reliability`.

| Verification | Result |
| --- | --- |
| `npm.cmd run check` | TypeScript, ESLint, **64** acquisition-boundary checks and **45 suites / 1,124 tests PASS**, exit 0 |
| `npm.cmd run test:epub` | **12 suites / 241 tests PASS**, exit 0 |
| `npm.cmd run test:epub-remediation` | **7 suites / 89 tests PASS**, exit 0 |
| Focused `npx.cmd jest --runInBand --runTestsByPath tests/epub-reliability.test.ts tests/epub-native.test.ts tests/epub-host-gate.test.ts` | Initial root **40/40 PASS**; final clean-source run with added invalid-size case **3 suites / 41 tests PASS**, exit 0 |
| `npm.cmd run epub:host-report` | Final serial actual **64/64 PASS**, zero failed/skipped/cleanup failures; **39.5583 ms** stall / **1.4878 ms** cancellation, exit 0 (earlier serial run: **44.3678 / 1.3904 ms**, also PASS). Final run restores the normal report after deliberate CLI fault tests. |
| Fresh external source verification | **193 source files** compared, no mismatches; `npm.cmd ci --offline --no-audit --no-fund` installed **1,078 packages**, normal postinstall and explicit pinned scanner check PASS; fresh TypeScript and focused tests PASS |
| Clean-source actual host report | Serial **64/64 PASS**, zero failed/skipped/cleanup failures; **36.7473 ms** stall / **1.1027 ms** cancellation, exit 0 |
| `npx.cmd expo install --check` | Dependencies current, exit 0 |
| `npx.cmd expo-doctor` | **21/21 PASS**, exit 0 |
| Internal and public `npx.cmd expo export --platform ios --clear --output-dir dist/m1a-reliability-export-<audience>` | Both PASS, exit 0; explicit `internal-personal` / `public` audiences, diagnostic flag `enabled` in both; JavaScript/Hermes exports only |
| Exported bytecode inspection | Both **3,407,130 bytes**; correct audience constants, strict audience-and-flag gates, native policy denial and unchanged corrected scanner verified |
| `git diff --check` and incremental untracked-file whitespace checks | PASS; existing Windows line-ending notices only |

After the implementation, two separate read-only sequential reviews examined provenance/false positives and owning-close lifecycle/report consistency. They found no remaining material blocker. Six independent provenance probes also passed, including attempts to forge validation-origin errors from preparation, acquisition and read adapters. Eight independent lifecycle probes passed, including pre-ownership failure and successive close failures. A review suggestion to normalize impossible adapter size metadata was implemented and verified; zero-length/oversize valid metadata still reaches genuine ZIP validation. Documentation received a separate accuracy review. Evidence: `independent-provenance-review.json`, `clean-verification.json`, and `dist/independent-review-hash/close-review.json`.

Snapshot comparison confirms that SQLite schema v6, migrations, SpaceBattles acquisition, reader/WebView bridge, production sanitizer, M0 policy, reading state and S2A isolation code are unchanged. The parser patch, hash/canonical/XML/ZIP implementations, native adapter, report serializer, corpus, expectations and limits are byte-identical to the incoming candidate. Normal application and security regressions passed. No device operation is inferred from these checks.

The overall working tree remains at `feat/m1a-epub-feasibility`, based on `066516cdf794a66cdc9aa6b734f4f8390eee0505`: **8 modified tracked files and 34 untracked files**, including the pre-existing M1a candidate. This pass changes only the seven files listed above. The other work was preserved. `working-tree.txt`, `candidate-hashes.json` and `corrections.diff` record the full local inventory and comparison against the incoming source snapshot. No files were staged and no commit or push was made.

### Remaining uncertainty and exact physical retest

The independent parser review found **38,718 differential comparisons without mismatches**, reproducible clean-install patching and correct inclusion in actual local EAS source staging. Hash/canonical identity and real timer yields were verified independently. Those mechanisms were not reopened here. The pinned parse-xml 5.0.0 correction, budgets, 48/64 corpus, goldens, schema 3 and **250 ms / 1,000 ms** gates remain intact.

Older Windows Hermes CLI core probes from the independent review still measured corrected dense XML parse maxima of **366-381 ms** and sanitizer calls of **302 ms**, and long-text sanitizer calls of **298 ms**. Their golden outputs passed. Those probes use an older engine, lowered standalone code, no iOS file adapter and no representative heartbeat; they are neither current-iPhone timing nor acceptance. They remain evidence of residual synchronous work, which these two diagnostic corrections do not optimize. Native provider interaction, current iOS/Hermes scheduling, peak allocation and actual close latency remain physically unverified.

After focused re-review, use this exact candidate in an explicitly **internal-personal** and **diagnostic-enabled** SDK57/Hermes environment. A new EAS build requires separate authorization. Preserve the installation and Library; do not uninstall or reset storage.

1. Run **Quick 48/48** and export its current schema-3 report.
2. Run **Extended 64/64** and export. Require overall **PASS**, zero skips and cleanup failures, processing heartbeat **<=250 ms** and measured cancellation **<=1,000 ms**. Check all four performance cases, preparation/acquisition measurements, cleanup stage/maxima and validation-origin notes for expected rejections. Functional 64/64 alone is insufficient.
3. Repeat **Quick 48/48** and export. Briefly reopen an existing local chapter, its saved passage, images and Contents. No live source request is needed.
4. If a case fails, use its single-case button for diagnosis and export; note Cancel/background responsiveness. A single-case pass cannot replace complete suites. Do not resume arbitrary-book selection before the synthetic gate passes.

No corrected iPhone run or physical acceptance is claimed. No commit, push, PR, EAS build, normal-library write, schema migration, reader/sanitizer/source/M0 change or M1b work is authorized by this pass.

## R. Final physical acceptance and milestone closeout

**M1a STATUS: ACCEPTED — SUPPORTED FEASIBILITY SCOPE**

Owen's milestone-closeout request reports that the final independent review returned **PASS — READY FOR IPHONE RETEST**, followed by the successful physical sequence below. These are user-supplied measurements and attestations; this closeout agent did not run or observe the iPhone, independently inspect the complete native report files, or instrument the existing Library smoke test. The selected-file attempt timestamp is preserved in UTC below (12 October 2026, 23:38:03.361 in America/New_York).

### Physical suite acceptance

All three runs report React Native / iOS / Hermes, explicit **internal-personal** audience, diagnostic **enabled**, schema **3**, and suite **`m1a-3`**.

| Run | Tests passed | Maximum processing JS stall | Cancellation latency | Overall verdict |
| --- | ---: | ---: | ---: | --- |
| Quick #1 | 48/48 | 12.35 ms | 0.137 ms | PASS |
| Extended | 64/64 | 101.90 ms | 0.139 ms | PASS |
| Quick #2 | 48/48 | 14.18 ms | 0.135 ms | PASS |

Each run reported zero unexpected failures, zero skips, zero cleanup failures and zero critical failures. Across the three suites, **160/160 tests passed**, **160 scratch resources were created and removed**, and **320 file handles were opened and closed**, with no cleanup failures. These totals exclude the later selected-file attempt. The original **250 ms maximum processing stall / 1,000 ms maximum cancellation latency** gates remain unchanged; neither test counts, goldens nor thresholds were relaxed for acceptance.

### Successful performance remediation

The earlier Extended run's **2,857.95 ms** maximum stall remains failed physical evidence in section P. The corrected Extended run's **101.90 ms** maximum is approximately **96.4% lower**: `(2857.95 - 101.90) / 2857.95`. This compares the reported worst observations under the disclosed measurement scopes; it is not a universal performance bound.

| Fixture | Previous reported stall | Corrected processing stall |
| --- | ---: | ---: |
| `dense-valid` | 2,857.95 ms | 101.90 ms |
| `long-text` | 436.50 ms | 93.37 ms |
| `ratio` | 261.53 ms | 8.16 ms |
| `namespace-scopes` | 225.30 ms | 33.34 ms |

Dense XML parsing improved from approximately **2,868.93 ms to 113.00 ms**. The correction retains the parser grammar/tree and exact pinned 5.0.0 artifacts, removes repeated suffix-copy scanning, and bounds EPUB-only decoding, escaping and hashing work with timer checkpoints. The original production sanitizer, canonical identities and security/resource budgets remain intact. Sections P and Q describe the reproducible correction and diagnostic reliability fixes in detail.

**Measurement distinction:** `ratio` still reported approximately **262.13 ms of synthetic fixture-preparation stall**. Schema 3 measures and discloses preparation separately, outside the processing gate. The corrected **8.16 ms** is actual file processing, including scratch acquisition/copy, reads, validation, assertions and cleanup. The old ratio measurement included synthetic generation/compression; its before/after row is therefore not a like-for-like processing-only comparison. The earlier failure is not relabelled as a pass, and the preparation stall is not concealed or claimed to meet 250 ms.

### Native picker and existing application

After the suite sequence, Owen reports one deliberately selected EPUB processed successfully: **1 passed, zero failed, zero skipped**, approximately **7 ms maximum stall**, and **zero cleanup failures**. Attempt: `2026-10-13T03:38:03.361Z#4`. A subsequent cancelled selection displayed **`file selection cancelled; no current report`**, confirming the reported current-attempt behavior rather than exposing a stale success.

Owen also reports that the existing application checks worked. This is a **user-attested existing Library smoke test**, not instrumented verification of every Library feature, storage row or native dependency. No universal document-provider coverage, provider-copy timing, allocation measurement or exhaustive native regression acceptance is inferred.

### Accepted scope and remaining limitations

- Acceptance covers this isolated runtime/security feasibility implementation and the reported corpus/device sequence. **M1a does not provide persistent EPUB imports, Library integration or general third-party EPUB compatibility.** A selected-file success is structural diagnostic evidence, not synthetic golden-output coverage for that book.
- Peak process/native memory remains **unavailable**, not measured or accepted as a numerical bound. Synchronous parser, sanitizer and image-validation calls remain non-interruptible mid-call. Older standalone Windows Hermes findings remain in sections P/Q with their distinct limits.
- Files/provider selection and any OS-managed copy occur before measured selected-file processing. One successful selection and cancellation do not test every provider, oversized-provider copy, low-storage failure, sharing failure, abrupt kill or native raster decoder/rendering path.
- The conservative EPUB profile and incompatibilities in sections D-F remain. Ignored ZIP members have structural checks but no inflated CRC evidence; source styling and internal link behavior remain limited. Abrupt process death can leave files in the dedicated cache; no automatic repair/sweep or retained-original lifecycle is added.
- The hash-pinned `@rgrove/parse-xml` **5.0.0** scanner correction remains deliberate maintenance debt. `postinstall` applies it, `precheck` and the host report require it, and version/content drift fails closed. A future dependency upgrade needs separate review.
- **M1b remains excluded:** no schema v7, migrations, persistent identities/sidecars, retained packages, normal-library publication, import/resume/repair/removal integration, reader changes, source acquisition, new EAS build, signing change or public-distribution authorization.

The closeout updates documentation only over the accepted incoming implementation. Owen subsequently directed the agent to commit and push using normal Git authentication and **stop after pushing**; PR creation will be handled separately. No additional tools or authentication changes are authorized by that instruction.

### Final automated verification and sequential review

Final local verification used Windows PowerShell and Node **22.23.3**. The full/dedicated test suites and the direct host performance run were serial; no Metro export or second test workload overlapped the host measurement. No assertions, timeouts, thresholds or accepted implementation code were changed during closeout.

| Closeout verification | Result |
| --- | --- |
| `npm.cmd run check` | TypeScript, ESLint, **64/64 acquisition-policy boundary checks**, **45 suites / 1,124 Jest tests PASS**, exit 0 |
| `npm.cmd run test:epub` | **12 suites / 241 tests PASS**, exit 0 |
| `npm.cmd run test:epub-remediation` | **7 suites / 89 tests PASS**, exit 0 |
| `npm.cmd run epub:host-report` | **64/64 PASS**, zero failed/skipped/cleanup/critical failures, **172.6429 ms** processing stall and **3.1207 ms** cancellation, exit 0 |
| `npx.cmd expo install --check` | Dependencies current, exit 0 |
| `npx.cmd --no-install expo-doctor` | Existing tool, **21/21 PASS**, exit 0; no tool installation |
| Internal and public iOS exports | `npx.cmd --no-install expo export --platform ios --output-dir dist/m1a-closeout-<audience> --clear`, with `CI=1`, explicit `internal-personal` / `public`, and diagnostic flag deliberately `enabled` in both: **both PASS**, exit 0; JavaScript/Hermes compilation only, no EAS/native build |
| Compiled gate inspection | Both bytecode files **3,407,130 bytes**; actual audience constants and strict audience-plus-flag comparisons in `diagnosticAllowed` / `requireDiagnostic` verified. Public still denies with the flag enabled; experimental modules remain bundled, so this is runtime denial rather than module exclusion or public-release readiness. |
| Parser installation-workflow reproduction | Exact hash-verified original Node and Metro artifacts reconstructed in an isolated ignored directory; the manifest's normal `postinstall` command applied the patch, `--check` passed, a second postinstall was idempotent, and both results matched the installed corrected artifacts byte-for-byte |
| Working/staged patch checks | `git diff --check` and `git diff --cached --check` **PASS**; staged inventory matches the 42 reviewed files, with generated/unrelated files excluded |

The 49 host warning notes are the expected validation/cancellation-origin notes described in section Q, not unexpected failures. Host timings remain host evidence only. This closeout's patch reproduction verifies the normal lifecycle command without a fresh dependency installation; previous clean `npm ci` evidence is retained in sections P/Q. Generated logs and reproduction files remain ignored under `dist/`.

After the documentation edits, a separate sequential self-review examined all incoming modified/untracked files and the final documentation changes: archive/path/XML boundaries, canonical and image identity, failure provenance, owning close and scratch cleanup, report privacy, current-attempt UI handling, native policy denial, CI failure propagation, dependency/lockfile scope and parser-patch reproducibility. No remaining material blocker was found within the accepted feasibility scope. This is a closeout self-review, distinct from the earlier independent reviews and Owen's phone evidence. Protected production paths have no diff against M0: SQLite/schema/migrations, reader/bridge, canonical sanitizer, source image validation, SpaceBattles acquisition, ownership/reading state, M0 policy and S2A isolation; `app.json` and its encryption declaration are unchanged. Integration is limited to the gated Library diagnostic link and new isolated route/modules.

GitHub Actions is configured for pull requests and pushes to `main`, not pushes to this feature branch. Because Owen deferred PR creation, no PR-triggered remote CI or merge-readiness result is claimed by this closeout. The mandatory serial host gate and both audience exports remain in the committed workflow.

### Complete milestone file inventory

The closeout inspected **8 modified tracked files and 34 untracked files**, all belonging to the accepted milestone. The complete 42-file commit scope is listed below; the closeout itself edits only `AGENTS.md`, `README.md` and this report. Generated EPUBs, private files, local JSON reports, caches, dependency installations, bytecode and build artifacts are excluded.

```text
.github/workflows/check.yml
AGENTS.md
README.md
eas.json
jest.config.js
package-lock.json
package.json
src/app/index.tsx
docs/M1a_EPUB_Feasibility.md
scripts/epub-host-report.cjs
scripts/epub-parser-benchmark.cjs
scripts/epub-patch-parser.cjs
scripts/epub-xml-benchmark.cjs
src/app/epub-diagnostic.tsx
src/epub-spike/bytes.ts
src/epub-spike/canonical.ts
src/epub-spike/corpus.ts
src/epub-spike/diagnostic.ts
src/epub-spike/expectations.ts
src/epub-spike/fixtures.ts
src/epub-spike/hash.ts
src/epub-spike/limits.ts
src/epub-spike/native.ts
src/epub-spike/package.ts
src/epub-spike/paths.ts
src/epub-spike/policy.ts
src/epub-spike/report.ts
src/epub-spike/xml.ts
src/epub-spike/zip.ts
tests/epub-budgets.test.ts
tests/epub-diagnostic.test.ts
tests/epub-host-gate.test.ts
tests/epub-mutation.test.ts
tests/epub-native.test.ts
tests/epub-package.test.ts
tests/epub-performance.test.ts
tests/epub-reliability.test.ts
tests/epub-screen.test.tsx
tests/epub-security.test.ts
tests/epub-xml-remediation.test.ts
tests/epub-zip.test.ts
tests/fixtures/epub-report.ts
```
