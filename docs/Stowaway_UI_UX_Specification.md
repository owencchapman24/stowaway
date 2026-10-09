# Stowaway v0 UI/UX Specification

**Status:** Implementation-ready design specification\
**Scope:** UI/UX polish of the existing functional v0; no new source, sync, search, annotation, pagination, or background-work features\
**Primary device:** iPhone\
**Stack constraints:** React Native + Expo Router shell; controlled local WebView reader; local SQLite/files; existing operation ownership, locators, Read state, and quiescence protocol remain authoritative\
**Design intent:** Make Stowaway feel like a focused native reading app rather than an engineering diagnostic interface.

---

## 1. Product Experience Goal

The primary Stowaway experience is:

> **Open Stowaway → Continue Reading → read comfortably.**

Everything else—importing, source updates, image work, download management, and deletion—exists to support that loop and must not visually compete with it.

The UI succeeds when:

1. A returning reader can resume in one tap from Library.
2. A story’s chapter state can be understood in a quick scan.
3. Long-form reading is calm, legible, and content-first.
4. Offline/download state is honest without feeling technical.
5. Source operations remain explicit; opening a screen never implies network work.
6. Destructive actions are discoverable but visually subordinate and difficult to trigger accidentally.
7. The existing data-integrity and lifecycle rules remain intact beneath the redesign.

---

## 2. Locked Design Principles

### 2.1 Reading first

The reader is the product. Library and Contents should guide the user toward reading, not present every maintenance capability at equal visual weight.

### 2.2 Progressive disclosure

Show common actions prominently:

- Continue Reading
- Open story
- Open chapter
- Add Story
- Check for Updates when deliberately requested
- Resume Download when text is missing

De-emphasize maintenance actions:

- Image retry
- View source
- Remove Downloads
- Remove Story
- Development diagnostics

### 2.3 Native-feeling, not a visual imitation exercise

Use iOS-familiar hierarchy, spacing, lists, sheets, and confirmations. Do not add fragile custom gestures or a full custom navigation framework. Preserve Expo Router route keys, ownership tokens, navigation blocking, and the reader handoff protocol.

### 2.4 State honesty

The UI must clearly distinguish:

- readable text versus known metadata only;
- unread state versus download state;
- text completion versus image completion;
- active operation versus prior result;
- cancelled versus failed;
- logical deletion success versus optional cleanup warning;
- already-running offline behavior versus standalone offline installation.

### 2.5 Accessible by default

Text labels, hierarchy, target size, contrast, focus order, announcements, and confirmation semantics are part of the component system—not a later patch.

### 2.6 Scope discipline

This pass does **not** add:

- cover art or generated covers;
- search or filters;
- tab navigation;
- bookmarks, notes, or highlights;
- reading-time estimates;
- TTS;
- pagination/page turns;
- font-family catalog;
- margin/line-spacing customization;
- automatic updates;
- sync/accounts;
- additional sources.

---

## 3. Information Architecture

Retain the current stack hierarchy:

```text
Library (/)
├── Add Story (/add-story)
├── Story Contents (/story?story=…)
│   └── Reader (/reader?chapter=…)
└── Development diagnostics (__DEV__ only)
```

### Navigation decisions

- **No tab bar.** The product has one primary hierarchy, not multiple peer destinations.
- Library is the root.
- Add Story is a top-right `+` action from Library.
- Story Contents uses a clear back-to-Library action.
- Reader uses a clear back-to-Contents action.
- Native Back/swipe behavior remains controlled by current busy/settlement rules.
- The initial UI pass may use app-owned top bars rather than changing the existing router header architecture. This minimizes lifecycle risk while still delivering native hierarchy.

---

## 4. Visual Direction

### 4.1 Personality

**Quiet, warm, literary, trustworthy.**

The app should feel closer to a native reading/library tool than to a forum, download manager, or admin dashboard.

### 4.2 No-cover library

SpaceBattles stories generally do not supply reliable cover art. Do not create empty cover rectangles, random gradients, initials-as-covers, or AI art. Use excellent typography and compact information hierarchy instead.

### 4.3 App shell versus reader

- **App shell:** system sans-serif, clear list hierarchy, light visual structure.
- **Reader body:** serif text, warm paper, generous line height.
- The app shell follows system light/dark appearance.
- The reader keeps its existing independent Light/Dark reading preference.
- Sepia is explicitly deferred from this implementation pass.

