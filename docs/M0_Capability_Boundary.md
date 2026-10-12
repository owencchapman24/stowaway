# M0 — capability and acquisition-policy boundary

10 October 2026, America/New_York. Local, uncommitted implementation on `main`, based on the exact reviewed baseline `d43cf0963497e40836cac40f0c2ed2df43a0262d`. The pre-existing untracked architecture PDF is unchanged. SpaceBattles personal-use v0 acceptance and all historical evidence limits remain intact. M1 is not started.

> M0 adds fail-closed acquisition eligibility and preserves the existing internal SpaceBattles workflow. It does not establish public source-module exclusion or public-release readiness.

## Boundary and behavior

- `domain/source-capabilities.ts` projects existing metadata into fixture/remote origins without reconstructing IDs. `sources/registry.ts` lists only implemented fixture and SpaceBattles operations. Unknown origins/operations and file-shaped declared provenance cannot grant acquisition. No file importer or future-source stub is registered.
- Fixture supports local reading/state only. SpaceBattles import, resume/redownload, COMPLETE update, image discovery/retry and S1 acquisition require `internal-personal`. Public, missing, empty and malformed audiences deny acquisition. Reading, Read/Unread, locators, Continue Reading, confirmed removal and local cleanup do not depend on acquisition permission.
- `config/build-audience.ts` uses the direct static `process.env.EXPO_PUBLIC_STOWAWAY_BUILD_AUDIENCE` reference. Development/preview profiles explicitly embed `internal-personal`; production explicitly embeds `public` and the existing default store distribution. CLI/version settings and autoIncrement are retained. No signing or native configuration changed.
- `npm.cmd start` and `npm.cmd run android` invoke the small Node launcher with an explicit internal audience, forwarding Expo arguments. These are deliberately internal commands. Direct `npx.cmd expo` commands require an explicit audience to enable acquisition; they do not infer it from development mode or profile names. Internal standalone release JavaScript remains eligible even with `__DEV__ = false`.
- `sources/operations.ts` is a testable dispatch factory; `native-operations.ts` composes existing native services. `SourceServices` describes this existing composition, not a contract requiring future file importers to implement network methods. Allowed calls delegate once with unchanged arguments/options, signal/progress/settlement callbacks, results and errors. There is no second owner, queue, request client or catch/relabel layer. Denial returns a typed failure before native delegates, storage access, image-file creation, ownership or attempt-time mutation, and awaits a promised settlement callback once. Local management denial throws its typed error after settlement, matching the management exception contract.
- Add Story/Contents use capabilities and guarded dispatch. Existing labels/layouts, compound busy/focus/refresh checks, retained confirmations, aborts, navigation and local Read handling remain. Contents retains its defensive final-refresh fallback; service/facade callback ownership is not an end-to-end screen callback-count promise. S1 retains its development-only native guard and additionally checks audience in both native entry and route.
- The preventive UI lint boundary rejects direct acquisition implementation imports and replacement-dispatcher access in routes, UI helpers and reader helpers; its coverage and static-analysis limits are recorded below. Source URL/identity/category/COMPLETE/image-origin/redirect/refusal validation remains in the accepted services. Safe deliberate source opening stays separate.

These are compiled policy decisions, not permission granted by provenance, runtime settings or remote flags. Future source approval requires separate evidence and review of the actual public build composition. M0 still statically imports SpaceBattles implementations. A boolean policy gate or hidden button does not establish that unauthorized source modules are excluded. No hidden remote-source unlock or OTA permission unlocking is introduced.

## Historical implementation evidence — 10 October 2026

Environment: Windows, Node 22.23.3, npm 10.9.9. Tests use original synthetic fixtures/injected transports and real host SQLite where stated. No live SpaceBattles, AO3, Royal Road or FanFiction.net request was made.

The pure first patch contained only the domain/registry and focused tests. Before any native/config/UI integration, `npm.cmd run typecheck`, `npm.cmd run lint` and `npm.cmd test -- --runTestsByPath tests/source-capabilities.test.ts` passed: **11 tests**. No network/filesystem/database initialization was introduced in that patch.

