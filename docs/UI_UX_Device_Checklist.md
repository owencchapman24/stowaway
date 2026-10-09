# UI/UX overhaul — iPhone review

**Current status: UI/UX is merged in main `76021496aedb506bd7213daf2d014dd7e9fb0a9d`; the v0 visual direction is frozen.** Owen reports preferring Stowaway to SpaceBattles in Safari and that partial-sheet phone sanity on `69c5f5a51cefbcc1e34060b803c0860643c0b01f` passed to his satisfaction, with real reader prose exposed during font comparison. This is aggregate user-reported evidence, not a per-item or exhaustive VoiceOver/Dynamic Type/native-event pass. Individual boxes below remain unchecked where no individual result was supplied. Historical S0/S1/S2A/I0–I4 and pre-UI acceptance retain their original boundaries. S2B standalone acceptance remains unperformed; already-running offline reading is not Metro-free cold-start proof.

Do not reset the library or damage files to manufacture a case. Mark unavailable natural cases **Not exercised**. Use only selected public stories and deliberate existing source actions.

## Historical initial UI checklist

Retained review protocol from `feat/ui-overhaul`: record the tested commit, iPhone/iOS/Expo Go versions, system text size and failures. Later catalog and partial-sheet checks supersede the older presentation-specific instructions.

- [ ] 1. Open with the existing library: stories, counts, Read flags, passages, images and settings survive without reset.
- [ ] 2. Library is easy to scan; titles, authors and partial/all-read summaries are clear.
- [ ] 3. The header **+ / Add Story** opens Add Story. Opening screens starts no source work.
- [ ] 4. Global **Continue Reading** opens the latest readable chapter at its saved passage, including when multiple stories have been read.
- [ ] 5. Story **Continue Reading** opens that story's saved passage, rather than another story's.
- [ ] 6. A story without a saved readable passage offers **Start Reading**: first unread downloaded chapter, otherwise first downloaded chapter.
- [ ] 7. With downloads removed and no readable target, **Resume Download** is the main action.
- [ ] 8. Scan a long chapter list: numbering, wrapped titles and row targets are comfortable.
- [ ] 9. Use the separate Read/Unread control; counts update and persist after reopening. Toggling does not open the reader.
- [ ] 10. Pending rows say **Not downloaded**, cannot open, and still allow manual Read/Unread correction.
- [ ] 11. Where naturally available, saved-unlisted local chapters appear separately, open correctly and have no Previous/Next navigation.
- [ ] 12. Deliberately check for updates. Progress/result and disabled conflicting controls are understandable.
- [ ] 13. Where image work is naturally relevant, Download/Retry Images displays progress, honest local/omitted/pending counts and a concise result.
- [ ] 14. Cancel supported work. Cancellation is distinct from failure; controls recover after settlement.
- [ ] 15. Add Story: paste/type a URL, use the keyboard, inspect progress/cancellation/results and Open Story. Resume mode has the saved title/counts and no editable URL.
- [ ] 16. Reader top Contents/title/Aa and bottom Previous/position/Next are comfortable; content has most of the screen.
- [ ] 17. Open/close Reading Appearance. All controls and Done remain reachable.
- [ ] 18. Increase/decrease font size substantially at a recognizable paragraph gap. The passage stays nearby; leave/reopen restores it.
- [ ] 19. Reader Light/Dark persists independently after reopening.
- [ ] 20. Change the iPhone's system appearance. Library, Contents, Add Story, appearance modal and status bar adapt; reader preference remains independent.
- [ ] 21. Long story/chapter titles wrap without hiding important actions. The reader's shortened title has a full spoken label.
- [ ] 22. At a large accessibility text size, scroll all screens and the appearance modal; actions/state stay reachable without clipped controls.
- [ ] 23. Where practical, VoiceOver announces row number/title, Read/Unread, download availability, disabled/destructive actions and errors. Modal focus enters Reading Appearance.
- [ ] 24. With the project already running, disable networking and open downloaded text/local images; local Read correction and navigation work.
- [ ] 25. Remove Downloads: cancel once, then deliberately confirm for a selected story. The story/Read/passage/history remain; unreadable Continue targets disappear.
- [ ] 26. Explicitly redownload; retained readable passages become eligible again. Check a restored passage and local image.
- [ ] 27. Remove Story: cancel each confirmation once; a deliberate full removal needs both confirmations and affects only that story.
- [ ] 28. Immediate Next/Contents and background/return preserve completed local progress. Appearance changes do not mark an unread chapter complete.
- [ ] 29. If reasonably reproducible, leave Resume while its last save finishes and return to Contents. Counts/rows refresh before controls recover. Do not manufacture storage failures.
- [ ] 30. After ordinary reading, answer: **Would you rather use this than SpaceBattles in Safari?** Note the most distracting or uncomfortable detail.

Report individual checks as Pass / Fail / Not exercised, with a brief description for failures. No special physical storage-failure experiment is required for the management wording fix. Native keyboard, safe areas, Dynamic Type, VoiceOver, WKWebView geometry and subjective reading comfort need device evidence; deterministic tests and web previews do not certify them. The original pre-PR physical-review gate is historical; the UI milestone is now merged.

## Physical-feedback refinement checks

Retest on the refinement commit; earlier subjective feedback is not a pass for these changes.

