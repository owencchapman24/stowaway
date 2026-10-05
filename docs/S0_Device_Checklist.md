# S0 iPhone check — core reader acceptance passed

**Test results recorded: 5 October 2026, America/New_York. Tester: Owen. Device: iPhone 17 Pro.** The previously reported **iOS 26.7.1 remains tentative**; the actual iOS version and Expo Go version/SDK were not separately confirmed in this report.

Evidence below is **Owen's user-reported physical-device testing**, not an agent-performed iPhone run or automated certification. Owen also reports screenshots confirming the reader UI, nested spoilers, local image, font-size changes, light/dark themes, contents and chapter navigation; those screenshots were not independently inspected in this documentation session. Checked items record only the behaviors Owen supplied. Unchecked items remain pending.

Install or update the current **App Store Expo Go (SDK 57)** and sign it into the same Expo account used by Expo CLI. Follow the Windows commands in [README](../README.md), including `npx.cmd expo login`. Apple Developer membership and `eas go` are not required for this run ([Expo's 3 September update](https://expo.dev/changelog/expo-go-57-login)). Keep Metro running for this Expo Go functional check. Initial bundle/asset delivery from Metro is development setup; the chapter WebView itself must never load remote content.

## Passed — Owen's physical-device results

- [x] Stowaway runs through Expo Go on the physical iPhone.
- [x] Contents loads with exactly one synthetic story and three chapters.
- [x] Resume Reading appears once reading progress exists.
- [x] Chapter 1 renders long-form text, headings, emphasis, blockquote, lists and other rich formatting correctly.
- [x] The bundled harbor raster appears.
- [x] Nested spoilers expand and collapse correctly, including the **“Remember the copper cup on the mossy shelf”** fixture.
- [x] Light and dark reading themes work.
- [x] Font-size controls work.
- [x] With both spoiler ancestors open around the copper-cup passage, changing font size preserves the same passage.
- [x] Return to Contents and use Resume Reading: the same passage returns with spoiler ancestors opened as needed.
- [x] Force-quit Expo Go and reopen Stowaway with Metro available: the last completed saved passage returns.
- [x] Previous / Contents / Next navigation renders and behaves appropriately.
- [x] Deliberately tap **Example Domain**: the system browser opens only after the tap.
- [x] Disable network access with an already-open local chapter: the chapter remains readable.
- [x] General reader interaction during these tests has no blocking defect reported by Owen.

## Pending — not separately reported or directly inspected

- [ ] Confirm the actual iOS and Expo Go versions/SDK. The successful Expo Go run is recorded above; an exact client version is not inferred.
- [ ] Repeat multiple launches specifically to check that reseeding creates no duplicates. The observed one-story/three-chapter contents and saved-passage reopen passed; this repeat test is not separately reported.
- [ ] Specifically verify basic tables, scene breaks and text selection. General rich formatting passed; these individual behaviors are not separately reported.
- [ ] VoiceOver announces and operates spoiler summaries and labeled native controls.
- [ ] Repeat same-passage restoration specifically at the 14 and 32 point limits. Font adjustment/restoration passed; the exact tested sizes are not reported.
- [ ] After a saved passage exists, reopen and immediately leave without scrolling. Loading/restoration does not overwrite the saved passage with the chapter top.
- [ ] Reopen, change text size, then leave without scrolling. Reflow does not overwrite the saved passage with the chapter top.
- [ ] Background and return without force-quitting, specifically checking the saved passage. Force-quit/reopen passed separately above.
- [ ] Specifically verify that each of the three chapters retains its own saved passage. Basic navigation and Resume Reading passed above.
- [ ] Visually verify that the encoded active link is plain text and the remote image is an explicit placeholder. The deliberate safe-link browser action passed separately above.
- [ ] Inspect the actual iOS WebView with Safari Web Inspector (requires a Mac with the device connected; not available from this Windows session) or equivalent device diagnostics: `window.__STOWAWAY_SOURCE_SCRIPT_RAN__` is absent, no source alert occurs, and the reader Network panel shows no HTTP(S) content requests. Use the harmless synthetic fixture only. A host DOM test or Hermes export does not establish this result.

## S2 — separate and pending

- [ ] Independently installed bundled Stowaway preview, Metro unavailable, airplane mode, force-quit and cold start.
- [ ] Native text-transaction and image-save interruption/recovery: old text/progress survive, incomplete images become placeholders, and retries create no duplicate records.

No EAS build, purchase or submission was performed in this task. Expo Go may need Metro to relaunch the project. Reading an already-open chapter after network loss does not prove an independently installed Stowaway build or S2 cold start.

## Result

**Core S0 physical reader acceptance passed, as reported by Owen on 5 October 2026.** The main value proposition was demonstrated on his iPhone: local synthetic chapters render, persist and resume, preserve the passage through typography changes, support nested spoilers and local imagery, and remain readable after network loss while already open. No blocking reader defect was reported during these tests.

This result covers the reported functional behaviors, not every device diagnostic in the October audit. VoiceOver, direct source-script/network inspection and the other unchecked cases remain explicitly unverified. Automated fixture/storage/bridge tests are separate evidence and do not turn these pending device checks into passes. **S2 remains separate.** Subsequent core S1 physical acceptance is recorded in the [S1 access-spike notes](S1_Access_Spike.md); it does not mark these remaining S0 diagnostics as passed.
