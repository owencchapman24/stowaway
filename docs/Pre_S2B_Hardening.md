# Pre-S2B hardening

Dates: 8–9 October 2026. Base: merged UI main `76021496aedb506bd7213daf2d014dd7e9fb0a9d`. Branch: `chore/pre-s2b-hardening`.

This bounded pass adds production manifest traversal limits, triages the current dependency tree, reviews CI and repository hygiene, resolves two isolated LOW UI debts and cleans superseded documentation. Functional SpaceBattles v0 is complete through UI; reader/UI design is frozen. This candidate does not perform S2B or configure signing. Apple Developer enrollment remains pending/administrative. Full v0 acceptance and multi-source work remain deferred until after standalone acceptance.

## Manifest traversal safety

`src/sources/spacebattles/diagnostic.ts` owns the shared production/S1 traversal. Its state remains the requested index/range URL, validated returned URL, visited URLs, stable numeric post-ID set, ordered entries, proven primary category/scoped total, next page and maximum advertised last page. The F1 semantic continuation check compares requested/returned endpoint, page or range bounds, category and other allowed query values; harmless slug/query-order/numeric canonicalization remains valid. Those checks are unchanged.

- `MAX_MANIFEST_DOCUMENTS = 20_000`: one common counter for fetched index and range documents, checked **before** fetching another. Root-thread discovery and chapter bodies are outside this manifest counter. Retries/redirect hops remain independently bounded by the unchanged request client; they cannot reset this operation-local count. A fully complete response at document 20,000 can succeed only if existing completion evidence also succeeds. Any additional index/range needed at that point throws `incomplete` before request 20,001, including a range still pending within the final page.
- `MAX_MANIFEST_NO_PROGRESS = 32`: each resolved index/range expansion with no new post ID across its contents/descendants increments the consecutive no-progress counter. Only the act of discovering a new stable post resets it. A wrapper containing productive descendants neither increments nor resets the current streak on unwind: legitimate range-only nesting is preserved without crediting an earlier post again. Duplicates plus new entries count as progress; changed URLs, page numbers or range bounds alone do not. Reaching 32 throws `incomplete`, even when that duplicate-only response claims to be terminal or the scoped count already matches.
- Existing 10,000 unique-entry and depth-20 range bounds remain. The new document budget is twice the existing supported unique-entry budget: enough for an index and a range document per supported entry. This greatly exceeds the recorded 25/34/38-entry physical stories and the existing 1,000-entry synthetic stress case. It is Stowaway's conservative client limit, **not a SpaceBattles/XenForo official limit or a promise that every conceivable 10,000-entry layout completes**. A legitimate pathological layout beyond either bound fails safely instead of authorizing removal.

Both new stops use the existing `S1Failure('incomplete', ...)` path. They cannot reach the COMPLETE return or I1 reconciliation. Attempt time may advance; prior membership, titles/order, Read state, bodies/hashes/block IDs/links, locators and last successful update remain intact. Raw cycle checks, semantic redirect continuity, category identity, cancellation, one-request ownership, pacing and retry policy are preserved. No live source request was made.

Regression coverage includes a 1,250-page/2,500-entry complete traversal; actual 20,000-document complete and over-limit boundaries; shared index/range budget with an unresolved last range; terminal/nonterminal repeated content; harmless canonical URL changes; changed range bounds and slug aliases; duplicates plus new-ID counter reset; productive nested range wrappers and duplicate tails across ancestor unwinds; and I1 real RequestClient/host-SQLite preservation for both limits and cancellation near the no-progress boundary. Existing ordinary pagination, F1 redirects, category/count gating and I0 tests remain active. Production limits are not lowered for tests.

Original generated HTML goes through the real parser for the long manifest, no-progress, nested range, canonicalization and cancellation cases. The actual 20,000-document budget cases supply known parsed index/range models; their request counts, continuation validation, budget logic and (for I1) RequestClient/SQLite are real. Large stress cases temporarily use Node's WHATWG URL and restore it in `finally`; normal/F1/no-progress tests retain the Expo/Jest environment. An exploratory full-parser I1 boundary took 212.947 seconds (54.775 seconds with Node URL), so redundant repeated parsing at the budget boundary was removed from the final test harness. No production change for CI speed, timeout increase or weakened assertion was needed. These host tests do not establish iPhone performance or native transport behavior.

