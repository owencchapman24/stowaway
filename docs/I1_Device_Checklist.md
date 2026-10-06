# I1 physical iPhone checklist — core acceptance passed

**CORE I1 PHYSICAL ACCEPTANCE PASSED.** Acceptance recorded **6 October 2026, America/New_York**, from Owen's supplied physical-iPhone report for implementation **0f3c9e756dd7f2440d3b1da9760ae5b1247922ae** on `feat/manual-update-reconciliation`. Testing used the existing normal library through Expo Go/Metro. This is user-reported evidence, not an agent-operated phone run or independent device/wire inspection. The previously reported device was an iPhone 17 Pro; exact iOS/Expo Go versions were not freshly confirmed.

**Natural live-source mutation cases were unavailable and remain physically unexercised; deterministic automated tests cover them.** S0/S1/S2A/I0 remain accepted, I0 is merged in PR #4, **S2B remains deferred and full v0 is incomplete**. See [I1 implementation, validation and acceptance](I1_Manual_Updates.md). Historical I0 evidence is unchanged.

## A. Physical v2 → v3 migration/preservation — reported passed

- [x] Existing Library before I1: Eyes Open (Pokemon Fanfic) **34/34**, Normal Isn't Ordinary [Pokemon SI] **25/25**, The Lantern Cartographer **3/3**.
- [x] Opening I1 without resetting storage retained all three stories at the same counts.
- [x] Existing real downloaded chapters opened normally; saved passage restoration and font/theme preferences remained usable.
- [x] Synthetic fixture remained intact; real stories did not gain its harbor asset.
- [x] S1/S2A remained development-only diagnostics.

This records physical library preservation, separate from host-SQLite migration tests. A fresh fixture harbor-image display test was not separately supplied.

## B. Deliberate-only updates / fixture exclusion — reported passed

- [x] Opening Library did not start source work; opening a real story did not start Check for Updates.
- [x] Check for Updates appeared on real imported SpaceBattles stories.
- [x] The Lantern Cartographer had no Check for Updates action.
- [x] Before a deliberate check, no update timestamps were present.

## C. First manual COMPLETE unchanged check — reported passed

Story: **Normal Isn't Ordinary [Pokemon SI]**.

- [x] Deliberate Check for Updates completed with **Check finished. / Up to date.**
- [x] Story remained **25/25**; chapter list stayed coherent, no duplicate story/visible entries appeared and no pending/Resume state appeared.
- [x] Separate Last update attempt / Last complete check were recorded, approximately **10/6/2026, 1:00:59 AM** / **1:01:03 AM** as displayed on the phone.

## D. Repeated unchanged check / idempotency — reported passed

- [x] Owen deliberately checked the same story again; result remained **Up to date**, **25/25**.
- [x] Attempt / complete-check times advanced to approximately **10/6/2026, 1:02:09 AM** / **1:02:14 AM**.
- [x] No duplicate story/entries, pending text/Resume state or unexpected visible title/order change appeared.

This is physical idempotency at the UI/persistent-state level. Displayed timestamps establish sequence, not API/wire timing. No packet-level proof of zero old-body requests is claimed; deterministic injected-transport tests establish missing-only behavior.

## E. Cancellation before successful reconciliation — reported passed

Story: **Eyes Open (Pokemon Fanfic)**.

- [x] Owen deliberately started Check for Updates and cancelled quickly during the manifest-check phase.
- [x] Story remained **34/34** with intact Primary Threadmarks.
- [x] Last update attempt showed approximately **10/6/2026, 1:03:12 AM**; no Last complete check appeared.
- [x] UI reported **Cancelled. Committed text is retained. / Prior primary contents retained; no complete update committed.**

This demonstrates prior authoritative contents retained with no false successful-check state. The exact native transaction instruction where cancellation arrived is not inferred.

## F. Real force-quit / Metro relaunch after cancellation — reported passed

- [x] Owen force-quit Expo Go through the iOS app switcher and relaunched Stowaway through Metro.
- [x] Opening Eyes Open without tapping Check retained **34/34**, its **1:03:12 AM** attempt timestamp and no complete-check timestamp.
- [x] No source check/download restarted automatically; existing downloaded chapter text opened/read normally.

## G. Explicit retry after cancellation — reported passed

- [x] Owen deliberately tapped Check for Updates again and allowed it to complete.
- [x] Eyes Open reported **Up to date**, retained **34/34**, and showed coherent contents without duplicate entries.
- [x] Last attempt advanced to approximately **10/6/2026, 1:06:07 AM**; Last complete check appeared at approximately **1:06:13 AM**.

The physically passed sequence is cancel → real force-quit/relaunch → no automatic retry → deliberate retry → successful COMPLETE check. This was **Check for Updates retry**, not Resume Download of missing/new bodies.

## H. Reader regression after checks — reported passed

- [x] Saved passage restoration still worked.
- [x] Previous/Next stayed within the selected story.
- [x] Typography/theme changes and leave/reopen restoration still worked.

No natural rename/reorder occurred; current-source order after a mutation remains automated evidence rather than a new physical mutation pass.

## I. Already-running network-disabled text reading — reported passed

- [x] With the Expo Go project already running, Owen disabled networking and read/navigated downloaded text successfully.

This is **NOT S2B**: no independent installation, Metro-free launch, first launch in airplane mode or standalone cold-start acceptance is claimed.

