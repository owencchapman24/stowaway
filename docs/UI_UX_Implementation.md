# Stowaway UI/UX implementation

8 October 2026, America/New_York. **UI/UX overhaul candidate implemented; physical UI acceptance pending.** Branch: `feat/ui-overhaul`. Main base: `fae9a4e63d84f5a9572a6451a42f61bc3754627a`. The controlling [UI specification](Stowaway_UI_UX_Specification.md) was already committed separately at `27b262c174e0b332b533edae025d03c11f80ad8b`. Fetch verified the expected remote base and clean branch before editing.

S0, S1 and S2A are accepted; I0–I4 are merged/accepted. The whole-repository Astra audit is complete. Pre-UI hardening is merged in PR #9 and passed Owen's focused phone retest, within [its recorded limits](Pre_UI_Hardening.md). S2B remains deferred; full v0 remains incomplete. No PR creation or merge belongs to this pass.

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