Focused integrated command: `npm.cmd test -- --runTestsByPath tests/source-capabilities.test.ts tests/source-operations.test.ts tests/build-audience.test.ts tests/i0-screens.test.tsx tests/i1-screens.test.tsx tests/s1-screen.test.tsx tests/integration/i4-ui.test.tsx` — **127 tests / 7 suites passed before sequential review**. New cases cover the policy matrix, strict audience parsing, unchanged delegate arguments/results/errors, denied-call side effects and held settlement, actual duplicate-import ownership, release-JS internal acquisition, native S1 guards, public/unconfigured local SQL/Read/locator/removal/cleanup and retained acquisition handlers. Existing screen tests now explicitly declare their internal audience; no accepted assertion or timeout was weakened.

The review found and fixed a resume retry regression: an attempt returning no story summary could disable the next explicit retry. Add Story now retains the already-loaded route identity for eligibility/dispatch while keeping result presentation unchanged. Two new returned/thrown-failure cases passed with `npm.cmd test -- --runTestsByPath tests/i0-screens.test.tsx`: **17/17 tests**. The complete final suite below includes those cases: **54 additional tests** over the 829-test baseline.

Initial new test-harness failures were corrected: use identity assertions instead of deep-inspecting a fail-on-access repository proxy; use Expo-compatible static environment reads; mark audience mocks as ES modules so namespace mutation affects the module actually used by screens. These were test scaffolding corrections, not relaxed product assertions.

| Required check | Result |
| --- | --- |
| `npm.cmd run check` | Passed after the review fix: TypeScript, lint, 883/883 tests across 33/33 suites; 74.456 s test run |
| `npx.cmd expo install --check` | Passed; dependencies are up to date |
| `npx.cmd expo-doctor` | Passed; 21/21 checks |
| Explicit internal iOS export | Passed after the review fix; 1,266 modules, 24 assets, 3.1 MB Hermes bundle |
| Explicit public iOS export | Passed after the review fix; 1,266 modules, 24 assets, 3.1 MB Hermes bundle |
| `node scripts/expo-internal.mjs --help` | Passed; Expo start help, no server or source acquisition |
| Initial local lint probe (historical; superseded below) | Passed; eight direct acquisition/factory imports rejected, facade and type imports accepted |
| `git diff --check` | Passed |

The iOS exports use these exact PowerShell commands:

```powershell
$env:EXPO_PUBLIC_STOWAWAY_BUILD_AUDIENCE = 'internal-personal'
npx.cmd expo export --platform ios --output-dir dist/m0-internal --clear
$env:EXPO_PUBLIC_STOWAWAY_BUILD_AUDIENCE = 'public'
npx.cmd expo export --platform ios --output-dir dist/m0-public --clear
```

Exports/logs remain ignored under `dist/` and `.tools/`. Bundle export is compilation/config evidence, not physical-device acceptance or proof of source-module exclusion. The host SQLite experimental warning and export color/cache warnings are informational.

## Historical implementation review — 10 October 2026

Completed separately after implementation and automated verification. The first pass found the explicit-resume retry regression described above. After fixing it, the full check and both exports were repeated, followed by a final sequential review of the stable diff. No unresolved M0 defect or scope blocker was found.

- Acquisition routes: Add Story/import/resume, Contents update/images and S1 all use guarded entry points. Registry support does not bypass accepted URL, identity, COMPLETE, image-origin or refusal checks. Native dispatch independently rechecks the explicit audience. The route import-boundary probe passed.
- Denials: no native acquisition delegate, source request, source-file allocation, owner or attempt-time write occurs. Promised denial settlement is awaited once; a caller-supplied local refresh remains the caller's behavior. Allowed results/errors/options pass through without added settlement or ownership.
- Races: compound busy/focus/foreign-refresh guards, aborts, result identity checks, retained confirmation tokens, both full-removal confirmations, navigation prevention and the defensive final-refresh fallback are retained. The additional resume identity state is scoped to the keyed route and cannot survive a route change or enable an unknown source.
- Local data: public/unconfigured real-SQLite tests preserve canonical saved content and locator state, permit Read/Unread and Continue Reading, and exercise confirmed removal and post-deletion cleanup without acquisition. Existing reader and ownership regressions pass.
- Scope: protected-file diff is empty for schema/storage/migrations, identity/content, images, reader/bridge, S2A, the shared request client and URL validation. Package comparison proves scripts-only edits; lockfile/native config are unchanged. README/AGENTS comparison proves only the exact current-status sentences changed. Generated exports/logs are ignored, the baseline HEAD is unchanged and nothing is staged. The pre-existing architecture PDF remains untouched.

