# UI/UX overhaul — iPhone review

**Status: physical UI acceptance pending. Nothing below is marked passed.** Use `feat/ui-overhaul` with the existing Expo Go/Metro library. Record the tested commit, iPhone/iOS/Expo Go versions, system text size and any failures. Historical S0/S1/S2A/I0–I4 and pre-UI acceptance retain their original evidence boundaries. S2B remains deferred; already-running offline reading is not Metro-free cold-start proof.

Do not reset the library or damage files to manufacture a case. Mark unavailable natural cases **Not exercised**. Use only selected public stories and deliberate existing source actions.

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

Report each as Pass / Fail / Not exercised, with a brief description for failures. No special physical storage-failure experiment is required for the management wording fix. Native keyboard, safe areas, Dynamic Type, VoiceOver, WKWebView geometry and subjective reading comfort require this review; deterministic tests and web previews do not certify them. Physical review precedes PR creation.