---

## 5. Design Tokens

These are implementation targets, not a requirement to reproduce Apple UI pixel-for-pixel.

### 5.1 Color tokens

#### Light shell

| Token | Value | Use |
|---|---:|---|
| `canvas` | `#F7F4EE` | Main app background |
| `surface` | `#FFFFFF` | Cards, rows, sheets |
| `surfaceSubtle` | `#EEE9E0` | Grouped sections, muted controls |
| `textPrimary` | `#1F2428` | Titles and body |
| `textSecondary` | `#667078` | Metadata and hints |
| `accent` | `#315E79` | Primary action, unread emphasis, links |
| `accentPressed` | `#24485E` | Press state |
| `accentSoft` | `#E5EEF3` | Selected/soft accent surface |
| `border` | `#D9D3C8` | Dividers and outlines |
| `warning` | `#9A5A12` | Nonfatal attention state |
| `success` | `#3F6B55` | Completed operation, restrained use |
| `destructive` | `#B3261E` | Remove Story / destructive confirmation |
| `errorSurface` | `#FBE9E7` | Error banner background |

#### Dark shell

| Token | Value | Use |
|---|---:|---|
| `canvas` | `#121416` | Main background |
| `surface` | `#1B1E21` | Cards and rows |
| `surfaceSubtle` | `#24282C` | Grouped sections |
| `textPrimary` | `#F2F0EA` | Titles and body |
| `textSecondary` | `#AEB6BD` | Metadata and hints |
| `accent` | `#8DB9D2` | Primary emphasis |
| `accentSoft` | `#223A47` | Soft selection |
| `border` | `#343A3F` | Dividers and outlines |
| `warning` | `#E5AD62` | Attention state |
| `success` | `#83B79A` | Success state |
| `destructive` | `#FF8A80` | Destructive text/icon |
| `errorSurface` | `#3A2222` | Error banner background |

All final combinations must be contrast-tested. Color never carries the only state signal.

### 5.2 Reader colors

Preserve the existing core reader palette with minor refinement:

| Theme | Paper | Ink | Link |
|---|---:|---:|---:|
| Light | `#FCF9F2` | `#242424` | `#1D5E96` |
| Dark | `#15191E` | `#E8E5DD` | `#9AC4FF` |

### 5.3 Typography

Use the iOS system font for app chrome. Do not add a font dependency.

| Style | Target | Weight | Use |
|---|---:|---:|---|
| Large title | 34 / 40 | 700 | Library title |
| Screen title | 28 / 34 | 700 | Add Story, story hero fallback |
| Section title | 20 / 25 | 600 | Library, Chapters, Story Actions |
| Row title | 17 / 22 | 600 | Story/chapter title |
| Body | 17 / 24 | 400 | Primary explanatory text |
| Secondary | 15 / 20 | 400 | Author, counts, statuses |
| Caption | 13 / 18 | 500 | Badges, timestamps |

Important titles may wrap to two lines. Do not truncate critical title/author/error text merely to preserve a rigid layout.

Reader body remains Georgia/serif at the existing 14–32 range, default 20, with approximately 1.6–1.7 line height.

### 5.4 Spacing

Base scale:

```text
4, 8, 12, 16, 20, 24, 32, 40
```

- Standard horizontal screen inset: 20.
- Compact row vertical inset: 12–14.
- Section separation: 24–32.
- Dense metadata gap: 4–6.
- Touch target: minimum 44 × 44.

### 5.5 Shape and elevation

- Small control radius: 10.
- Card radius: 16.
- Sheet radius: 20 at top corners.
- Prefer border/surface contrast over heavy shadows.
- Use shadows only for temporary overlays/sheets.

### 5.6 Motion

- Use native press feedback and short 150–200 ms opacity/background transitions.
- No parallax, bouncing cards, decorative loaders, or mandatory motion.
- Respect Reduce Motion.

---

## 6. Reusable Component System

The current one-style `Control` should be replaced by semantic components. Do not make every action a filled blue rectangle.

### 6.1 Structural components

- `AppScreen`
  - safe-area handling;
  - theme canvas;
  - optional scroll/list host.
- `ScreenHeader`
  - title;
  - back action;
  - trailing action(s);
  - busy-aware disabling.
