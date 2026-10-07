# I3 physical iPhone checklist — PENDING

**No I3 physical check is passed yet.** Owen must report results on the pushed `feat/read-state` candidate. Existing S0/S1/S2A/I0/I1/I2 acceptance stays historical; I2 is merged in PR #6. S2B remains deferred and full v0 incomplete. See [I3 design and host evidence](I3_Read_State.md).

Use the existing SDK 57 Expo Go/Metro setup and phone library. Preserve data: no uninstall, clear/reset/reseed, deliberate source mutation or corruption of normal files. Record candidate SHA, device/iOS/Expo Go versions, observed counts/state/errors and unexercised cases, without prose/raw pages/image bytes/screenshots in Git.

```powershell
git switch feat/read-state
npm.cmd start
```

## A. v4 → v5 preservation

- [ ] Eyes Open remains **34/34 text**; Normal Isn't Ordinary remains **25/25**.
- [ ] Aenys remains **38/38**, with prior **57 local / 1 omitted / 0 pending** image baseline and real local images intact. Report any actual difference; the old single omission was not visually located.
- [ ] The Lantern Cartographer remains **3/3**, with harbor intact and confined to the fixture.
- [ ] I1 attempt/complete-check timestamps, saved passages and font/theme preferences survive.
- [ ] All old entries start **Unread (“not previously marked read”)**. No completion history is guessed from old locators/downloads. Expected current totals before corrections: 34, 25, 38 and 3, if manifests are unchanged.
- [ ] Opening Library/Contents alone starts no source/update/image job and does not mutate Read/Unread.
- [ ] S1/S2A remain separate development diagnostics; S2A retains its isolated v1 behavior without automatic migration/repair.

## B. Manual Read/Unread

- [ ] Pick an Unread chapter and note the current unread count. Tap Mark Read; its text state and action change, Contents count decreases by one, and Library agrees.
- [ ] Leave/reopen Contents; Read persists. Mark Unread; state/count reverse without changing text/image totals or passage.
- [ ] Force-quit Expo Go and relaunch through Metro; the last completed correction persists without automatic source work.
- [ ] If a pending entry already exists naturally, correct it despite disabled Read/open action. It counts in current unread totals; body availability remains separate. Otherwise record unexercised, host-tested.
- [ ] If saved-unlisted downloaded entries exist naturally, correct one. Its own state persists while current unread count stays unchanged. Otherwise record unexercised, host-tested.
- [ ] Labels/state remain understandable without color; chapter-specific Mark Read/Unread controls are usable with VoiceOver/large text.

## C. Automatic completion

- [ ] Pick an Unread downloaded chapter. Opening/restoration alone leaves it Unread; returning without reading to the end does not complete it.
- [ ] Actually read/scroll to the end. Return to Contents: chapter is Read and current unread count decreased exactly once. Library agrees.
- [ ] Repeated bottom interaction does not cause duplicate/unstable counts; ordinary passage saving remains usable.
- [ ] For a genuinely one-screen chapter (including with smaller text if comfortable), opening alone leaves Unread. A deliberate interaction with its text at the end can mark Read without manufacturing a scroll requirement.
- [ ] Safe links, nested spoilers, text selection and font/theme controls remain usable. Link/spoiler-summary actions alone do not mark completion.

## D. Restored-at-end and layout safety — especially important

- [ ] Save a passage near the bottom, return to Contents and manually Mark Unread. Reopen: restoration near the end alone leaves it Unread.
- [ ] Change font/theme while restored near the end. Reflow alone leaves it Unread; background/reopen without reading does not manufacture completion.
- [ ] A fresh deliberate text/end interaction may then mark Read.
- [ ] On an image-bearing Aenys chapter, local image load/failure/geometry alone does not mark it Read. Do not corrupt good normal files to force a failure; record unavailable cases as unexercised.

## E. Immediate navigation and restart

- [ ] After reaching the end of an Unread chapter, immediately tap **Next**; prior chapter remains Read. Next chapter has its own state and normal passage restoration.
- [ ] Repeat using **Contents** immediately, then **Previous** where available; completion persists and navigation remains within the story.
- [ ] Force-quit/relaunch through Metro after completed end reading; committed Read state, locator, preferences and local images survive.
- [ ] If a real local write failure occurs, record the local error and retained state/passage. Retry leaving or manually correct; no network job should start. Do not fill/corrupt storage to manufacture this case. Otherwise host-tested only.

## F. Already-running offline progress — not S2B

- [ ] With the Expo Go project **already running**, disable Wi-Fi/cellular. Manually toggle an entry; Contents/Library counts update locally.
- [ ] Open a downloaded Unread chapter and read to the end; completion persists after returning to Contents/Library.
- [ ] Local text and existing Aenys images still render; Previous/Next and saved passage remain usable. No source request/action is needed for progress writes.
- [ ] Restore networking after this check. No independently installed/Metro-free cold start is claimed.

## G. Deliberate I1 regression

- [ ] Note a mix of Read/Unread entries and deliberately Check for Updates on an existing story. Stop on blocked/login/challenge; no cookies/auth/proxy/bypass.
- [ ] Unchanged COMPLETE check preserves flags/counts, text/images/passages and coherent timestamps; no duplicate entries appear.
- [ ] During update/cancellation, manual corrections and reader/Library/Resume/native Back/swipe exits stay disabled until operation settlement and final refresh. Cancel stays available.
- [ ] If a natural new/inserted chapter exists, it starts Unread, including before text completes. Otherwise explicitly record natural-new-entry unexercised.
- [ ] Natural rename/reorder/removal/reappearance, if available: preserve flags by identity; removed entries leave current totals, downloaded saved entries expose their flags, reappearing entries restore prior flags. Otherwise host-tested/unexercised; do not fabricate source changes.

## H. Deliberate I2 regression

- [ ] Existing Aenys local images render at the expected positions; text/image counts and passage remain intact.
- [ ] Deliberate Download/Retry Images preserves mixed Read/Unread state. Opening screens starts no automatic image work.
- [ ] During image work/cancellation, read-state corrections and navigation stay blocked through settlement/final refresh; usable afterward.
- [ ] If natural saved-unlisted local-image content is available, reading/correction retains its image and state; otherwise unexercised, host-tested.

**Acceptance remains pending until Owen reports results.** Conditional unavailable cases retain their explicit limits; host SQLite/DOM/UI results are not physical-device or wire inspection. No PR creation/merge, deletion, S2B or next milestone follows automatically.
