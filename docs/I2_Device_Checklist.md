# I2 source images: physical iPhone checklist

**Implementation candidate only. Every I2 physical check is PENDING until Owen reports it.** S0/S1/S2A/I0/I1 remain accepted; I0 and I1 are merged in PR #4/#5. S2B is deferred and full v0 is incomplete. Host tests/export do not prove native SQLite/files, WKWebView decoding, wire policy or phone usability.

Use the existing normal phone library. Do not uninstall Expo Go, clear app data, reset/reseed stories, fabricate source mutations or manually corrupt normal files. Record date, implementation SHA (`git rev-parse HEAD`), phone/iOS/Expo Go versions, story/chapter titles and slot/count metadata only. Do not commit prose, raw pages, downloaded images or screenshots.

```powershell
git switch feat/source-images
npm.cmd start
```

Keep the usual SDK 57 Expo Go/Metro setup and same CLI/Expo account. Source actions are deliberate, unauthenticated and personal. Stop on blocked/login/challenge results; no cookies, sessions, proxy or bypass. The source-image action can make one body request per legacy downloaded/current chapter, then eligible image requests, with the shared >=2-second request spacing. Ordinary Check for Updates does not perform this legacy scan.

## A. Existing v3 library -> v4, no reset

- [ ] Eyes Open survives at 34/34 text chapters.
- [ ] Normal Isn't Ordinary survives at 25/25 text chapters.
- [ ] The Lantern Cartographer survives at 3/3, and its harbor still renders only in the fixture.
- [ ] Saved passages, font/theme preferences and I1 attempt/complete-check timestamps survive.
- [ ] Opening Library/Story starts no image discovery/download, update check or automatic resume.
- [ ] Existing real downloaded chapters initially report not scanned, independently of complete text counts.
- [ ] Fixture has no Download/Retry Images or Check for Updates action; S1/S2A remain separate diagnostics.

## B. Deliberate discovery in a naturally suitable story

- [ ] Use an already selected real story with a natural eligible same-origin image. If neither existing story has one, Owen selects another public story he actually wants to read. Record story/chapter title and slot metadata.
- [ ] Tap Download Images explicitly; observe scanning/downloading progress and Cancel.
- [ ] Existing saved prose and passage remain usable; discovery does not replace an old body merely to add images.
- [ ] Summary distinguishes local, omitted and pending. Text counts remain text counts.
- [ ] If naturally encountered, saved-text mismatch leaves old prose/passages readable and records image unavailability without guessed positions. Otherwise mark this physical case unexercised; deterministic tests cover it.

## C. A real accepted local image

- [ ] At least one eligible image completes locally, appears at the expected chapter position and has usable alt/placeholder behavior.
- [ ] Text remains readable; no fixture harbor appears in a real story.
- [ ] Leave/reopen without another source action; valid local images are reused.
- [ ] Retry Images deliberately rechecks local integrity without redundantly downloading valid files (UI evidence alone is not packet proof).

## D. Offline disposable-render regeneration, already-running project

- [ ] After accepting a real local image, leave the reader using Contents so its disposable render can be discarded normally.
- [ ] Disable Wi-Fi/cellular while the Expo Go project is already running.
- [ ] Reopen that downloaded chapter; text and accepted image render from local storage, with saved passage/preferences retained.
- [ ] Navigate other downloaded chapters offline; missing text stays clearly unavailable.

This is **not S2B**: no independent installation, Metro-free cold start or first launch in airplane mode is claimed. Direct network inspection is a separate evidence level.

## E. Cancellation/relaunch/explicit retry, if naturally practical

- [ ] With enough eligible images, cancel partway. Completed local refs remain, unfinished work remains retryable, and text remains complete/readable.
- [ ] Force-quit Expo Go via the iOS app switcher and relaunch through Metro. Do not use Fast Refresh as a process kill.
- [ ] Opening Library/Story starts no automatic image resume/check.
- [ ] Explicit Download/Retry Images finishes eligible pending work without duplicate logical slots or re-downloading valid existing files.
- [ ] Counts remain coherent after cancellation and retry.

If only one image exists or the phase is too short to interrupt, record cancellation/retry as physically unexercised. Do not fabricate a live mutation or claim an injected host failure is a phone kill.

## F. Natural placeholder cases

