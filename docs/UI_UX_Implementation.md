# Stowaway UI/UX implementation

8 October 2026, America/New_York. **UI/UX overhaul candidate implemented; physical UI acceptance pending.** Branch: `feat/ui-overhaul`. Main base: `fae9a4e63d84f5a9572a6451a42f61bc3754627a`. The controlling [UI specification](Stowaway_UI_UX_Specification.md) was already committed separately at `27b262c174e0b332b533edae025d03c11f80ad8b`. Fetch verified the expected remote base and clean branch before editing.

S0, S1 and S2A are accepted; I0–I4 are merged/accepted. The whole-repository Astra audit is complete. Pre-UI hardening is merged in PR #9 and passed Owen's focused phone retest, within [its recorded limits](Pre_UI_Hardening.md). S2B remains deferred; full v0 remains incomplete. No PR creation or merge belongs to this pass.

## Physical-feedback refinement — 8 October 2026

Owen's iPhone review has begun. His feedback describes the first candidate as cleaner and more usable, but too utilitarian. This is a focused refinement on `8e9eed0893220f2e0aebf088fe992021db6d1004`, on the same branch. The explicit refinement request supersedes the original specification's deferred font/Paper and non-persisted shell-profile decisions. Physical UI acceptance remains pending; no PR, merge or S2B work.

The refinement retains controllers, the existing list, ownership and reader protocols; extends shared profile tokens and existing settings; adds fixed offline font choices/Paper to the restyle path; moves maintenance out of normal chapter scanning; and validates with host SQLite, emulated geometry, component previews and a separate sequential review.

**App Style:** `AppStyle = 'stowaway' | 'classic'`, stored independently under `settings['app-style']`. Missing/unknown values resolve to Stowaway without rewriting storage. StorageProvider loads/persists it and supplies a small presentation context. There is no migration, global state library or settings route. Selection applies after a successful local write. A rejected write triggers an authoritative preference read while the selection gate remains held: a committed choice applies, a retained choice offers retry, and an unreadable outcome reports uncertainty without promising rollback. A Library-footer control opens App Style, distinctly separate from Reading Appearance.

**Profiles:** one structured palette/profile object and the same screens/components. Stowaway uses warm ivory, warm navy, muted brass, softer secondary ink, flatter shelf rows, softer card corners and more generous Continue card spacing. Library/story/Continue display titles use Georgia on iOS and a platform serif fallback elsewhere. Controls, metadata, chapter titles and navigation stay sans-serif. Classic retains the earlier colors and system typography. No covers, imagery, textures, gradients, shadows, font packages or decorative motion.

**Reader preferences:** existing `reading` JSON gains a font enum. Missing/unsupported font resolves to Georgia while valid legacy Light/Dark and size choices survive. Values are normalized at read/save/render/restyle boundaries. The typed font field is optional for legacy callers, including S2A; resolved reads include the default. Paper is an additional selection. App Style and reading settings never overwrite each other. Reads do not auto-rewrite JSON; schema v6 and isolated v1 remain unchanged.

| Label | Fixed local CSS stack |
| --- | --- |
| Georgia | `Georgia, "Times New Roman", serif` |
| Palatino | `Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif` |
| Serif | `ui-serif, "Times New Roman", serif` |
| Sans | `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif` |

These are local requests with generic fallbacks, not a guarantee that every named face exists. Apple's [font reference](https://developer.apple.com/fonts/system-fonts/) and the [CSS font-family specification](https://www.w3.org/TR/css3-fonts/) informed the choice. There is no remote request or `@font-face`; `font-src 'none'` remains. Paper uses `#EEE8DD` background, `#332E27` ink and `#6B512E` links. Existing Light/Dark colors, 14–32 range and default 20 remain.

**Reflow:** normalized size/theme/font keys use the existing restyle method. The bridge validates them and retains snapshot → flush → layout-start → local attributes → semantic settle. Static app-owned CSS maps font keys; persisted strings never become arbitrary CSS. Route-owned ReadCompletion, session checks, locator ordering, quiescence and navigation functions are unchanged. New tests emulate nonuniform font geometry at a deep paragraph with nonzero offset, distinguish semantic restoration from progression fallback, and assert no transient save or Read completion.

**Contents:** title/author, compact summary, Continue/Start/Resume, then Chapters. Normal rows omit download prose. A quiet number gutter and wrapped title lead; pending rows show `↓ Not downloaded`, while spoken state remains explicit. The visible 18-point ✓/○ sits in a separate minimum 44 × 44 Pressable and never navigates. The real FlatList remains. Maintenance is below chapters by default; the labeled header ellipsis brings that same single action group into a top disclosure. Controls are not duplicated. Updates/images/source/removal and the separate Danger Zone retain their callbacks, guards and confirmations. Exceptional progress/errors stay visible with Cancel.

