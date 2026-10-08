# Pre-UI hardening — F1–F3

7 October 2026, America/New_York. Branch: `fix/pre-ui-hardening`, based on merged I4 main `9bcffd4c4d1d08c0e8ab3a127d5e9b3e3dcdf6d5` (PR #8).

The final whole-repository Astra audit is complete. Its three MEDIUM / PROVEN BUG findings are implemented in `ce294ddd47079338d02a19557df1fcd54df854c8`. **PRE-UI HARDENING FOCUSED PHONE RETEST PASSED**, as reported by Owen on that implementation. Functional v0 feature work through I4 is complete. UI polish is the next phase after this patch is merged; it has not started. S2B remains deferred, full v0 acceptance remains incomplete, and historical milestone evidence is unchanged. Current work is acceptance bookkeeping, validation, a separate acceptance commit/push and PR preparation against `main`; no merge or new product work is authorized.

## F1 — manifest redirect continuity

A same-thread redirect from requested index page 2 to page 3 could yield a false COMPLETE manifest without a scoped total. A real SQLite audit probe unlisted the skipped entry and advanced the successful-check timestamp.

Manifest discovery now checks logical request/response continuation identity before consuming rows, layered above unchanged transport safety. Index page omission means page 1. Endpoint, numeric page, category scope and remaining query parameters must agree; duplicate query keys are rejected. Range responses must retain the range endpoint, category ID, min/max and other supplied continuation parameters. Numeric normalization, query ordering, same-thread slug canonicalization and an optional endpoint trailing slash remain possible. Unknown page-size equivalence is not guessed. Index scope is checked again against the parser's proven primary category before accepting rows.

Changed/ambiguous continuation identity produces `incomplete`, including at the initial index. No incomplete traversal reaches reconciliation. Attempt time may advance; prior COMPLETE membership, Read state, bodies/locators and last-success time remain unchanged.

Regressions cover page skipping, initial-page skipping, category/alias/endpoint/page-size changes, duplicate query keys, range changes and valid canonicalization. Actual RequestClient redirects plus real host SQLite cover the omitted entry as downloaded, pending and an unavailable retained shell.

## F2 — locator revision ordering

An older failed save could repopulate `pending` after a newer sample had already entered the write queue, yielding writes 10 → 20 → 10.

Each accepted ready position sample now has a monotonically increasing in-memory revision. Pending and queued work carry that revision. Failure restores a retry candidate only when its revision still equals the newest accepted revision. A newer sample supersedes older retries whether pending, queued, saving or committed. The latest failed sample remains retryable. No revision is persisted.

Regressions cover A-fails/B-succeeds, both failing, B pending versus queued, rapid A/B/C failure combinations and overlapping background/exit/dispose flushes. Real host SQLite rollback tests verify the final locator, unchanged canonical content, FK validity and independent Read persistence. Existing single-failure retry, debounce and reader handoff tests remain.

## F3 — local reading anchors in paragraph gaps

Every imported chapter has a block-bearing outer wrapper. Previously that wrapper could win when only whitespace lay between the reading line and adjacent paragraphs, yielding a chapter-wide pixel offset and large typography drift.

The bridge indexes nearest-block content ownership once. Pure structural wrappers have no reading content of their own. Visible leaf prose, headings, lists, quotes, tables/cells, preformatted text and image blocks use their bounding boxes. Mixed containers remain eligible at their own text/inline-media rectangles, without claiming child-block whitespace. Sampling prefers intersecting content, then the nearest following content, then nearby preceding content. Hidden collapsed descendants supply no visible candidate. The stored identity remains the existing owning block; no DOM/canonical content rewrite occurs.

Exact-script bridge tests now use the real synthetic import/sanitizer topology and explicit emulated geometry, including 100 paragraphs, font increases/decreases, nested wrappers, direct text, mixed containers, spoilers, tables/lists/pre/quotes/headings, image/placeholder blocks and final-gap fallback. Opening/restoration/reflow still cannot create a transient top locator or infer Read completion. Host geometry is not WKWebView physical evidence.

## Invariants and scope

- Canonical HTML, sanitizer/version/hash generation, block IDs and image slot mappings are unchanged.
- SQLite schema, migrations, repository identity, retained shells, Read state and locator format are unchanged.
- I3 route-owned completion, explicit quiescence acknowledgement, exit settlement and failure recovery are unchanged.
- Same-hash restore, spoiler ancestry and changed-hash/progression fallback remain intact. Old wrapper-wide locators are retained; exact retrospective repair is not promised.
- Source client, redirect safety, credentials, spacing, retries and source authorization are unchanged. All tests use synthetic fixtures/injected transports; no live SpaceBattles requests.
- No unrelated LOW fixes, UI redesign, S2B work, dependency changes, new product scope or PR merge.

## Validation and sequential review

Validation on Node 22.23.3:

- Targeted manifest/request/position/bridge/I1-update/storage/I3-UI suites: **211 tests passed in 7 suites**.
- `npm.cmd run check`: TypeScript and ESLint passed; **684 tests passed in 28 suites**, including all 46 new regressions. No assertions or timing budgets were weakened.
- `npx.cmd expo install --check`: dependencies are up to date.
- `npx.cmd expo-doctor@latest`: **21/21 checks passed**.
- `npx.cmd expo export --platform ios`: passed (1,254 modules, 24 assets); generated `dist` remains ignored. This is not a device run.
- `git diff --check`: passed.

The final 46 new tests were also run against the four original production files from base `9bcffd4`, with the corrected host URL/geometry harness retained. **40 failed and 6 passed**:

| Regression suite | Added | Failed before fix | Already passed before fix |
| --- | ---: | ---: | --- |
| `s1-manifest` | 17 | 14 | Existing category rejection and both harmless canonicalization cases |
| `integration/i1-update` | 3 | 3 | None; all downloaded/pending/unavailable cases exposed the false reconciliation |
| `position` | 7 | 6 | Newer sample still merely pending |
| `integration/storage` | 2 | 2 | None; both real rollback orderings exposed stale retries |
| `bridge` | 17 | 15 | Inside-paragraph and inside-mixed-container-text sampling |

The pre-fix failures include both font directions, paragraph/structural gaps, spoiler/list/table/pre/quote/image neighbors, range changes, initial/page-2 skips and queued newer locator failures. All four implementation files were restored byte-for-byte in a `finally` block; the identical regression command then passed **46/46**. Initial bridge test development needed a host URL and emulated Range layout seam; those initial harness errors are not counted as defect evidence.

After implementation and the full check, a separate sequential adversarial self-review inspected the completed production/test diff and surrounding parser, restore, transport and persistence boundaries. It checked ambiguous/aliased scope, endpoint/page/range identity, harmless canonicalization, absent totals and successful-check preservation; overlapping flush/dispose orderings and newest-failure retry; and mixed direct text versus structural gaps, hidden spoilers, nearest neighbors and unchanged restoration/completion code. No further production changes were needed. The review also confirmed that Range geometry is used only for mixed containers and static content ownership is indexed once. At that implementation review, real WKWebView layout/device evidence was still pending; the later targeted verification and Owen-reported focused physical pass are recorded below. The implementation self-review itself was not an independent-agent or physical review.

## Ultra targeted verification

The subsequent read-only Ultra verification of `ce294ddd47079338d02a19557df1fcd54df854c8` concluded **SAFE FOR FOCUSED PHONE RETEST**, with no new defect requiring a fix first. It reran 211 targeted tests in 7 suites, reviewed all 46 new regressions and the retained 40 genuine pre-fix assertion failures, and exercised additional synthetic canonicalization/cache, locator-ordering and exact-script bridge probes. Some pre-fix manifest assertions caught invalid rows being consumed before a later incomplete result; the count is not 40 separate false-COMPLETE reproductions. Read/quiescence, canonical content and storage boundaries remained intact. Zero-padded index-category parser conservatism and deep pixel-offset precision within tall meaningful containers predate the patch. This verification supplied host/deterministic evidence, not physical evidence.

## Focused physical regression — passed

Recorded 7 October 2026 from Owen's report on implementation `ce294ddd47079338d02a19557df1fcd54df854c8`, branch `fix/pre-ui-hardening`, using the physical iPhone and existing library. **PRE-UI HARDENING FOCUSED PHONE RETEST PASSED.** These are Owen-reported observations, not an agent-run device test or native wire inspection.

| Area | Physically passed |
| --- | --- |
| F1 ordinary update | An imported story completed Check for Updates successfully. Membership/counts, Read/Unread state, passage/image behavior and the normal successful-check path remained coherent after semantic continuation validation. |
| F2 locator/navigation/background | A recognizable saved passage restored through Contents/reopen. A newer passage survived immediate normal navigation/reopen, and switching away/backgrounding and returning retained coherent latest progress. |
| F3 actual WKWebView paragraph gap | Owen deliberately placed the top reading line in the blank vertical gap between ordinary paragraphs. A substantial font-size change retained proximity to the same nearby passage without a large chapter jump; Contents/reopen restored near that passage again. Naturally encountered richer content showed no obvious restore/reflow regression. |

The F3 result establishes actual WKWebView paragraph-gap/font-change/reopen behavior. It does not establish exhaustive physical coverage of every spoiler geometry, table, list, image timing or nested structure.

## Deterministic-only evidence and deferred scope

- Semantic/malicious pagination redirects, page 2 to page 3, range mismatch and false COMPLETE prevention remain synthetic/host-SQLite evidence.
- Actual storage-write failure and A-fails/B-succeeds revision ordering remain deterministic/host-SQLite evidence.
- Exhaustive structural bridge geometry remains emulated-layout evidence. The richer-content smoke observation is narrower.
- No live redirect or storage failure was manufactured on the phone. Existing historical conditional cases retain their limits; this focused pass does not establish S2B, standalone offline cold start or native packet/header/cookie inspection.
- Unrelated LOW findings retain their phases: stale Contents, Resume Reading UI, image-cancellation classification and post-COMMIT management wording in the UI phase; timing budgets, traversal ceiling and dependency advisory triage before S2B; global FK validation, concurrent S1 accounting and broader media/performance work after v0. None is fixed by this acceptance pass.

## Acceptance bookkeeping validation

The acceptance pass changes only this document, `AGENTS.md` and `README.md`. Production code, tests, canonical HTML/hashes/sanitizer version/block IDs/image mappings, database schema, locator format, Read/quiescence and I4 semantics remain unchanged.

Revalidation on Node 22.23.3:

- `npm.cmd run check`: TypeScript and ESLint passed; **684 tests passed in 28 suites**, including the unchanged 46 hardening regressions.
- `npx.cmd expo install --check`: dependencies are up to date.
- `npx.cmd expo-doctor@latest`: **21/21 checks passed**.
- `npx.cmd expo export --platform ios`: passed, 1,254 modules and 24 assets. Metro automatically recovered from a local cache-deserialization warning by performing a full crawl; no cache or production fix was made. Exported `dist` remains ignored.
- `git diff --check`: passed.

A separate sequential documentation diff review checked the acceptance wording against Owen's report and the Ultra result, preserved historical milestone evidence, verified the three-file scope and retained all deterministic-only and S2B boundaries. No live SpaceBattles requests were made during this engineering pass. The acceptance bookkeeping is committed separately from implementation and prepared for a PR against `main`; no merge is authorized.
