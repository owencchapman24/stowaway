# Stowaway UI/UX implementation

8 October 2026, America/New_York. **UI/UX overhaul candidate implemented; physical UI acceptance pending.** Branch: `feat/ui-overhaul`. Main base: `fae9a4e63d84f5a9572a6451a42f61bc3754627a`. The controlling [UI specification](Stowaway_UI_UX_Specification.md) was already committed separately at `27b262c174e0b332b533edae025d03c11f80ad8b`. Fetch verified the expected remote base and clean branch before editing.

S0, S1 and S2A are accepted; I0–I4 are merged/accepted. The whole-repository Astra audit is complete. Pre-UI hardening is merged in PR #9 and passed Owen's focused phone retest, within [its recorded limits](Pre_UI_Hardening.md). S2B remains deferred; full v0 remains incomplete. No PR creation or merge belongs to this pass.



## Final catalog and backdrop polish — 8 October 2026

Focused follow-up on `299529b55b5fd77892e2ef118a4cf756fded8c61`, on `feat/ui-overhaul`. Owen reports strongly positive physical feedback and explicitly prefers Stowaway to SpaceBattles in Safari. This is user-reported feedback, not an agent phone run or blanket acceptance of the new changes. The visual design remains frozen outside the expanded font picker and reader-appearance backdrop dismissal.