## Dependency/security advisory triage

`package.json` and `package-lock.json` remain unchanged. No safe SDK 57-compatible security update was identified. The advisories below are documented and deferred, not a zero-vulnerability claim.

Current commands: `npm.cmd audit --json` and `npm.cmd audit --omit=dev --json` both exit 1 with findings; `npm.cmd ls --all --json` and `npm.cmd explain braces decode-uri-component node-forge sprintf-js uuid --json` exit 0. Read-only `npm.cmd view` calls also exit 0. Reports are ignored `.tools/pre-s2b-*` artifacts. The dependency inspection made no installs or forced resolutions.

Full audit: **64 inherited affected package entries, 49 high / 15 moderate**. Omit-dev: **60 entries, 45 high / 15 moderate**. These expand **five underlying advisories**, all in transitive packages. Omit-dev retains Expo/RN tooling and peer paths: it does not establish that 60 vulnerabilities execute in the installed iPhone app.

| Advisory / installed package | Severity, relation and path | Actual relevance in this app | Published fix and SDK57 decision |
| --- | --- | --- | --- |
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), braces 3.0.3 | High; transitive. expo → @expo/metro 56.0.2 → metro-file-map 0.84.5 → micromatch 4.0.8 → braces. RN Metro and Jest paths also converge here. | Tooling dependency; nested-pattern stack exhaustion. Metro/Jest consume workspace globs, not imported story text. No application import/source-input path found. This is not a claim that every tooling call was dynamically traced. | No patched version published; registry latest remains 3.0.3. Defer. No compatible patch exists to apply. |
| [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), decode-uri-component 0.2.2 | Moderate; transitive runtime dependency. expo-router 57.0.25 → query-string 7.1.3 → decoder. | Malformed percent decoding can consume excessive CPU. Runtime dependency is imported, but this Router version's configured getStateFromPath uses its fork and URL.searchParams; query-string is used for serialization and remains in generic navigation fallback code. No exercised vulnerable Stowaway route was demonstrated. Do not classify it as dev-only or as a confirmed app deep-link exploit. | Fixed in 0.5.0, which is ESM and outside query-string's ^0.2.2. All published Router57 versions still specify query-string ^7.1.3. Audit suggests Router58.0.16, outside SDK57. Defer parent upgrade/override; not a safe drop-in patch. |
| [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), node-forge 1.4.0 | High; transitive. expo 57.0.27 → @expo/cli 57.0.28 → node-forge, and CLI → @expo/code-signing-certificates 0.0.6 → node-forge. | CLI signing/certificate tooling, not an app cryptography import. Affected RSA verification functions exist in certificate validation/signing helpers. Project has no updates.codeSigningCertificate/key configuration; this signing validation path was not exercised in this pass. No claim that all Expo Go signing internals are unreachable. | No patched version published; registry latest remains 1.4.0. Defer. Reassess before adding update/code-signing services. |
| [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), sprintf-js 1.0.3 | Moderate; transitive. Jest/babel-jest → babel-plugin-istanbul 6.1.1 → @istanbuljs/load-nyc-config 1.1.0 → js-yaml 3.15.2 → argparse 1.0.10 → sprintf-js. | Tooling only; attacker-controlled numeric precision formats cause RangeError. NYC config loads js-yaml's library; argparse/sprintf belong to js-yaml's CLI/help path, not normal YAML parsing. No app import found. | No patched version published. Registry latest1.1.3 is also affected, so a minor bump does not fix it. Defer; audit's Jest/Jest-Expo majors are not a compatible SDK57 patch. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), uuid 7.0.3 | Moderate; transitive. expo → @expo/config-plugins 57.0.10 → xcode 3.0.1 → uuid. | Native project tooling. Advisory concerns v3/v5/v6 with caller buffers/offsets; installed xcode calls v4(), which the advisory explicitly excludes. App UUIDs use expo-crypto.randomUUID instead. | Fixed in 11.1.1, 12.0.1, 13.0.1. First fixed version is a major upgrade beyond xcode's ^7.0.3. Defer: no exercised affected API found and no safe in-range update. |

