# I1 physical iPhone checklist — pending Owen

**NOT physically accepted. All checks below are pending.** Candidate on `feat/manual-update-reconciliation`, based on merged I0 PR #4 at `181feec`. S0/S1/S2A/I0 remain accepted; **S2B deferred, full v0 incomplete**. Use [I1 design/validation](I1_Manual_Updates.md) for transaction/source boundaries. No agent-operated phone run or native wire inspection is claimed.

Run this candidate through SDK 57 Expo Go/Metro on the existing phone library. Do not uninstall Expo Go, clear app data, reset normal storage, re-seed real stories or fabricate source mutations. Confirm the CLI and Expo Go use the same account; keep Metro available for reload/relaunch. On Windows:

```powershell
git switch feat/manual-update-reconciliation
npm.cmd start
```

Record candidate commit, date, device, actual iOS and Expo Go versions, current counts and any typed failure. Use only already selected public stories, ordinary unauthenticated access and deliberate taps. Stop on blocked/login/challenge; no repeated probes, session copying, proxy or bypass. Do not send prose, raw pages or screenshots into Git.

## A. Existing v2 library → v3 preservation

- [ ] Before running the candidate, record existing passage/preferences and counts for Eyes Open, Normal Isn't Ordinary and The Lantern Cartographer. Historically accepted counts were 34/34, 25/25 and 3/3; source counts may naturally change later.
- [ ] Open the candidate without resetting storage. All three stories remain, with their existing downloaded text and current counts; no duplicate rows/story appear.
- [ ] Open previously downloaded real chapters; existing passages and font/theme preferences still work.
- [ ] The Lantern Cartographer remains 3/3, with saved passage/preferences and the bundled harbor image; real stories do not gain that image.
- [ ] S1/S2A remain Development diagnostics. Do not initialize/reset/migrate S2A merely to test I1; its dedicated v1 inspection rules still apply.

## B. Opening has no automatic source work

- [ ] Open Library and a real Story. No update/download starts from opening or returning; Check for Updates is deliberate.
- [ ] The synthetic fixture has no Check for Updates action.

## C. Deliberate complete check and repetition

- [ ] Open [Normal Isn't Ordinary](https://forums.spacebattles.com/threads/normal-isnt-ordinary-pokemon-si.1234421/) or [Eyes Open](https://forums.spacebattles.com/threads/eyes-open-pokemon-fanfic.1129205/), then tap Check for Updates once with networking enabled.
- [ ] Observe checking/reconciling status and a successful COMPLETE check. Compare current primary count/order/titles against the ordinary site primary Threadmarks, without changing site content.
- [ ] If source is unchanged and all current text exists, result is Up to date; counts remain coherent, no duplicate story/entry appears and saved passage is preserved.
- [ ] Last attempt and last complete check display; a second deliberate unchanged check remains idempotent.
- [ ] Reopening by itself starts no further check. Ordinary repeat Add Story/import remains complete/missing-only resume, with no implicit update.

UI observations do not independently prove request headers/cookies/spacing or that an old body was never requested. Missing-only logic has deterministic injected-transport evidence; native wire-level inspection remains separate.

## D. Naturally new primary chapter — conditional

- [ ] If a selected real story has naturally gained a primary chapter, record that fact/count/post ID, tap Check for Updates and observe only current missing/new text completing; count/order update coherently.
- [ ] Open the new downloaded chapter and an old saved passage. Existing reading position/preferences survive.
- [ ] Repeat the complete check: no duplicate entries or unnecessary text download is visible.

If no new chapter exists, report **not exercised — no natural source change**. Do not fabricate a live mutation. Host fixtures cover deterministic append/middle insertion/rename/reorder/removal/reappearance.

## E. Cancel, force-quit/relaunch and explicit Resume — where practical

- [ ] During a practical manifest check, tap Cancel or background/leave. The previous authoritative manifest remains if reconciliation did not commit; successful-check time does not advance for an incomplete check. Cancellation after unavoidable COMMIT may retain it.
- [ ] If naturally missing/new text exists, cancel during body download. New current manifest/success time remain; completed text is retained; missing current entries say Not downloaded and Resume is available.
- [ ] Force-quit Expo Go via the app switcher, relaunch through Metro, inspect Library/Contents. Persisted current/saved/pending state is coherent; no automatic request/resume starts.
- [ ] Tap Resume Download explicitly where pending bodies exist. It completes current missing work; removed entries are not queued and existing passage remains.
- [ ] Open Resume, then navigate away/change the selected story. Late progress/results/actions stay with the original story and do not appear on another story.

Record which boundary was actually reached. An unchanged complete library may have no body phase to cancel; report it unexercised instead of deleting downloads or resetting data. Background/reload, injected rollback and real force-quit are different evidence.

## F. Saved chapters no longer listed — conditional

- [ ] Only if a **natural complete source removal** exists, confirm current total/downloaded excludes it and downloaded removed text appears separately under Saved chapters no longer listed.
- [ ] Open that saved chapter; text/position remain usable, Contents returns to the same story and Previous/Next are disabled.
- [ ] If it naturally reappears later, check again: same identity/body/locator is reused, with current title/order/count restored.

If no natural removal/reappearance exists, report **not exercised**. No local mutation UI or fabricated live source case is supplied. Host SQLite and screen/reader fixtures provide deterministic coverage; they are not physical live-removal evidence.

## G. Reader regression after a check

- [ ] Current primary titles and Previous/Next follow current source order and remain within the selected story.
- [ ] An old passage restores after typography/theme changes, leave/reopen and force-quit/relaunch through Metro.
- [ ] Source images remain omission placeholders; fixture harbor remains local and isolated. Safe source links open only on deliberate action.

## H. Already-running network-disabled text reading

- [ ] With the Expo Go project already running, disable Wi-Fi/cellular and read downloaded real text, navigate between downloaded chapters and return to Contents. Saved passages/preferences remain usable.
- [ ] Report any deliberately attempted offline update failure as a typed failure retaining prior manifest/text; success time must not falsely advance.

This is **not S2B**. Independent installation, no-Metro cold start and first launch in airplane mode remain deferred. VoiceOver/direct WebView script/network diagnostics and native wire inspection retain their previous unverified status unless separately observed and reported.

After testing, Owen reports actual passes, failures and unexercised conditional cases. Physical acceptance, PR creation/merge and the next milestone require a subsequent instruction; this candidate does not authorize them automatically.