**Reader/accessibility:** smaller, lighter navigation text and hairline separators recede around independently themed prose. A shared modal wrapper retains heading focus, background accessibility isolation, scrolling and Done. Reading Appearance has a wrapping two-column font group, size controls and Light/Paper/Dark. Selections show a checkmark plus accessible selected state. No canonical content, hashes, blocks, image mappings, source policy, request pacing or D1–D4 behavior changes.

Refinement validation on Node 22.23.3 / Windows:

- `npm.cmd run check`: exit 0; TypeScript, ESLint and **741 tests in 30 suites passed** (28 additional cases over 713). No snapshots or timing-budget changes.
- `npx.cmd expo install --check`: dependencies up to date; no dependency changes.
- `npx.cmd expo-doctor@latest`: **21/21 passed**.
- `npx.cmd expo export --platform ios`: exit 0; local iOS Hermes export, 24 assets.
- `git diff --check`: passed; ordinary Windows LF/CRLF notices only.

New coverage includes provider/repository profile reload/failure, commit-then-reject and unreadable style outcomes, all four shell/profile combinations and contrast, legacy/invalid preferences, font stacks/reflow, Paper independence, compact targets and 400-entry list/disclosure reachability. Earlier behavioral assertions remain; numbering/title assertions now inspect their row and spoken number, and exact legacy preferences include their resolved Georgia default. No assertion was weakened to obtain green results.

Visual QA inspected Stowaway light/dark, Classic light, and 320-point compositions with explicitly emulated 1.5× shell text. These use actual shared React Native Web components with synthetic text. A contrast assertion found the inherited warning color below 4.5:1 on the warmer subtle surface; Stowaway's warning ink was darkened to `#8B5110`. The narrow preview exposed a wrapping three-dot action; a single ellipsis and non-shrinking icon target fixed it. Profiles retain one component tree. Previews/logs/export remain ignored artifacts. Mock prose panels are not reader-rendering evidence; this is not native Dynamic Type, VoiceOver, WKWebView, actual font availability or comfort evidence. No live SpaceBattles requests.

Separate sequential correctness/security and visual/accessibility reviews followed passing validation. The correctness review found one LOW issue: App Style's original failure text promised the previous choice was retained without checking a possible committed write. The provider now reconciles the saved preference before releasing the caller's selection gate; an unreadable outcome uses neutral retry/reopen copy. Real host SQLite tests cover commit-then-reject and an unavailable reread, including reload consistency. No transaction abstraction or existing management reconciliation changed. After the final full check and iOS export passed, a narrow re-review confirmed the finding resolved with no actionable issue remaining. The visual/accessibility review found no actionable production issue. Native font metrics, reflow, VoiceOver, maximum Dynamic Type and long-list comfort remain physical validation.

Exact refinement files (28):

- `docs/UI_UX_Device_Checklist.md`
- `docs/UI_UX_Implementation.md`
- `src/app/index.tsx`
- `src/app/story.tsx`
- `src/domain/preferences.ts`
- `src/domain/types.ts`
- `src/reader/ChapterReader.tsx`
- `src/reader/appearance.ts`
- `src/reader/bridge.ts`
- `src/reader/template.ts`
- `src/storage/context.tsx`
- `src/storage/repository.ts`
- `src/ui/appearance-modal.tsx`
- `src/ui/components.tsx`
- `src/ui/reader-chrome.tsx`
- `src/ui/theme.ts`
- `tests/bridge.test.ts`
- `tests/i0-screens.test.tsx`
- `tests/i1-screens.test.tsx`
- `tests/integration/appearance.test.tsx`
- `tests/integration/i0-import.test.ts`
- `tests/integration/i3-read-state.test.ts`
- `tests/integration/i3-ui.test.tsx`
- `tests/integration/i4-ui.test.tsx`
- `tests/integration/s2a-recovery.test.ts`
- `tests/integration/storage.test.ts`
- `tests/template.test.ts`
- `tests/ui-components.test.tsx`

## First candidate implementation record

The remainder records the original `8e9eed0` candidate. The refinement above supersedes its appearance choices.

## Plan and architecture

The pre-implementation plan kept data loading, route keys, lifecycle refs, confirmations, operation ownership and mutation settlement in the existing controllers. Small components under `src/ui/` own rendering, accessibility and callbacks only. No repository write or source call moved into a row/card. The old Control/screenStyles remain available for the separate development diagnostics.

Implementation order: system tokens and primitives; availability-aware reading projections and the four bounded audit fixes; Library/Contents/Add Story presentation; Reader chrome/appearance; semantic regressions, host visual inspection, required validation and a separate sequential diff review. Read-only reconnaissance assisted the single implementing session; no parallel implementer edited files.

