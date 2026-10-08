# Pre-UI hardening — F1–F3

7 October 2026, America/New_York. Branch: `fix/pre-ui-hardening`, based on merged I4 main `9bcffd4c4d1d08c0e8ab3a127d5e9b3e3dcdf6d5` (PR #8).

The final whole-repository Astra audit is complete. It identified three MEDIUM / PROVEN BUG findings requiring narrow hardening before UI polish. Functional v0 feature work through I4 is complete; UI polish has not started, S2B remains deferred, and full v0 acceptance is incomplete. Historical milestone evidence is unchanged. **This patch has no physical acceptance yet.**

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

After implementation and the full check, a separate sequential adversarial self-review inspected the completed production/test diff and surrounding parser, restore, transport and persistence boundaries. It checked ambiguous/aliased scope, endpoint/page/range identity, harmless canonicalization, absent totals and successful-check preservation; overlapping flush/dispose orderings and newest-failure retry; and mixed direct text versus structural gaps, hidden spoilers, nearest neighbors and unchanged restoration/completion code. No further production changes were needed. The review also confirmed that Range geometry is used only for mixed containers and static content ownership is indexed once. The remaining qualification is real WKWebView layout/device behavior below; this was not an independent-agent or physical review.

## Physical evidence still required

Owen should use existing locally downloaded content without resetting storage:

1. Stop with the top reading line in a paragraph gap in a long imported chapter. Increase and decrease font size, leave/reopen, and confirm the nearby passage remains visible.
2. Repeat around nested spoilers, a list/table/quote and an image or placeholder; verify closed spoilers and image identities remain coherent.
3. Scroll, background/resume, then immediately use Next/Previous/Contents. Confirm passage and Read state persist normally.
4. Perform an ordinary deliberate update regression within the existing personal source policy when appropriate. Do not manufacture a live pagination redirect or corrupt normal storage; those failure orderings have deterministic coverage.

This is a focused phone regression, not S2B, native wire inspection, or a new physical pass for previously unexercised conditional cases.