**Historical verdict: PASS — M0 implemented and automated verification complete.** Physical M0 acceptance was pending at that point; the 12 October report below supersedes that pending status. Public module exclusion and public-release readiness remain outside M0.

## Physical iPhone acceptance — 12 October 2026

**M0 — PHYSICAL ACCEPTANCE PASSED** within the defined internal/personal-use scope. Owen reported the following results during interactive physical acceptance of internal EAS preview build `2fe88edd-46a3-46c4-816f-218d54d33d7a`. These are user-reported observations: the development agent did not operate or observe the iPhone or independently inspect the installed binary.

| Test | User-reported result |
| --- | --- |
| Installed M0 internal EAS preview build | Pass |
| Updated existing Stowaway installation | Pass |
| Existing library preserved | Pass |
| Check for Updates | Pass |
| Fresh SpaceBattles import | Pass |
| Remove Downloads | Pass |
| Resume Download | Pass |
| Reading-state preservation | Pass |
| Offline reading and state persistence | Pass |
| Two offline cold launches | Pass |
| Cancellation and recovery | Pass |
| Image acquisition | Pass |
| Full story deletion | Pass |
| Fresh import after deletion | Pass |

Image acquisition does not establish that **Image Retry** was used. Image Retry specifically, naturally occurring cleanup failures/Retry Cleanup, manufactured storage failures, and unreported edge cases remain unexercised in this M0 report. The cancellation/recovery pass does not establish every interruption or settlement race. The report does not independently establish every detail of the earlier proposed checklist (including native confirmation/cancel variants, every reader control and preference, or exact wire behavior). Prior milestone evidence retains its original limits. No public/unconfigured phone run or source-module exclusion is inferred. Public App Store readiness remains outside M0.

## Preventive lint hardening — 12 October 2026

The independent implementation audit found no P0/P1 defect, demonstrated acquisition bypass in existing routes, data-loss regression or ownership regression. Its nonblocking P2 finding was narrower preventive lint coverage: dynamic imports, CommonJS require, explicit extensions and UI helpers escaped the original route-only rule. The ignored local probe was insufficient regression coverage for a fresh checkout.

`eslint.config.js` now enables the local `stowaway/acquisition-boundary` rule at error severity for `src/app`, `src/ui` and `src/reader` modules, plus the directly imported presentation helpers `src/importing/failure-presentation.ts`, `src/importing/update-summary.ts` and `src/images/summary.ts`. The small build-tool rule in `scripts/eslint-acquisition-boundary.cjs` uses existing ESLint and Node APIs; it adds no dependency or application plugin system. It normalizes relative paths and the existing `@/` alias, including dot segments and explicit TS/JS extensions. It checks static imports, literal/no-substitution-template dynamic imports, direct require calls, TypeScript import-equals, and named/star/namespace re-exports. It protects the same eight low-level implementation modules as the original rule and prevents obtaining `createSourceOperations` or its namespace from UI code.

Type-only declarations/specifiers/re-exports/import expressions remain permitted. Named imports/re-exports of `SourceOperationFailure`, the guarded facade, local ownership/management helpers and unrelated modules remain permitted. Native service composition and storage-local image-file access are outside the UI rule's scope and remain permitted. UI code needing the failure class uses a named static import; obtaining the entire operations module through a namespace, dynamic import or require also exposes the factory and is rejected.

`tests/lint-boundary.test.cjs` exercises the actual repository ESLint configuration without rule overrides or mocks. Run `npm.cmd run test:lint-boundary` independently. `npm.cmd run check` now runs it between lint and the existing Jest suite, including in CI. These source files are commit candidates and do not depend on ignored `.tools/` diagnostics.