## Presentation and behavior

- **Tokens:** warm light canvas and charcoal dark shell follow `useColorScheme`, without a shell preference. AppScreen and the root StatusBar follow system appearance. The light secondary text is slightly darker than the proposed token for contrast. Reader paper/ink/link colors match the specified direction, independent of the shell.
- **Components:** AppScreen, AppText, semantic Button variants, ScreenHeader, SectionHeader, Card, InlineBanner, LoadingState, OperationPanel, StoryRow, ChapterRow and ContinueReadingCard. ReaderTopBar, ReaderBottomBar and AppearanceSheet are separate presentation components. Human-readable operation copy lives in one small module.
- **Library:** text-first tappable rows, title/author/count hierarchy, header Add Story, empty state, local-error/image-warning banners and subordinate development-only diagnostics. No covers or invented time/percentage estimates.
- **Global Continue:** a repository query joins reading_positions to available bodies, stories and stable entries, ordered by locator updated_at with a deterministic identity tie-break. It returns the current entry title and listed/saved status. Read flags never manufacture history. Retained shells and deleted stories are excluded; redownload can restore eligibility. A saved-unlisted target is explicitly labeled. Direct reading is guarded while the story is owned or its local snapshot is refreshing.
- **Contents CTA:** latest readable story-specific locator, otherwise first unread readable current entry, otherwise first readable current entry, otherwise explicit Resume for missing current text. Pending shells never open.
- **Contents:** wrapped hero, compact summaries, one principal reading action, secondary update/image actions, virtualized FlatList chapter rows, separate 44-point Read toggles and one saved-unlisted explanation. Story Actions and Danger Zone sit below chapters. Existing native confirmation semantics, including both full-removal confirmations, remain.
- **Operations:** compact progress cards with meaningful counts and Cancel. Completed work becomes a concise banner. Source error categories remain intact, with technical code/details limited to development output. Image status remains distinct from text completion.
- **Add Story:** a coherent URL field, keyboard avoidance, explicit Import, active progress/Cancel and result/Open Story. Resume mode shows stored title/counts without editable URL. Leaving still requests cancellation and explains that an already-started save can finish; it does not claim immediate settlement.
- **Reader:** persistent Contents/title/Aa top bar and Previous/current-position/Next bottom bar. Position uses the full current manifest, including pending chapters, rather than counting only downloaded navigation entries. Saved-unlisted navigation remains disabled. A plain React Native Modal contains existing 14–32 size and Light/Dark controls plus Done. Preferences and the established WebView restyle path remain authoritative.
- **Reader CSS:** paper/ink/link refinements, bounded body width, softer spoiler border/radius and horizontally contained tables. Georgia, vertical reading, canonical structure, CSP and trusted bridge are unchanged.
- **Accessibility:** 44-point targets, independent manual controls, exposed disabled/selected state, title/heading semantics, full reader title label, row state in accessibility values as well as visible text, non-color state, wrapped titles/actions and scrollable modal content. Errors have alert semantics; progress uses polite announcements. Modal focus enters its heading and inactive reader controls are hidden from accessibility. No physical VoiceOver pass is claimed.

## Bounded audit fixes

**D1 — foreign Resume settlement.** The existing ownership module now emits a story-specific source/image/management settlement notification, separate from ordinary local Read/locator writes. Focused Contents immediately gates retained handlers and controls, invalidates stale reads and applies an authoritative local refresh. Own-operation settlement keeps its existing final refresh; unrelated stories do not trigger a Contents refresh. Chapter opening is also gated during focus refresh; the existing manual-correction/stale-read ordering remains available and tested. A real host-SQLite/UI regression holds Resume after the final transaction guard, leaves Add Story, focuses Contents, releases COMMIT, then holds the final local read and proves controls stay gated until downloaded state applies.

**D2 — production Continue Reading.** Global and story-specific queries use actual readable saved positions. Host tests cover no locator, Read-only state, multiple stories, recency, reopen, saved-unlisted targets, Remove Downloads, retained-locator redownload and full deletion. UI tests cover one-tap routing, Continue/Start/Resume priority and removal/redownload visibility.

**D3 — cancellation classification.** Image repository cancellation throws the existing typed cancelled failure. The existing image orchestration boundary already preserves that type; arbitrary storage exceptions remain storage. Real SQLite regressions cancel during slot insertion and at the final guard, prove rollback and exact retained text/locator, then explicitly retry. A separate commit-failure case remains storage.

**D4 — uncertain post-commit outcome.** Management retains ownership after an unclassified driver rejection and rereads a narrow local snapshot. A satisfied removal postcondition proceeds to the existing safe candidate cleanup. A matching retained pre-state reports rollback; an unreadable/ambiguous outcome reports uncertainty. References/stories are never restored merely because a promise rejected. Host and UI tests inject successful COMMIT followed by driver rejection for both actions, plus an unreadable outcome seam. No transaction abstraction, schema or cleanup protection was redesigned.

