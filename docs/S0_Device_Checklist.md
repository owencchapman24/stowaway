# S0 iPhone check — pending

Target reported by Owen: **iPhone 17 Pro**, **iOS 26.7.1 (tentative; confirm in Settings → General → About)**. Expo Go was not installed when implementation began. No physical-device checks have been performed by this session.

Follow the SDK 57 client prerequisite and Windows commands in [README](../README.md). Keep Metro running for this Expo Go functional check. Initial bundle/asset delivery from Metro is development setup; the chapter WebView itself must never load remote content.

Record the actual iOS version, Expo Go version/SDK, date, and pass/fail details below. Do not mark S0 accepted until Owen supplies the result.

- [ ] Matching SDK 57 Expo Go opens Stowaway from the QR code on Windows.
- [ ] Contents has exactly one story and three chapters after reopening repeatedly.
- [ ] Chapter 1 scrolls for several screens. Headings, emphasis, quote, list, table, scene break and selectable text work.
- [ ] The blue harbor raster appears. Both spoiler levels open/close. VoiceOver announces and operates summaries and labeled native controls.
- [ ] Scroll the nested spoiler to **“Remember the copper cup on the mossy shelf”**, pause for at least one second, change A+ / A−, and switch light/dark. The same paragraph stays visible with the necessary spoilers open.
- [ ] Return to contents and resume. The same paragraph and expanded ancestors return. Repeat at 14 and 32 point text sizes.
- [ ] After a saved passage exists, reopen and immediately leave without scrolling. Loading/restoration does not overwrite the saved passage with the chapter top.
- [ ] Reopen, change text size, then leave without scrolling. Reflow does not overwrite the saved passage with the chapter top.
- [ ] Background Expo Go, return, then force-quit/reopen with Metro available. The last completed save returns. An abrupt kill is allowed to lose only unsaved/debounced movement.
- [ ] Previous/Next/Contents navigate between one active chapter at a time. Each chapter retains its own passage.
- [ ] Deliberately tap **Example Domain**. Only that action opens the system browser. The encoded active link is plain text and the remote image is an explicit placeholder.
- [ ] Inspect the actual iOS WebView with Safari Web Inspector (requires a Mac with the device connected; not available from this Windows session) or equivalent device diagnostics: `window.__STOWAWAY_SOURCE_SCRIPT_RAN__` is absent, no source alert occurs, and the reader Network panel shows no HTTP(S) content requests. Use the harmless synthetic fixture only. A host DOM test or Hermes export does not establish this result.
- [ ] After initial delivery, an already open chapter remains readable with the phone's network disabled. Expo Go may need Metro to relaunch the project; that is separate from SQLite's stored chapter data.

**S2, not inferred here:** independently installed bundled preview, Metro unavailable, airplane mode, force-quit and cold start; native transaction/image-save interruption and recovery. No EAS build, purchase or submission has been performed.

Result supplied by Owen: **pending**.