- `SectionHeader`
  - title;
  - optional trailing action.
- `Card`
- `Divider`
- `ListSection`

### 6.2 Action components

- `PrimaryButton`
  - filled accent;
  - one principal action per view/section.
- `SecondaryButton`
  - soft/outlined accent.
- `TertiaryButton`
  - text-only action.
- `IconButton`
  - 44-point target;
  - visible icon plus accessibility label.
- `DestructiveButton`
  - restrained red text/outline in screen;
  - native destructive confirmation on activation.

### 6.3 Content components

- `ContinueReadingCard`
- `StoryRow`
- `ChapterRow`
- `StatusBadge`
- `ProgressBar`
- `MetadataLine`
- `InlineBanner`
- `OperationPanel`
- `EmptyState`
- `LoadingState`
- `ReaderTopBar`
- `ReaderBottomBar`
- `AppearanceSheet`

### 6.4 Component behavior rules

- Rows are the main navigation target; do not place a giant “Open” button inside each row.
- Secondary inline actions must have independent 44-point targets.
- Disabled state uses both visual attenuation and accessibility state.
- Busy state must not release until existing authoritative refresh/settlement rules complete.
- Presentational extraction must not change route keys, story operation tokens, ReadCompletion ownership, or reader quiescence.

---

## 7. Screen Specification: Library

### 7.1 Purpose

Answer, in order:

1. Where was I reading?
2. What stories are in my library?
3. Which stories have unread or missing chapters?
4. How do I add another story?

### 7.2 Layout