- [ ] 31. Compare **Stowaway** and **Classic** from Library → App Style in both system appearances. Default is Stowaway; selection survives reopening. Judge warmth, contrast and scanning comfort.
- [ ] 32. Try Georgia, Palatino, Serif and Sans offline. Selected state is clear and the choice persists. Named faces may fall back on the device.
- [ ] 33. Select **Paper** and judge glare and ink/link contrast. Classic + Paper and Stowaway + Dark work independently.
- [ ] 34. At a recognizable deep paragraph, switch fonts, then sizes. The passage stays nearby; navigation/reopening retain it without marking Read merely from reflow.
- [ ] 35. Tap compact ✓/○ with normal use and VoiceOver. Its target is comfortable, changes only Read/Unread and never opens the chapter.
- [ ] 36. `↓ Not downloaded` clearly means unavailable text, not deletion/error. Its row cannot open; manual Read correction works.
- [ ] 37. Scan a naturally long story. Chapters dominate the initial viewport; header Story Actions reaches update/image/source/removal without scrolling the entire list. Check the separated Danger Zone and confirmation/cancellation.
- [ ] 38. At a large accessibility text size, font/style/theme choices, long titles and Done remain reachable; quieter reader chrome stays easy to use.

## Historical nine-font / two-group checks — superseded

Checks 39–45 describe the earlier nine-font/two-group candidate and are retained for history. For the current 26-font/five-group catalog, use checks 46–56. The earlier feedback froze the surrounding visual direction; it did not individually certify these checks. No historical unchecked item is converted to Passed.

- [ ] 39. Reading Appearance shows one current-font row. Open Reading Font, compare the two groups, select repeatedly, return with Done, and reopen. Check VoiceOver focus/selection and back/escape behavior.
- [ ] 40. Try all nine choices: Baskerville, Georgia, Palatino, Charter, Times New Roman, System Serif, System Sans, Avenir Next and Helvetica Neue. Confirm distinctness where expected and note any fallback or indistinguishable pair.
- [ ] 41. Compare the native own-font labels with actual reader prose. System Serif intentionally says **Preview in reader**; judge its actual prose there.
- [ ] 42. Confirm each selection survives reader close/reopen and app relaunch. Existing Georgia/Palatino/Serif/Sans preferences retain their meaning, and App Style/theme/size stay independent.
- [ ] 43. At a recognizable deep paragraph or gap, switch between a serif and Avenir Next/Helvetica Neue, then return. Verify passage preservation, navigation/reopening and no Read completion from reflow.
- [ ] 44. At maximum comfortable accessibility text size, scroll the full font list and reach Done. Check wrapped multiword labels, checkmarks and 44pt target comfort.
- [ ] 45. With the app already running and networking disabled, try every font and reopen local chapters. Note any missing/fallback font. This does not establish the deferred S2B Metro-free cold start.

## Expanded catalog and backdrop checks

At the catalog/dismissal commit, Owen reported preferring Stowaway to SpaceBattles in Safari; individual results for these checks were not supplied. The later aggregate phone sanity report is recorded above without inferring exhaustive coverage.

- [ ] 46. Scan all 26 choices across Bookish Serif, Sans Serif, Typewriter & Mono, Handwritten and Character & Decorative. Verify each visibly renders or falls back honestly; note any absent/indistinguishable family. Native labels should match reader character where supported; System Serif is previewed in the reader.
- [ ] 47. Compare representative traditional, sans, typewriter/mono and playful choices. Selected marks follow changes, the picker stays open, and rapid taps during restyle do not overwrite a later settled preference.
- [ ] 48. Change font, then dismiss via backdrop and reopen/relaunch. The applied font, size and theme persist independently of App Style.
- [ ] 49. At a recognizable deep paragraph/gap, compare Georgia → Avenir Next, Georgia → Menlo/American Typewriter and Georgia → Marker Felt/Noteworthy. Verify the same passage through return, navigation and reopening, with no Read completion merely from reflow. Do not repeat exhaustive locator checks for every font.
- [ ] 50. With the app already running offline, try the full catalog and reopen local chapters. Note any missing face/fallback; this is not S2B Metro-free cold-start evidence.
- [ ] 51. Tap the dimmed area outside Appearance: it closes. Outside Font: it returns to Appearance; another outside tap closes. Done/back/escape still work. Tap controls, labels and blank panel space and scroll inside: no accidental dismissal or preference reversal.
- [ ] 52. At large Dynamic Type and with VoiceOver, reach every group, the bottom font and Done. Check preview readability, wrapped labels, selected-state announcements, modal focus and outside-tap comfort.

## Partial reading-sheet checks

The previous font picker covered essentially the whole iPhone screen. Owen subsequently reported satisfactory partial-sheet phone sanity, including exposed real prose, on `69c5f5a51cefbcc1e34060b803c0860643c0b01f`. These detailed checks remain an unfilled per-item record; the aggregate report does not establish every conditional case. The current catalog is 26 choices in five groups.

- [ ] 53. Open Appearance, then Font. At ordinary text size each panel uses roughly the lower half of usable screen height, leaving real chapter prose visible. Compare several different fonts without closing the picker; after each restyle settles, the exposed passage visibly uses the selected font.
- [ ] 54. Scroll to the final font and scroll the parent controls on a small viewport. Done stays pinned and reachable. Scrolls/taps inside do not dismiss or interact with the reader; outside Font returns to Appearance and outside Appearance closes it. Applied choices survive dismissal/reopening.
- [ ] 55. Try larger Dynamic Type. Sheets may grow, but keep exposed reader space; headings, controls and the bottom font remain reachable without safe-area clipping. With VoiceOver, focus enters the sheet, selected states are announced and reader content remains outside modal navigation. Done/back/escape retain the existing hierarchy. The app's portrait lock is unchanged; landscape testing is synthetic only.
- [ ] 56. At a recognizable saved passage, compare representative serif/sans/mono/character fonts through the sheets, then dismiss, navigate and reopen. Confirm the same passage, no Read completion merely from reflow, normal reader interaction after closing, and already-running offline behavior. This is not S2B evidence.