**Verified catalog: 26 choices, 24 named iOS system families plus the two existing system generics.** Before adding names, the current [Apple system-font catalog](https://developer.apple.com/fonts/system-fonts/) was inspected, including raw HTML **system font iOS** versus downloadable/document-support markers. The [Apple font-family table](https://developer.apple.com/documentation/applenews/applying-apple-news-format-fonts) corroborates family spellings; [Apple's typography session](https://developer.apple.com/videos/play/wwdc2020/10175/) separately demonstrates Charter-Roman. These are published availability/naming facts, not proof of the exact face selected on Owen's device. System families retain [WebKit's ui-serif support](https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1/) and [system-sans guidance](https://webkit.org/blog/3709/using-the-system-font-in-web-content/).

| Category | Choice / stored key | Exact static CSS stack | Availability basis |
| --- | --- | --- | --- |
| Bookish Serif | Baskerville (`baskerville`) | `Baskerville, Georgia, serif` | Apple iOS system: Baskerville |
| Bookish Serif | Charter (`charter`) | `Charter, Georgia, serif` | Apple iOS system: Charter Roman |
| Bookish Serif | Cochin (`cochin`) | `Cochin, Georgia, serif` | Apple iOS system: Cochin |
| Bookish Serif | Didot (`didot`) | `Didot, Georgia, serif` | Apple iOS system: Didot |
| Bookish Serif | Georgia (`georgia`) | `Georgia, "Times New Roman", serif` | Apple iOS system: Georgia |
| Bookish Serif | Hoefler Text (`hoefler-text`) | `"Hoefler Text", Georgia, serif` | Apple iOS system: Hoefler Text |
| Bookish Serif | Palatino (`palatino`) | `Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif` | Apple iOS system: Palatino |
| Bookish Serif | Times New Roman (`times`) | `"Times New Roman", Times, serif` | Apple iOS system: Times New Roman |
| Bookish Serif | System Serif (`serif`) | `ui-serif, "Times New Roman", serif` | WebKit `ui-serif` |
| Sans Serif | Avenir (`avenir`) | `Avenir, -apple-system, sans-serif` | Apple iOS system: Avenir Roman |
| Sans Serif | Avenir Next (`avenir-next`) | `"Avenir Next", -apple-system, "Helvetica Neue", Arial, sans-serif` | Apple iOS system: Avenir Next Regular |
| Sans Serif | Futura (`futura`) | `Futura, -apple-system, sans-serif` | Apple iOS system: Futura Medium |
| Sans Serif | Gill Sans (`gill-sans`) | `"Gill Sans", -apple-system, sans-serif` | Apple iOS system: Gill Sans |
| Sans Serif | Helvetica Neue (`helvetica-neue`) | `"Helvetica Neue", Helvetica, Arial, sans-serif` | Apple iOS system: Helvetica Neue |
| Sans Serif | Optima (`optima`) | `Optima, -apple-system, sans-serif` | Apple iOS system: Optima Regular |
| Sans Serif | System Sans (`sans`) | `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif` | WebKit `-apple-system` |
| Typewriter & Mono | American Typewriter (`american-typewriter`) | `"American Typewriter", "Courier New", monospace` | Apple iOS system: American Typewriter |
| Typewriter & Mono | Courier New (`courier-new`) | `"Courier New", Courier, monospace` | Apple iOS system: Courier New |
| Typewriter & Mono | Menlo (`menlo`) | `Menlo, "Courier New", monospace` | Apple iOS system: Menlo Regular |
| Handwritten | Bradley Hand (`bradley-hand`) | `"Bradley Hand", "Chalkboard SE", cursive` | Apple iOS system: Bradley Hand Bold |
| Handwritten | Chalkboard SE (`chalkboard-se`) | `"Chalkboard SE", cursive` | Apple iOS system: Chalkboard SE Regular |
| Handwritten | Marker Felt (`marker-felt`) | `"Marker Felt", "Chalkboard SE", cursive` | Apple iOS system: Marker Felt Thin |
| Handwritten | Noteworthy (`noteworthy`) | `Noteworthy, "Chalkboard SE", cursive` | Apple iOS system: Noteworthy Light |
| Character & Decorative | Copperplate (`copperplate`) | `Copperplate, Georgia, serif` | Apple iOS system: Copperplate |
| Character & Decorative | Papyrus (`papyrus`) | `Papyrus, fantasy` | Apple iOS system: Papyrus |
| Character & Decorative | Snell Roundhand (`snell-roundhand`) | `"Snell Roundhand", cursive` | Apple iOS system: Snell Roundhand |

American Typewriter is proportional, grouped with mono faces for its typewriter character. Normal font weight resolves to available faces: Bradley Hand has Bold, Marker Felt has Thin/Wide, and Noteworthy has Light/Bold; no nonexistent Regular face is requested.

**Excluded candidates:** Athelas is cataloged for iOS document support, rather than as an iOS system font. Big Caslon, Garamond, Skia, Comic Sans MS and plain Chalkboard are downloadable on iOS. Chalkboard SE is the preinstalled option and is included. Hoefler Text Ornaments is downloadable and excluded; ordinary Hoefler Text is included. This pass adds no bundled assets, font package, dependency, remote loading, `@font-face` or CSP change; `font-src 'none'` remains exact. No font is fetched by opening or choosing an option.

**Model and picker:** existing keys/defaults retain their meaning; Georgia remains the reading default and Stowaway the App Style default. Known keys alone persist in the existing reading JSON. Missing/invalid preferences still resolve to Georgia, with no migration or automatic rewrite. Every font maps to a static app-owned CSS stack. Explicit five-category membership replaces the old implicit two-group filter; a checked-in fixture records the independently expected catalog, stack, native family and availability rationale without network-dependent tests.

The compact current-font row and existing single native modal remain. The bounded 26-row list uses the existing ScrollView, compact separated rows, wrapping labels and minimum 44×44 targets. All 24 named families and System Sans have native own-family labels. System Serif retains **Preview in reader**, including its accessibility hint, because the installed React Native UIFont path cannot address WebKit's serif design safely. Checkmarks and accessible selected state follow persisted props; selection remains open for comparisons. Existing readiness/settlement gating prevents another comparison while a restyle is pending. App Style, theme and text size stay independent.

**Backdrop:** only Reading Appearance opts into the shared modal's new dismissal option. A full-area, touch-only Pressable is a sibling behind the panel, not an ancestor of its content. Outside Appearance closes it; outside Reading Font returns to Appearance, exactly like its Done/back/escape action. A second outside tap closes Appearance. Controls, headings, blank panel space and scrolling are inside the panel and do not bubble to the backdrop. The backdrop is excluded from accessibility traversal; visible Done, modal isolation, focus, native back and accessibility escape remain. Dismissal never restores an old preference. App Style retains its prior dismissal behavior.

**Reader safety and tests:** the trusted bridge, semantic restyle/settlement, locator revisions, Read completion, session ownership, canonical HTML/hash/block IDs and quiesced navigation code are unchanged. Existing eight non-default reflow cases remain, plus representative Georgia → Menlo and Georgia → Marker Felt nonuniform deep-paragraph geometry cases. This is deliberately representative rather than exhaustive geometry for all 26 choices. Real host SQLite still exercises save/reopen for every allowed key on v1/v6. A reader integration regression rapidly compares Avenir Next → Menlo → Marker Felt, tries blocked extra taps during each pending restyle, dismisses both surfaces via backdrop, remounts, and verifies the final font/theme/size, saved passage and unchanged Read state.

**Validation:** on Node 22.23.3 / Windows, `npm.cmd run check` passed TypeScript, ESLint and **801 tests in 30 suites** (41 additional cases over 760). `npx.cmd expo install --check` reported dependencies current; `npx.cmd expo-doctor@latest` passed **21/21**; `npx.cmd expo export --platform ios` succeeded with 24 assets; `git diff --check` passed. No snapshots or dependency changes.

Tests additionally cover catalog/category uniqueness, exact stack and platform-rationale coverage, invalid CSS fallback, all own-family mappings, all selected targets, five categories, large-text scroll/wrap structure, bottom-row/Done reachability and backdrop inside/outside behavior. Initial type checks caught a removed native style alias and two test typing issues; these were corrected. Backdrop tests deliberately query hidden elements because the touch-only sibling is excluded by modal accessibility isolation. One unchanged regression timed out while export ran concurrently; the complete final sequential run passed. Test budgets and existing assertions were not changed. After implementation and validation were complete, separate read-only correctness/security and UI reviews found no actionable issues in the 13-file diff. They checked platform availability and family names, static CSS and unchanged CSP, preference compatibility, representative reflow and rapid-comparison gating, picker structure and the narrow backdrop event hierarchy. The UI review also inspected the 320px/enlarged-text component preview. Neither reviewer reran validation; actual iOS font rendering, native touch hit-testing, Dynamic Type and VoiceOver remain unperformed device checks.

Focused synthetic React Native Web previews inspect the catalog top/middle/bottom in light/dark and its bottom at emulated 2× text on a 320-point composition. The final rows and Done remain reachable. Desktop font fallbacks are not native font evidence, and component/static previews are not physical hit-testing or VoiceOver proof. Generated previews/logs/export remain ignored. New phone checks are all pending; deep passage semantics need representative family comparisons, not 26 separate exhaustive runs.

Exact catalog/dismissal files (13):

- `docs/UI_UX_Implementation.md`
- `docs/UI_UX_Device_Checklist.md`
- `src/domain/types.ts`
- `src/domain/preferences.ts`
- `src/reader/appearance.ts`
- `src/ui/appearance-modal.tsx`
- `src/ui/reader-chrome.tsx`
- `src/ui/reading-fonts.tsx`
- `tests/fixtures/reader-fonts.ts`
- `tests/bridge.test.ts`
- `tests/template.test.ts`
- `tests/ui-components.test.tsx`
- `tests/integration/i3-ui.test.tsx`

Stowaway/Classic profiles, Library/Contents/chapter rows, Read/download marks, Continue/Story Actions, Add Story, reader chrome, Light/Paper/Dark colors, D1–D4 and source/storage architecture remain unchanged. No live source request, source-policy change, PR, merge or S2B work. The historical nine-font record below is superseded only where this section says so.

## Final reader-font refinement — 8 October 2026

Focused follow-up on `95f41b148eae5071b2db9073409885f7420fa326`, still on `feat/ui-overhaul`. Owen reports that Stowaway is preferred, Classic remains useful, the chapter-first Contents and compact Read marks are good, and Light/Paper/Dark are good. This freezes that direction; it does not mark any new device checklist item passed. Only font selection changes in this pass.

**Availability checked before implementation:** [Apple's system-font catalog](https://developer.apple.com/fonts/system-fonts/) identifies Baskerville, Georgia, Palatino, Charter Roman, Times New Roman, Avenir Next Regular and Helvetica Neue as **iOS system fonts**, not downloadable-only fonts. The catalog's raw HTML platform/type markers were inspected because plain extracted text omits that distinction. [WebKit's platform-font documentation](https://webkit.org/blog/10247/new-webkit-features-in-safari-13-1/) documents `ui-serif` on iOS 13.4 and later; [WebKit's system-font guidance](https://webkit.org/blog/3709/using-the-system-font-in-web-content/) documents `-apple-system`. These support local use in the target WKWebView. They do not prove the exact face selected on an unseen phone. The recorded device is iPhone 17 Pro; the old reported iOS 26.7.1 remains tentative, and current iOS/Expo Go versions are unconfirmed.

| Picker label | Persisted key | Exact static CSS stack |
| --- | --- | --- |
| Baskerville | `baskerville` | `Baskerville, Georgia, serif` |
| Georgia | `georgia` | `Georgia, "Times New Roman", serif` |
| Palatino | `palatino` | `Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif` |
| Charter | `charter` | `Charter, Georgia, serif` |
| Times New Roman | `times` | `"Times New Roman", Times, serif` |
| System Serif | `serif` | `ui-serif, "Times New Roman", serif` |
| System Sans | `sans` | `-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif` |
| Avenir Next | `avenir-next` | `"Avenir Next", -apple-system, "Helvetica Neue", Arial, sans-serif` |
| Helvetica Neue | `helvetica-neue` | `"Helvetica Neue", Helvetica, Arial, sans-serif` |

The five added keys extend the existing typed preference whitelist; existing `georgia/palatino/serif/sans` values retain their meaning. Missing/invalid values still resolve to Georgia. The same reading-settings JSON and repository save/reload path remain. No migration, preference reset or source-provided family string. The bridge whitelist is generated from the app-owned enum list; each accepted key selects fixed CSS, never arbitrary CSS input.

**Picker:** Reading Appearance now has one current-font row. It switches the existing native Modal to a grouped Reading Font view (Bookish Serif / Sans Serif); a second native modal is not stacked. Selecting a row keeps the list open for comparisons, and the checkmark follows saved preference props. Existing readiness/settlement disables changes during restyle. Done, native back and accessibility escape return to Reading Appearance; outer Done closes it. Reopening starts at Appearance. Switching views resets the inner scroll position and requests accessibility focus on its heading.

Named fonts preview through native UIFont families; System Sans uses React Native's System family. Inspection of the installed React Native `RCTFont.mm` found no exposed system-serif design path: System Serif therefore uses a neutral label with **Preview in reader**, also exposed as an accessibility hint, instead of guessing a private New York name. Web previews can use `ui-serif`; they cannot certify native face selection. Rows have independent minimum 44×44 targets, visible checkmarks, selected/disabled accessibility state, scalable text and unrestricted wrapping. The existing scrollable modal contains all rows and Done.

**No bundled fonts.** Atkinson Hyperlegible's [specific Google Fonts artifact license](https://github.com/googlefonts/atkinson-hyperlegible/blob/main/OFL.txt) is SIL OFL 1.1 and permits bundling with its copyright/license. It is deferred because app-owned font staging, chapter file access and narrowly scoped font-loading security proof would expand this task. `font-src 'none'` is unchanged; no `@font-face`, remote font request, font package or asset was introduced. Hoefler Text is also cataloged for iOS but omitted to keep nine useful choices. New York is requested only through the public `ui-serif` keyword, never a private font name.

**Reader safety:** the established snapshot/flush/layout-start/semantic settle sequence is unchanged. Tests exercise all eight non-default keys with nonuniform deep-paragraph geometry, unchanged canonical DOM, no transient locator save or Read completion, and quiesced exit. Reader integration exercises Palatino → Avenir Next through persistence/restyle, then Paper and navigation. Existing locator revisioning, session ownership, content hashes/block IDs and completion behavior remain.

**Validation:** on Node 22.23.3 / Windows, `npm.cmd run check` passed TypeScript, ESLint and **760 tests in 30 suites** (19 additional cases over 741). `npx.cmd expo install --check` reported dependencies current; `npx.cmd expo-doctor@latest` passed **21/21**; `npx.cmd expo export --platform ios` completed with 24 assets; `git diff --check` passed. No snapshots, dependency changes or generated artifacts were added.

The existing host-SQLite preference test automatically exercises save/reopen for all nine keys under schemas v1/v6, preserving shell independence and unknown/legacy fallback. Static CSS tests independently pin every stack and reject remote font/CSS injection paths. Picker tests cover entry, groups, saved selected state, full targets, previews, focus, back/dismiss/reopen, and scroll/wrap structure at an emulated 2.5× text scale. All earlier behavioral regressions are retained; no assertions or timing budgets were weakened. During implementation, TypeScript caught an unsupported heading prop and lint caught effect-based state reset; both were corrected without changing shared text components or relaxing rules. A focus-test failure was resolved by mocking the actual native module export, keeping the focus assertion intact.

Focused visual compositions used actual production React Native Web components at 320-point width in light/dark, plus explicitly emulated 2× text and the scrolled list bottom. Labels wrap and Done remains reachable. Desktop font fallbacks and synthetic modal wrappers are not native iPhone, Dynamic Type, VoiceOver or WKWebView evidence. Preview files, logs and export remain ignored.

Separate sequential correctness/security and UI/accessibility reviews followed final passing validation. Both found **no actionable issue** in the 13-file refinement. They checked published font availability and native preview limits, static CSS/whitelist safety, unchanged CSP/storage/settlement, meaningful reflow tests, one-modal navigation, selected state, targets, wrapping and frozen scope. Reviews were read-only; they do not establish native font metrics, offline WKWebView rendering or VoiceOver behavior. Library/Contents, chapter marks, pending indicators, Continue, management disclosure, Stowaway/Classic palettes, reader chrome and Light/Paper/Dark colors are unchanged. No source traffic/policy change, schema change, dependency change, PR, merge or S2B work.

Exact font-refinement files (13):

- `docs/UI_UX_Implementation.md`
- `docs/UI_UX_Device_Checklist.md`
- `src/domain/types.ts`
- `src/domain/preferences.ts`
- `src/reader/appearance.ts`
- `src/reader/bridge.ts`
- `src/ui/appearance-modal.tsx`
- `src/ui/reader-chrome.tsx`
- `src/ui/reading-fonts.tsx`
- `tests/bridge.test.ts`
- `tests/template.test.ts`
- `tests/ui-components.test.tsx`
- `tests/integration/i3-ui.test.tsx`

The earlier refinement below remains a historical record; this section supersedes its four-button font grid and four-choice list.

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