```text
┌──────────────────────────────────────────┐
│ Stowaway                              ＋ │
│                                          │
│ Continue Reading                         │
│ ┌──────────────────────────────────────┐ │
│ │ Aenys, King of Dreams               │ │
│ │ Chapter 14 · The Queen's Progress   │ │
│ │ Continue reading                 ›   │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Library                                  │
│ ┌──────────────────────────────────────┐ │
│ │ A Normal Isn't Ordinary             │ │
│ │ 25 chapters · 7 unread          7  › │ │
│ ├──────────────────────────────────────┤ │
│ │ Eyes Open                           │ │
│ │ 34 chapters · 12 unread        12  › │ │
│ ├──────────────────────────────────────┤ │
│ │ Aenys, King of Dreams               │ │
│ │ 38 chapters · 37 unread        37  › │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### 7.3 Header

- Large title: **Stowaway**.
- Trailing `+` icon button:
  - visible label/accessibility label: **Add Story**;
  - pushes Add Story.
- No giant Add Story button in the content body.

### 7.4 Continue Reading card

Show only when an availability-aware resume target exists.

#### Resume-target semantics

The UI implementation should add a narrow repository projection rather than infer from screen arrays:

- select the most recently updated locator whose chapter has `body_available = 1`;
- include story title, chapter title, story ID, chapter ID, and whether the entry is currently listed or saved-unlisted;
- removed stories never appear;
- unavailable retained shells never appear;
- after Remove Downloads, the card disappears for that story until body redownload;
- a saved-unlisted readable target is allowed but must show **Saved chapter no longer listed**;
- no locator means no global Continue Reading card—do not invent reading history from Read state alone.

Card tap opens Reader directly.

### 7.5 Story rows

Each story row contains:

- title, maximum two lines;
- author or “Author unavailable” only when needed;
- compact status line;
- optional unread count badge;
- trailing chevron.

#### Status copy

Fully downloaded:

```text
38 chapters · 7 unread
```

Partially downloaded:

```text
4 of 38 downloaded · 34 unread
```

All read:

```text
38 chapters · All read
```

Do not repeat “text chapters downloaded” on every row unless download distinction is currently relevant.

### 7.6 Optional read progress indicator

A thin 2–3 point progress line may represent `(total - unread) / total`. It is supplementary only; the textual count remains authoritative.

### 7.7 Empty state

```text
No stories yet
Paste a public SpaceBattles thread URL to build your offline library.
[ Add Story ]
```

### 7.8 Errors and warnings

- Local library read failure appears as an inline error banner under the header.
- Global image/file warning appears as a warning banner, not ordinary body text.
- Neither obscures existing readable content if the list remains available.

### 7.9 Development diagnostics

In `__DEV__` only:

- place under a visually separate, collapsed or low-prominence **Development** section at the bottom;
- never mix with story rows or primary actions.

---

## 8. Screen Specification: Story Contents

### 8.1 Purpose

Answer:

1. What story is this?
2. Where do I continue?
3. Which chapters are Read, Unread, downloaded, or pending?
4. Are updates/images current?
5. Where are maintenance and destructive controls?

### 8.2 Layout

```text
┌──────────────────────────────────────────┐
│ ‹ Library                         •••    │
│                                          │
│ Aenys, King of Dreams                    │
│ Kingofwinter                             │
│ 38 chapters · 11 unread                  │
│ Downloaded for offline reading           │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Continue Reading                    │ │
│ │ Chapter 14 · The Queen's Progress › │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ [ Check Updates ]  [ Images ]            │
│                                          │
│ Chapters                                 │
│ ✓  1   Prologue                     ○    │
│ ✓  2   A New Prince                 ○    │
│ ●  3   Court                        ●    │
│ ●  4   The Council                  ●    │
│ ↓  5   A Visitor                    ●    │
│                                          │
│ Saved chapters no longer listed          │
│ ✓      Old Interlude                 ›   │
│                                          │
│ Story Actions                            │
│ View Source                              │
│ Remove Downloads                         │
│ Remove Story                             │
└──────────────────────────────────────────┘
```

### 8.3 Header and story hero

- Back: **Library**.
- Trailing ellipsis opens secondary actions, or the actions remain in the lower Story Actions section if a menu adds implementation risk.
- Story title: 28-point/large, wraps naturally.
- Author below.
- Compact counts and availability summary.

Avoid displaying raw technical explanations like “Text and images have separate download states” permanently. Surface that distinction only when status is incomplete or an operation is underway.

### 8.4 Primary story CTA

Choose exactly one principal CTA:

1. **Continue Reading**
   - if a readable story-specific locator target exists.
2. **Start Reading**
   - if readable current bodies exist but no locator exists;
   - target first unread readable current entry, otherwise first readable current entry.
3. **Resume Download**
   - if current entries are missing text and no readable target exists.

If a locator points to an unavailable shell, do not open it. Use the best available readable target or Resume Download.

### 8.5 Quick actions

- `Check Updates`: secondary button, always explicit.
- `Images`: show only when image work is relevant.
  - Label by actual next action: **Download Images**, **Retry Images**, or omit.
- `View Source`: tertiary/menu action.

Do not make all three filled buttons.

### 8.6 Chapter rows

Minimum row height: 56; larger with wrapped titles.

Each row contains:

- state marker:
  - checkmark + “Read” semantics;
  - accent dot + “Unread” semantics;
  - download icon/label for unavailable text;
- current position number for primary entries;
- title, up to two lines;
- optional secondary line:
  - `Not downloaded`;
  - `Saved chapter no longer listed`;
- trailing Read/Unread toggle with a 44-point target.

#### Interaction

- Tapping a readable row opens Reader.
- Pending row does not open Reader and communicates **Not downloaded**.
- Read toggle works independently, including pending current entries and saved-unlisted entries.
- State is not conveyed by color alone.

### 8.7 Saved-unlisted section

Render as a distinct section below current chapters:

- title: **Saved chapters no longer listed**;
- explanatory caption once, not on every row;
- readable saved entry opens Reader;
- unavailable retained shell does not appear as a saved local copy;
- Previous/Next remains disabled in Reader as existing behavior specifies.

### 8.8 Operation panel

During update/image work, display one compact panel near quick actions:

```text
Checking for updates
Downloading chapter 4 of 8 · Chapter title
[progress bar]
[ Cancel ]
```

Rules:

- keep navigation and conflicting actions disabled through authoritative refresh;
- retain current operation ownership semantics;
- completed result collapses to a concise banner;
- do not leave old progress text permanently mixed into story metadata.

### 8.9 Fix: stale Contents after foreign Resume settlement

During this UI phase, implement the audited fix:

- focused Contents subscribes to relevant story-operation completion;
- when a foreign Resume/Add Story operation releases ownership, invalidate and perform an authoritative story snapshot refresh;
- keep actions gated until that refresh applies;
- do not add a global state library;
- a small story-snapshot hook or operation generation is sufficient.

### 8.10 Story Actions and management

At the bottom, visually separated from chapters:

```text
Story Actions
View Source
Remove Downloads