The audit's inherited direct flags are @react-native/jest-preset, @types/jest, expo, expo-router, jest, jest-expo, react-native, react-native-reanimated and react-native-worklets. These are consequences of the five rows above, not nine additional advisories. Proposed audit fixes include Expo44.0.6, Router58.0.16, Jest30.5.2/Jest-Expo58.0.8, RN0.87.1 and downgrades of Reanimated/Worklets. Do not apply them as isolated security fixes.

Installed `expo/bundledNativeModules.json` aligns Router ~57.0.25, Jest-Expo ~57.0.5, RN 0.86.3, Reanimated 4.5.1 and Worklets 0.10.1. [Expo's upgrade guidance](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/) requires matching dependencies to the SDK and checking the result; it does not justify replacing SDK 57 components with audit-suggested majors/downgrades.

Sources were checked on 8 October 2026. Reachability statements are source/dependency inspection, not physical-device attack testing or binary instrumentation. Reassess when upstream publishes fixes or before SDK/code-signing changes.

## CI reliability and repository inspection

The sole `.github/workflows/check.yml` runs full validation on `pull_request` and pushes restricted to `main`. Feature-branch pushes do not duplicate PR runs. No workflow change is needed. The existing three-case unacknowledged I3 recovery family retains its justified **15,000ms local timeout**; no global Jest timeout, skipped test declaration, `.only` or retry-based masking was added or found. No additional timeout is justified.

Recent first-attempt evidence: [UI PR run 37877871873](https://github.com/owencchapman24/stowaway/actions/runs/37877871873) passed 805 tests/30 suites in 131.009 seconds (I3 suite 30.652 seconds); [merged-main run 37879003746](https://github.com/owencchapman24/stowaway/actions/runs/37879003746) passed 805/30 in 130.55 seconds (I3 suite 31.956 seconds). The [historical failed run 37711068788](https://github.com/owencchapman24/stowaway/actions/runs/37711068788) supplies actual evidence for the already-applied I3 local budget. An initial focused local run in this pass timed out in the existing first App Style cold-render case; the unchanged-budget rerun passed. This is not new CI evidence and does not justify broad timeout changes.

Tracked-file and high-confidence token/private-key-pattern inspection found no generated build/database outputs, `.env` secrets, signing certificates/profiles, Apple/EAS/Expo credentials or tokens. Credential-URL matches were hostile synthetic validation fixtures. Historical filename inspection likewise found no credential/signing files; this is scoped inspection, not exhaustive forensic secret detection. Logs, dependency trees, preview/export output and temporary tools remain ignored. The committed lockfile remains unchanged and coherent.

App IDs, team IDs, EAS project configuration and signing are unchanged/unconfigured. Development diagnostic links, direct routes and the S1 native API retain production guards. Startup stays local: storage migration, conflict-safe synthetic seeding and bundled assets. Tests use injected synthetic transports, with no live source fetch. No new background networking, source adapter, schema migration or UI redesign was introduced.

## LOW fixes and documentation hygiene

The two LOW debts from the UI audit are resolved narrowly:

1. Reading preferences: after a rejected save, the production provider reads SQLite before releasing the existing reader change gate. It updates memory from authoritative readback and resolves only when font, size and theme all match the requested normalized values. A confirmed rollback rejects and retains the old choice. Unreadable state rejects without guessing; the reader says it could not **confirm** settings and offers retry/reopen. Host-SQLite/provider tests cover a held confirmed commit, rollback/retry and unreadable committed/rolled-back results. Production reader/provider tests additionally confirm live restyle only on confirmed commit, a single rendering and no locator/Read write. Actual iOS driver failure is not claimed.
2. Unsupported Add Story input: typed `unsupported-url` validation is unchanged; concise production copy asks for a public SpaceBattles thread URL rather than a post-only link. A production-mode screen test uses the real importer validation and proves the typed rejection, visible guidance and zero source requests/local story lookup.

The old nine-font/two-group checklist is marked historical/superseded by the current 26-font/five-group and partial-sheet checks. No historical evidence or unchecked item was deleted or converted to Passed. README/AGENTS now reflect merged UI, the hardening candidate and pending standalone acceptance. Six intentional trailing-space hard breaks in the UI specification use equivalent CommonMark backslash breaks; document wording/rendering is retained. Historical background reports under `docs/research/` are untouched.

Owen reports preferring Stowaway to SpaceBattles in Safari and satisfactory partial-sheet iPhone sanity on `69c5f5a51cefbcc1e34060b803c0860643c0b01f`, including actual exposed prose. This remains aggregate user-reported evidence; no exhaustive VoiceOver, Dynamic Type, native-event or new hardening phone pass is inferred. Prior deterministic/physical evidence boundaries remain intact. Global FK performance and concurrent S1 diagnostic accounting retain their deferred phases.

## Validation and separate sequential review

The separate adversarial review found one **MEDIUM** defect in the initial guard at `src/sources/spacebattles/diagnostic.ts` (end of `expand`). Reproduction: index → outer range → inner range → leaf adding one post; the inner range then yields 31 duplicate-only ranges, and the outer range yields 31 more. Crediting the same post again on ancestor unwind reset the counter and incorrectly allowed COMPLETE after 62 duplicate responses. The smallest fix resets only when a new post ID is inserted; productive unwind preserves the current streak. Two real-parser regressions cover terminal/nonterminal variants and exact request order. The independent probe now returns INCOMPLETE at the 32nd duplicate (36 total documents). Re-review confirmed the finding closed.

No outstanding BLOCKER/HIGH/MEDIUM finding remains. Independent review of the preference/readback and URL fixes, documentation evidence, source/F1/range/cancellation/I1 invariants and dependency scope found no further actionable defect. Dependency advisories and host/native evidence limits remain documented informational limitations. No assertions, source pacing, retry policy or test timing budget were weakened.

Final validation on Node 22.23.3 / Windows:

| Command / coverage | Result |
| --- | --- |
| Targeted S1 manifest/request/URL and I0/I1 integration suites | 153 tests / 5 suites passed, 36.733 seconds |
| Focused appearance/provider and production URL suites | 22 tests / 2 suites passed; three additional reader/provider outcome cases passed separately before the full run |
| `npm.cmd run check` | TypeScript and lint passed; **829 tests / 30 suites passed**, 162.636 seconds; no skipped tests in the full run |
| `npx.cmd expo install --check` | Dependencies up to date |
| `npx.cmd expo-doctor@latest` | 21/21 checks passed |
| `npx.cmd expo export --platform ios` | Passed; 24 assets, one 3.1 MB iOS bundle |
| `git diff --check` | Clean |
| npm audit / dependency inspection | Findings and deliberate deferral recorded above; audit exits 1, tree/explain exits 0 |

There are **24 new regression cases** over the 805-test UI baseline: 16 manifest/I1 cases and eight preference/provider/reader/URL cases. The test-only context probe captures values in an effect to preserve React render purity; its assertions remain intact. A Metro cache deserialization warning recovered through a full crawl; export completed. No new phone, native failure-injection or S2B evidence is claimed.

Exact changed files (14):

- `src/sources/spacebattles/diagnostic.ts`
- `src/storage/context.tsx`
- `src/reader/ChapterReader.tsx`
- `src/importing/failure-presentation.ts`
- `tests/s1-manifest.test.ts`
- `tests/integration/i1-update.test.ts`
- `tests/integration/appearance.test.tsx`
- `tests/integration/i3-ui.test.tsx`
- `tests/i0-screens.test.tsx`
- `docs/Pre_S2B_Hardening.md`
- `docs/UI_UX_Device_Checklist.md`
- `docs/Stowaway_UI_UX_Specification.md`
- `README.md`
- `AGENTS.md`

## Next gate

After review/report, commit and push the candidate and prepare the PR against main. Do not merge automatically. After merge: **Apple Developer approval → EAS/ad-hoc setup → S2B physical standalone test**. S2B is unperformed; signing credentials, paid build actions and source expansion are outside this branch.