## Conditional natural-source cases — NOT EXERCISED

Each case below is **NOT EXERCISED — no natural live source mutation was available**:

- [ ] Newly added primary chapter / append or mid-list insertion.
- [ ] Naturally removed primary entry and the physical **Saved chapters no longer listed** section/read/navigation path.
- [ ] Natural later reappearance, including body/locator reuse and restored current membership.
- [ ] Suitable natural rename/reorder and corresponding reader title/order change.

Saved-unlisted physical reading remains pending as a conditional live-source observation. No source mutation was fabricated. Host-SQLite/source/UI tests separately cover append, mid-list insertion, rename/reorder, removal, saved-unlisted behavior, reappearance, pending removal/reappearance, current navigation/order and body/locator preservation; automated results are not translated into physical live-source passes.

## Not separately supplied / deferred

- [ ] I1 new-body download cancellation/restart and explicit Resume Download: no new/pending text phase occurred in the supplied unchanged checks. I0's historical missing-body resume pass remains separate.
- [ ] Background/leave cancellation, route/focus late-result controls and ordinary duplicate Add Story regression were not separately reported in this I1 physical run.
- [ ] Fresh harbor-image display, source-image placeholder/safe-link smoke, VoiceOver/direct WebView script/network diagnostics and actual iOS/Expo Go versions were not newly supplied.
- [ ] Native request headers/cookies/cache, packet-level missing-only requests and exact SQL cancellation instruction remain unverified.
- [ ] **S2B deferred:** independently installed app, bundled JS/assets, no Expo Go/Metro, offline cold launch and offline force-quit/relaunch.

These qualifications do not revoke core I1 acceptance. Global FK-validation performance and S1 concurrent diagnostic-budget accounting remain deferred technical follow-ups, unchanged by this acceptance pass.

The demonstrated user loop is: open existing imported story → no automatic source work → deliberately Check for Updates → COMPLETE unchanged manifest committed → Up to date → repeat idempotently → cancel before successful reconciliation → preserve prior contents → survive force-quit/relaunch → no auto-resume → explicitly retry → complete successfully → preserve reader position/navigation/offline text.

## Reproducing the accepted loop

Future reproduction is regression work, not unfinished core acceptance. Stay on the accepted I1 branch, use SDK 57 Expo Go/Metro with the same CLI/Expo account and the existing phone library:

```powershell
git switch feat/manual-update-reconciliation
npm.cmd start
```

Use only the already selected public stories, deliberate actions and ordinary unauthenticated access. Preserve normal storage; do not uninstall/clear app data, reset/reseed real stories or fabricate source changes. Stop on blocked/login/challenge; no copied sessions, proxies or bypasses. Record actual observed results and unexercised conditional cases without committing prose/raw pages/screenshots.

**CORE I1 PHYSICAL ACCEPTANCE PASSED. Natural live-source mutation cases remain physically unexercised. S2B deferred; full v0 incomplete.** Acceptance follow-up authorizes documentation/status cleanup, validation, a separate commit/push and PR preparation against main. No PR merge or next product slice is authorized.

## Post-review handoff fix — focused physical retest PASSED

**POST-REVIEW I1 NAVIGATION HANDOFF PHYSICAL RETEST PASSED.** Recorded **6 October 2026, America/New_York**, from Owen's supplied physical-iPhone report for fix commit **22c761dbd064c376bb610a3cbb72de4820abb642** on `feat/manual-update-reconciliation`, through Expo Go/Metro. This is user-reported evidence, not an agent-operated phone run or independent device/wire inspection. **CORE I1 PHYSICAL ACCEPTANCE PASSED** and the earlier physical passes above remain unchanged.

The adversarial review of PR #5 found a reader navigation race when cancellation overlapped an unavoidable reconciliation COMMIT. The targeted fix blocks Read, Library, Resume and native Back/gesture removal until the update settles and the final SQL refresh completes. Cancel remains available. Deterministic real-SQLite tests exercise the exact held-COMMIT mutation window, with native navigation/WebView surfaces mocked; the physical observations below establish the reported native control behavior.

- [x] Ordinary downloaded-chapter reading and saved passage restoration still worked.
- [x] Previous / Next / Contents / Library navigation worked normally when no update was active.
- [x] During Check for Updates, Read and Library navigation were blocked.
- [x] During Check for Updates, native Back / swipe-back could not leave Story Contents.
- [x] Cancel remained available during the operation.
- [x] After Cancel, navigation remained blocked until the operation settled.
- [x] After settlement, normal navigation became available again; opening a downloaded chapter showed coherent navigation and restored passage.
- [x] A normal Check for Updates completed afterward, and ordinary navigation / gestures were restored normally.

- [ ] **Resume Download — NOT PHYSICALLY EXERCISED:** the tested real stories were fully downloaded and did not display the control. Deterministic tests cover its disabled-during-operation behavior; this report does not establish a physical Resume pass.
- [ ] **Natural live-source mutations — NOT PHYSICALLY EXERCISED:** new chapter, rename/reorder, removal, saved-unlisted reading and reappearance. Their conditional status above is unchanged.

The exact post-guard/pre-COMMIT interleaving and delayed authoritative SQLite refresh remain deterministic automated evidence, not separately observed native transaction/read timing. The retest does not establish S2B, native wire behavior or new source authorization. S2B remains deferred and full v0 is incomplete. PR #5 remains unmerged; no next milestone or merge is authorized.