Danger Zone
Remove Story
```

- Remove Downloads: secondary/destructive-outline treatment.
- Remove Story: red text/outline; not a filled red block unless inside native confirmation.
- Keep current native confirmation flows.

---

## 9. Screen Specification: Reader

### 9.1 Design decision: compact persistent chrome for v0

Do **not** implement tap-to-hide reader chrome in this pass. It would add WebView gesture/message interactions that could conflict with selection, links, spoilers, trusted read-end gestures, and the quiescence protocol.

Use compact persistent top and bottom bars. The content still receives the majority of the screen.

### 9.2 Layout

```text
┌──────────────────────────────────────────┐
│ ‹ Contents        Chapter 14        Aa   │
├──────────────────────────────────────────┤
│                                          │
│               chapter prose              │
│                                          │
│      serif text, generous line height    │
│       quotes, spoilers, lists, images    │
│                                          │
├──────────────────────────────────────────┤
│ ‹ Previous          14 of 38        Next ›│
└──────────────────────────────────────────┘
```

### 9.3 Top bar

- Back: **Contents**.
- Center: chapter title, one line visually, full accessibility label.
- Trailing: `Aa` appearance button.
- Minimum 44-point controls.
- Reader navigation still uses the acknowledged quiescence path.

### 9.4 Bottom bar

- Previous.
- Center position: `14 of 38`; no invented percent/time estimate.
- Next.
- Saved-unlisted reader: Previous/Next disabled, center label may say **Saved chapter**.

### 9.5 Appearance sheet

Use a native-like React Native `Modal`/page sheet rather than a new dependency.

```text
Reading Appearance

Text Size        A−    20    A+
Theme            Light     Dark

[ Done ]
```

Rules:

- retain existing 14–32 range;
- retain current Light/Dark preference semantics;
- no new font families, sepia, line-spacing, margins, or brightness settings in this pass;
- changing appearance uses the existing restyle/locator protection;
- controls remain accessible at large text.

### 9.6 Reader document styling

Preserve canonical HTML and bridge logic. CSS-only polish may include:

- paper/ink token update;
- `max-width` for future larger screens while remaining full-width on iPhone;
- refined heading scale;
- softer blockquote border/background;
- clearer spoiler `details/summary` styling;
- table horizontal containment without page-level horizontal scroll;
- consistent image radius and caption/placeholder treatment;
- visible link affordance;
- comfortable bottom padding above the native bottom bar.

Do not alter:

- block IDs;
- content hashes;
- canonical HTML;
- source image mappings;
- locator schema;
- read-end/quiescence messages.

### 9.7 Reader errors

If the local render cannot open or persistence fails:

- preserve readable text whenever possible;
- show a compact inline/overlay banner;
- primary action: **Retry**;
- do not replace the entire reader with a generic screen unless no model exists.

---

## 10. Screen Specification: Add Story / Resume Download

### 10.1 New import mode

```text
‹ Library

Add Story
Paste a public SpaceBattles thread URL.

SpaceBattles URL
┌──────────────────────────────────────────┐
│ https://forums.spacebattles.com/…        │
└──────────────────────────────────────────┘

[ Import Story ]