Limits: this is preventive static tooling, not runtime capability enforcement or a security sandbox. It recognizes string literals and templates without substitutions; runtime-computed paths, variable/aliased loaders, unconfigured aliases, transitive re-export graphs through modules outside the scoped directories, and future directories/modules require code review and rule maintenance. It does not prove public source-module exclusion or public-distribution readiness. The guarded runtime facade and existing source policy checks remain necessary.

### Closeout verification

Windows, Node 22.23.3, npm 10.9.9. No dependency or lockfile changes. The new suite has **64 cases: 42 prohibited, 21 permitted and one explicitly documented computed-path limit**.

| Check | Closeout result |
| --- | --- |
| `npm.cmd run check` | Passed: TypeScript, lint, 64/64 lint-boundary cases, 883/883 Jest tests across 33/33 suites; final Jest run 95.678 s |
| Normal `npm.cmd run lint -- --stdin --stdin-filename <path> --format json` | Every one of the 42 prohibited cases independently exited 1 with `stowaway/acquisition-boundary` at error severity; all 21 permitted cases independently exited 0 |
| Independent `npm.cmd run test:lint-boundary` in clean source copy | Passed: 64/64 cases with the real ESLint configuration |
| Clean-copy `npm.cmd run lint` | Passed |
| `npx.cmd expo install --check` | Passed; dependencies are up to date |
| `npx.cmd expo-doctor` | Passed; 21/21 checks |
| `git diff --check` and untracked-text whitespace inspection | Passed |

Fresh-checkout compatibility was exercised using a new temporary copy of all 159 tracked and commit-candidate files, followed by `npm.cmd ci --offline --no-audit --no-fund` (1,075 packages installed from the local npm cache). No original `node_modules`, `.tools`, `.expo`, build output, Git metadata or local environment file was copied. The supported regression command and normal lint passed there, and the temporary copy was removed. This was a clean source-copy test, not a claim that the still-uncommitted files are already available from a remote clone.

The first lint-harness run exposed a nonexistent module in a permitted example and missing Node `__dirname` global declarations in the two CommonJS tooling files. The example now names a real unrelated local module; the globals are declared without disabling a rule. The first full check hit one existing five-second timeout in the M0 public I4 UI case (882/883 passed). A full rerun without concurrent verification tooling passed all 883 tests. No existing assertion, timeout or test file was changed by this closeout.

### Separate final review

The sequential review inspected the complete tracked diff and untracked implementation, tooling, tests and documentation after the corrective edits. Import-graph review also brought the three presentation helpers outside the UI directories under the rule, with a denied regression for each. No remaining material defect was found. The existing runtime acquisition guards, local operation access, identity, ownership, settlement, storage and reader behavior retain their previously reviewed implementation.

A starting-tree SHA-256 inventory confirms that the only pre-existing files changed by this closeout are `AGENTS.md`, `README.md`, `eslint.config.js`, `package.json` and the already-untracked `docs/M0_Capability_Boundary.md`. The only added files are `scripts/eslint-acquisition-boundary.cjs` and `tests/lint-boundary.test.cjs`; both are supported verification files intended for the eventual commit. The other 152 candidate files, including all runtime files, existing tests, lockfile, native configuration and the pre-existing architecture PDF, are byte-for-byte unchanged. README/AGENTS changes are status pointers only.

**PASS — M0 ready to commit.** The documented static-analysis and physical-evidence limits are nonblocking within M0's internal/personal-use scope. HEAD remains `d43cf0963497e40836cac40f0c2ed2df43a0262d` on `main`; nothing is staged. The complete working tree contains 17 modified tracked files and 13 untracked files, including the unchanged reference PDF. No commit, push, PR, merge or M1 work was performed.

## Preserved scope

Schema v6/migrations, dependencies/lockfile, identity constructors, repository writers/seeding, canonical HTML/hash/version/blocks/links, image validation/staging/references/cleanup algorithms, Reader/bridge/fonts/themes, Read/locator/quiescence behavior, S2A resources/schema v1 and shared request pacing/refusal policy are unchanged. The closeout changes only lint tooling, regression verification and documentation. No EPUB/HTML parser, additional source, public distribution or source-permission change/outreach was introduced. No EAS build, commit, push, PR or merge was initiated by this closeout.