## Validation and review

Node 22.23.3 on Windows. Final candidate validation:

- `npm.cmd run check`: exit 0; TypeScript and ESLint passed; **713 tests in 29 suites passed**, with no snapshots. This is 29 additional cases over the 684-test baseline. Existing behavioral coverage is retained; timing budgets and assertions were not weakened.
- `npx.cmd expo install --check`: dependencies up to date.
- `npx.cmd expo-doctor@latest`: **21/21 checks passed**.
- `npx.cmd expo export --platform ios`: exit 0; local Hermes bundle and 24 assets exported.
- `git diff --check`: passed; Git reported only ordinary Windows LF/CRLF conversion notices.

New regressions cover the D1 held-COMMIT/held-refresh race, availability-aware Continue query and screen behavior, D3 cancellation/real storage failure, D4 commit-then-reject/uncertain reads, appearance preference persistence without locator/Read side effects, and 12 primitive/accessibility/theme cases. Library empty/error/warning/production-diagnostics states are covered. Existing screen assertions were adapted to the new visible summaries and retained-handler helper while preserving behavioral expectations.

The final run initially exposed an overbroad new focus-refresh gate that prevented the existing concurrent manual Read correction test. The gate was narrowed to chapter opening during an ordinary focus read; foreign-operation settlement still gates all conflicting actions. The original delayed-refocus/manual correction and idempotent retained-handler assertions pass, with an added assertion that stale chapter opening is disabled.

Tests use original synthetic fixtures and actual host SQLite where stated; native UI/WebView seams remain mocked. No live SpaceBattles request was made. A separate sequential adversarial review followed the passing candidate validation. Read-only correctness/security and UI/reader passes reviewed the completed diff, D1–D4 seams, retained handlers, deletion/availability, typed failures, reader settlement, system themes, modal accessibility, production guards and synthetic light/dark compositions. The review found one actionable accessibility gap: selected theme state was visually represented only by color. A visible checkmark was added to selected buttons while preserving accessibility labels/selected state, with assertions for both themes. No further actionable findings remained. Reviewers did not claim phone, native-driver, VoiceOver, large-text geometry or live-source evidence.

Host visual review uses production presentation components rendered through React Native Web, with synthetic metadata/prose and isolated native wrappers. Light/dark comparisons verify hierarchy, wrapping and contrast; these component compositions are not iPhone screenshots or a running native acceptance test. Previews, logs, browser profile and bundle exports stay under ignored directories.

[The practical iPhone checklist](UI_UX_Device_Checklist.md) is entirely pending. It covers preservation, the full reading/import/management loop, long titles, large text, VoiceOver, shell/reader themes, offline local reading and subjective comfort. No scope item is intentionally omitted; physical acceptance is the required next gate.

## Preserved scope

No schema migration, canonical HTML change, content-hash change, sanitizer-version change, block-ID change, image-mapping change, source-policy change or hidden automatic networking. No global state library, navigation rewrite, pagination, search, bookmarks/highlights/notes/TTS, sync/accounts, S2B work, paid build or PR creation/merge. Existing reader prepareForExit → quiesced → locator/Read settlement → navigation, route-owned ReadCompletion, source pacing, file protections and S2A isolation remain intact. Historical acceptance documents are unchanged.

## Exact implementation files

The specification is in the preceding, separate commit. This implementation changes/adds:

- `AGENTS.md`
- `README.md`
- `docs/UI_UX_Device_Checklist.md`
- `docs/UI_UX_Implementation.md`
- `src/app/_layout.tsx`
- `src/app/add-story.tsx`
- `src/app/index.tsx`
- `src/app/story.tsx`
- `src/domain/types.ts`
- `src/images/repository.ts`
- `src/importing/ownership.ts`
- `src/importing/update-summary.ts`
- `src/reader/ChapterReader.tsx`
- `src/reader/template.ts`
- `src/storage/context.tsx`
- `src/storage/management.ts`
- `src/storage/repository.ts`
- `src/ui/components.tsx`
- `src/ui/operation-copy.ts`
- `src/ui/reader-chrome.tsx`
- `src/ui/theme.ts`
- `tests/i0-reader.test.tsx`
- `tests/i0-screens.test.tsx`
- `tests/i1-screens.test.tsx`
- `tests/integration/i1-handoff.test.tsx`
- `tests/integration/i2-images.test.ts`
- `tests/integration/i3-ui.test.tsx`
- `tests/integration/i4-management.test.ts`
- `tests/integration/i4-ui.test.tsx`
- `tests/ui-components.test.tsx`
- `tests/ui-helpers.ts`