Only primary Threadmarks are imported.
Downloads stay on this device.
```

- One clear text field.
- Primary button: **Import Story**.
- Do not show “Ready” status before anything happens.
- Keep the privacy/scope explanation short.

### 10.2 Resume mode

When opened with a saved story ID:

- title: **Resume Download**;
- display story title and current `downloaded / total`;
- do not present an editable URL as though the user is importing a new story;
- primary button: **Resume Download**;
- secondary: **Back to Story**.

The stored URL remains internal unless the user selects View Source.

### 10.3 Import progress

Use one operation card:

```text
Importing story
Downloading chapter 12 of 38
The Council
[progress bar]
[ Cancel ]
```

Stage labels should be human-readable:

- Validating story URL
- Reading primary Threadmarks
- Saving story
- Downloading chapter X of N
- Downloading eligible images
- Import complete

Avoid exposing internal words such as “manifest” or “reconciling” in primary UI copy unless a detailed error requires it.

### 10.4 Result state

Success card:

```text
Aenys, King of Dreams
38 of 38 chapters downloaded
[ Open Story ]
```

Partial/cancelled:

```text
Download paused
12 of 38 chapters are available offline.
[ Resume Download ]  [ Open Story ]
```

### 10.5 Errors

Use typed banners with concise context and a clear next action. Preserve the existing source/error taxonomy.

---

## 11. Management and Confirmation UX

### 11.1 Remove Downloads

Screen action copy:

**Remove Downloads**\
“Free local storage while keeping this story, Read/Unread state, reading positions, and update history.”

Confirmation title:

**Remove downloads for “Story Title”?**

Confirmation body:

“Downloaded chapter text and local story images will be removed from this device. The story, Threadmarks, Read/Unread state, saved reading positions, and update history will remain. You can download current chapters again later.”

### 11.2 Remove Story

Screen action copy:

**Remove Story**\
“Remove this story and all of its Stowaway data from this device.”

Retain the current two-confirmation flow.

### 11.3 Fix: uncertain post-COMMIT management wording

If an unclassified database/driver error occurs and the final commit state is uncertain:

- do not promise rollback;
- hold ownership;
- perform an authoritative local reread;
- report the observed state.

Copy when state cannot be confirmed:

> “Stowaway couldn’t confirm the final local state. Reopen the Library before retrying.”

If logical deletion committed but file cleanup failed:

> “Removal completed. Some unused local files could not be cleaned up.”

Action: **Retry Cleanup**.

Never imply a deleted story was restored merely because cleanup failed.

---

## 12. Status, Loading, and Error System

### 12.1 Inline banner variants

- `info`: neutral/accent surface.
- `success`: restrained success surface.
- `warning`: amber surface.
- `error`: red surface with `accessibilityRole="alert"`.
- `busy`: spinner + live-region message.

Every banner contains:

- short title;
- one sentence maximum by default;
- optional action;
- optional expandable technical code only in development or detail view.

### 12.2 Failure wording

| Failure class | Primary UI wording |
|---|---|
| Blocked/challenge | “SpaceBattles blocked this request. Stowaway stopped without bypassing access controls.” |
| Incomplete index | “The primary Threadmark list was incomplete. Your previous saved contents were kept.” |
| Parser/structure | “Stowaway couldn’t safely understand this story’s current page structure.” |
| Network/transient | “The connection was interrupted. Completed local chapters were kept.” |
| Storage | “Stowaway couldn’t save this change locally. Your last committed state was kept.” |
| Cancelled | “Cancelled. Completed local work was kept.” |
| Busy | “Another operation for this story is still finishing.” |

### 12.3 Fix: image-discovery cancellation classification

Cancellation during legacy image-discovery persistence must remain **cancelled**, not be converted to storage failure.

UI result:

> “Image work cancelled. Text and completed local images were kept.”

The underlying typed cancellation should survive repository/orchestration boundaries.

### 12.4 Empty and unavailable states

- Empty library: Add Story CTA.
- Empty story after full removal/stale route: “Story is no longer in the local library” + Library action.
- Text unavailable: “Not downloaded” + story-level Resume Download.
- Missing image: existing readable placeholder; no automatic source retry.
- Offline source action attempted: network error without disturbing local content.

---

## 13. Accessibility Specification

### 13.1 Touch and focus

- Every interactive target is at least 44 × 44 points.
- Entire StoryRow and readable ChapterRow are controls.
- Trailing Read toggle is a separate accessible control.
- No critical action exists only behind long press, swipe, or unlabeled icon.

### 13.2 Dynamic Type / larger text

- App chrome text scales with system settings.
- Critical text may wrap.
- Avoid `numberOfLines` for story titles, errors, confirmation explanations, and action labels unless a full accessible label/value is available.
- At accessibility sizes, horizontal action rows may wrap or stack.
- Test at the largest practical accessibility sizes.

### 13.3 VoiceOver

- Screen titles use header semantics.
- StoryRow label includes title, author if available, download state, and unread count without repetitive noise.
- ChapterRow label includes chapter number/title, Read/Unread, and availability.
- Read-toggle action says “Mark [chapter] as read/unread.”
- Busy/result changes use polite live regions; errors use alert semantics.
- Modal/sheet focus moves into the modal and does not expose inactive background controls.
- Decorative icons are hidden from accessibility.

### 13.4 Non-color state

Read/unread/download/error state always includes text or icon shape plus accessible semantics. Do not rely on blue/gray/red alone.

### 13.5 Reader accessibility

- Existing semantic headings, links, lists, tables, details/summary, and image alt text remain available in the WebView.
- Spoiler summaries remain operable.
- Local image placeholders remain readable.
- No source script is enabled.

---

## 14. State and Architecture Requirements for the UI Pass

The visual redesign must not bypass the engineering invariants established through I4 and pre-UI hardening.

### 14.1 Preserve unchanged

- route identity keys;
- story/post stable identity;
- SQLite schema and migrations unless a small resume projection requires only a query/API;
- operation ownership and cross-handle exclusion;
- final authoritative refresh before controls re-enable;
- `ReadCompletion` lifetime;
- `prepareForExit(handoffId) → quiesced` reader protocol;
- position revision ordering;
- canonical HTML/hashes/block IDs/image mappings;
- source pacing/access policy;
- explicit-only source work;
- S2A isolation.

### 14.2 Safe UI extraction strategy

Prefer:

1. theme tokens;
2. presentational components;
3. narrow screen hooks that wrap existing repository/ownership behavior;
4. screen-by-screen replacement with existing integration tests retained.

Avoid:

- global state library;
- generic app-wide job framework;
- router rewrite;
- replacing FlatList with a custom virtualizer;
- moving persistence logic into presentational components;
- optimistic UI for destructive/storage actions unless authoritative rollback is proven.

### 14.3 New narrow data projections permitted

- global availability-aware Continue Reading target;
- story-specific availability-aware resume/start target;
- story snapshot generation/refresh hook for cross-screen operation completion.

These should be repository/query additions, not duplicated derivation in multiple screens.

---

## 15. Screen-State Rules

### 15.1 Refresh

- On focus: read authoritative local snapshot.
- On owned operation completion: refresh before enabling controls.
- On foreign same-story operation completion while focused: invalidate and refresh before enabling controls.
- Late results must not attach to another route/story.

### 15.2 Busy behavior

- Disable conflicting actions.
- Keep Cancel available when operation supports cancellation.
- Keep Back/gesture behavior consistent with existing settlement rules.
- Do not replace content with a full-screen spinner when usable local content remains.

### 15.3 Offline behavior

- Local Library, Contents, Reader, Read toggles, and management remain usable offline where data permits.
- Network-required actions remain explicit and fail honestly.
- No screen opening triggers a source request.

---

## 16. Anti-Patterns to Avoid

1. Giant full-width blue button for every action.
2. Every metadata field given equal visual weight.
3. Fake cover art or placeholder rectangles.
4. Tab bar for a single-hierarchy app.
5. Auto-refreshing SpaceBattles on screen open or pull-to-refresh.
6. Hiding destructive actions behind ambiguous gestures.
7. Showing internal terms like “manifest COMPLETE” as normal product copy.
8. Progress percentages or time remaining the app does not actually know.
9. Color-only Read/Unread state.
10. Reader tap-to-hide chrome in this pass.
11. New font/theme complexity before existing reading controls feel excellent.
12. UI refactors that bypass ownership, quiescence, or authoritative refresh.
13. Permanent success/error paragraphs that clutter every story screen.
14. Multiple primary buttons on one screen.

---

## 17. Phased Implementation Plan

### Phase UI-0 — Foundations

- Add theme tokens and system shell dark mode.
- Build semantic buttons, rows, cards, banners, headers, badges, and progress panel.
- Replace generic `Control` gradually while keeping compatibility for diagnostics.
- Add component tests for variants, large text wrapping, disabled/accessibility state.

**Exit:** Components render correctly in light/dark, 44-point targets, no production flow changed.

### Phase UI-1 — Library + Continue Reading

- Redesign Library.
- Add availability-aware global resume projection.
- Add Continue Reading card.
- Replace story buttons with rows.
- Polish empty/error/dev states.

**Exit:** Open app → resume reading in one tap; Remove Downloads hides unavailable target; relaunch preserves target.

### Phase UI-2 — Story Contents + UI-phase audit fixes

- Redesign story hero, primary CTA, chapter rows, actions, operation panel, saved-unlisted section, management area.
- Implement foreign-operation completion refresh.
- Preserve image cancellation typing.
- Reconcile uncertain management outcome wording/state.

**Exit:** Held Resume COMMIT cannot leave focused Contents stale; all existing ownership tests pass.

### Phase UI-3 — Add Story / Resume Download

- Split new-import and resume modes visually.
- Add progress/result cards and typed banners.
- Remove unnecessary raw/internal copy.

**Exit:** New import, cancel, partial resume, success, and typed failures remain correct and clearer.

### Phase UI-4 — Reader chrome and appearance

- Add compact top/bottom bars.
- Add appearance sheet.
- Refine reader CSS without canonical changes.
- Preserve quiescence, locator, trusted read-end, links, spoilers, images.

**Exit:** Existing reader regression suite passes; passage and read state remain stable through appearance/navigation.

### Phase UI-5 — Accessibility and physical polish

- VoiceOver pass.
- Dynamic Type pass.
- system light/dark shell pass;
- error/loading/empty-state pass;
- final spacing and copy review.

**Exit:** Physical iPhone UI acceptance passes; no blocking accessibility/navigation defect.

---

## 18. Testing and Acceptance Plan

### 18.1 Deterministic tests

Retain all current suites and add tests for:

- Continue Reading query and visibility;
- saved-unlisted/unavailable resume targets;
- Library story-row semantics;
- story CTA selection;
- chapter-row Read toggle and availability;
- foreign operation completion refresh;
- image cancellation classification;
- uncertain management state copy;
- large-text component layouts where testable;
- appearance sheet controls;
- reader top/bottom navigation preserving quiescence;
- no source work on screen open.

Do not rely on snapshots alone. Assert behavior, labels, state, and repository results.

### 18.2 Focused physical iPhone acceptance

#### Library

- Continue Reading opens exact saved chapter/passage in one tap.
- Remove Downloads removes that target until redownload.
- Long titles and large text remain usable.
- system light/dark shell is legible.

#### Story Contents

- Scan 30–40 chapters comfortably.
- Read/Unread is obvious without color.
- Pending text is obvious.
- operations remain deliberate.
- held Resume settlement refreshes visible counts before controls enable.
- management actions remain separated and clear.

#### Reader

- content occupies most of screen;
- top/bottom controls are easy one-handed targets;
- font/theme sheet is usable;
- paragraph-gap restoration remains good;
- links/spoilers/selection/images still work;
- immediate Next/Contents preserves position/Read;
- offline reading remains intact.

#### Add Story

- paste/type URL;
- import progress is comprehensible;
- cancel/partial/resume is clear;
- errors are distinct.

#### Accessibility

- VoiceOver can complete Add Story → open story → open chapter → adjust appearance → return.
- larger text does not truncate key actions/state.
- Reduce Motion causes no dependency on animation.

### 18.3 Acceptance statement

The UI phase is accepted when Owen prefers normal reading/navigation in Stowaway to the current prototype and can complete the core loop without encountering a visually dominant maintenance/debug control.

S2B remains a separate subsequent milestone.

---

## 19. Implementation Deliverables

The implementation PR should include:

1. This specification committed under `docs/`.
2. Theme/tokens and reusable UI components.
3. Redesigned Library, Story Contents, Add Story, and Reader chrome.
4. Continue Reading projection and controls.
5. The four UI-phase audit fixes.
6. Updated UI/behavior tests.
7. A short UI device checklist.
8. Screenshots for review kept out of Git unless intentionally added as documentation assets.
9. No changes to canonical story content, schema, source policy, or S2B.

---

## 20. Final Locked Decisions

- **Library presentation:** text-first native list; no covers.
- **Primary return action:** Continue Reading.
- **Navigation:** stack, no tabs.
- **Reader mode:** continuous vertical scroll.
- **Reader chrome:** compact and persistent for v0; no tap-to-hide.
- **Reader settings:** existing size range + Light/Dark only.
- **App shell:** follows system light/dark.
- **Story operations:** progressively disclosed; explicit only.
- **Destructive actions:** separate management section + native confirmations.
- **Accessibility:** 44-point targets, text state, Dynamic Type, VoiceOver labels/live regions.
- **Architecture:** presentational extraction around existing ownership/settlement logic; no global state library.
- **Next milestone after UI acceptance:** S2B standalone installation and Metro-free offline cold-start validation.