- [ ] Where naturally available, external/unsupported/animated/oversized/failed images remain explicit placeholders beside readable text.
- [ ] Omissions are counted as omitted, with no false all-images-downloaded label.

If no suitable case exists, record it as physically unexercised and use deterministic coverage. Do not navigate new external sites for testing.

## G. Missing/corrupt files: host-tested only in I2

- [ ] Record this as **not physically exercised against normal source-image files** unless a later narrowly isolated diagnostic is explicitly authorized.

I2 provides no destructive normal-library diagnostic. Do not edit/delete/corrupt its files. Host tests exercise staging corruption, missing/corrupt/digest/format/budget fallback and fresh-file repair. S2A's historical physical recovery evidence remains separate, synthetic and isolated.

## H. Reader/update regression and operation handoff

- [ ] Passage restoration around image blocks remains usable across leave/reopen and image availability changes. Exact pixel restoration across changed image geometry is not promised.
- [ ] Font size/theme, selection, nested spoilers and safe links remain usable.
- [ ] Previous/Next and Contents/Library stay within the story. Naturally saved-unlisted chapters retain local images; if unavailable, leave this conditional case unexercised.
- [ ] During Download/Retry Images, Read/Library/Resume/Check/other image action are blocked; Cancel remains available.
- [ ] Native Back/swipe-back cannot leave Contents during the operation.
- [ ] After Cancel, navigation stays blocked until operation settlement and final local refresh, then ordinary controls/gestures return.
- [ ] With networking restored, deliberate I1 Check for Updates still works and preserves passages/text/image references. It does not scan historical bodies for images.
- [ ] No automatic image/update/background work occurs on opening screens/relaunch.

Resume Download, naturally new chapters, removal/reappearance, mismatch and unsupported images are conditional physical cases. Mark unavailable cases **unexercised**, not passed. New import/update image extraction, current-only work, ownership, slot identity and body/hash preservation also have deterministic evidence.

## I. Aenys MIME compatibility retest

Owen's first run on `[ASOIAF SI] Aenys, King of Dreams` was **38/38 text**, **58 slots**, initially **50 omitted / 8 pending**, then **0 local / 58 omitted / 0 pending**, with all eight downloads rejected as `content-type-mismatch`. Readable prose and correct placeholders were reported. **Real-image acceptance remains pending.**

- [ ] Pull the MIME-fix commit on `feat/source-images`, run `npm.cmd ci`, restart Metro and load that implementation in the existing Expo Go project. Preserve the normal phone library; do not reinstall, clear data, reset, delete or re-import Aenys.
- [ ] Open the already imported Aenys Contents. Confirm **38/38 text** and the existing **58 omitted / 0 local / 0 pending** image state, plus **8 previously rejected images can be retried** and **Retry Images**. Opening alone starts no source work.
- [ ] Tap **Retry Images** once. This uses the existing eight slot/source mappings; no text-body discovery or Check for Updates is needed. Record final local/omitted/pending counts and any typed failure. The other 50 omissions remain untouched. If all eight responses still supply accepted raster bytes with compatible MIME, expect **8 local / 50 omitted / 0 pending**; record actual results rather than assuming this outcome.
- [ ] Record the bounded **Image MIME (dev)** lines for those slots: chapter ID/slot, normalized received MIME, detected PNG/JPEG/WebP format and validated/rejected status. `validated` is not a persistence claim; compare local counts. For a remaining mismatch, report received MIME and detected format. Do not capture bytes, raw headers/pages, credentials or prose. Stop on blocked/login/challenge results; do not bypass them.
- [ ] Open a chapter containing a newly local image. Confirm it appears at the expected placeholder block, surrounding prose remains readable, no fixture image appears, and the saved passage/font/theme remain usable. Text stays **38/38**.
- [ ] Leave/reopen without another source action and confirm local reuse. Then leave via Contents, disable Wi-Fi/cellular while the project is already running, and reopen that chapter to check local image/text rendering and passage restoration. This does not establish S2B or wire-level behavior.
- [ ] Report the implementation SHA, actual counts, MIME/format metadata, image rendering and already-running offline result. Leave every unexercised check pending; do not infer full I2 acceptance from a MIME fix.

**Stop after recording observations for Owen. I2 acceptance, PR creation/merge and the next milestone require Owen's subsequent instruction. S2B remains deferred.**
