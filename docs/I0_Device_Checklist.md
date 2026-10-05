# I0 physical iPhone checklist — core acceptance passed

**CORE I0 PHYSICAL ACCEPTANCE PASSED.** Acceptance recorded **5 October 2026, America/New_York**, from Owen's supplied physical-iPhone report for implementation **d09ff85518a08fa002c28861666125643e047753** on `feat/spacebattles-import-slice`. Testing used Expo Go/Metro. These are user-reported results, not an agent-operated iPhone run or independent device/packet inspection. Exact iOS and Expo Go versions remain unconfirmed; the previously reported device was an iPhone 17 Pro.

**S0, S1, S2A and I0 accepted; S2B deferred. Full v0 is not complete.** This does not prove independently installed Stowaway, Metro-free cold start or first launch in airplane mode. See [implementation, validation and limits](I0_Real_Story_Import.md).

## Physical v1 → v2 migration — reported passed

- [x] Actual normal v1 database migrated to v2 on Owen's iPhone **without reset**.
- [x] The Lantern Cartographer remained present with exactly **3/3** downloaded chapters.
- [x] Existing reading position and preferences remained usable.
- [x] Bundled harbor image remained available.
- [x] Normal fixture navigation continued to work.

These are physical preservation results, separate from host-SQLite integration evidence.

## Story A — full import/read/idempotency reported passed

[Normal Isn't Ordinary [Pokemon SI]](https://forums.spacebattles.com/threads/normal-isnt-ordinary-pokemon-si.1234421/):

- [x] Import succeeded at **25/25 primary text chapters**; story persisted in Library.
- [x] Title parsed correctly as **Normal Isn't Ordinary [Pokemon SI]**; author as **sabhnc**.
- [x] Primary contents/order matched the previously verified S1 source.
- [x] Real chapter text rendered through the existing normal Stowaway reader.
- [x] Fixture harbor image did not leak into this imported story.
- [x] Previous/Next stayed inside the real story; Contents returned to that story's contents screen.
- [x] Real chapter position restored across typography/theme changes and leave/reopen.
- [x] Force-quit/relaunch through Metro retained usable real chapter position restoration.
- [x] Downloaded chapters remained readable with phone networking disabled **while the Expo Go project was already running**.
- [x] Re-importing the completed URL did not create a duplicate story or restart a fresh body download.

This is the full real-story import/read/idempotency pass. The deliberate partial-cancel test used **Story C**, not Story A.

## Story C — partial cancellation/restart/resume reported passed

[Eyes Open](https://forums.spacebattles.com/threads/eyes-open-pokemon-fanfic.1129205/):

- [x] Import began from a **COMPLETE 34-entry primary manifest**.
- [x] Owen deliberately cancelled after **four chapter bodies** committed.
- [x] Import showed **Cancelled**, committed text retained, **4/34**, and Resume Download available.
- [x] Library showed **Eyes Open (Pokemon Fanfic)**, author **ViridiMayai**, **4/34** and the pending-chapters message.
- [x] Contents showed exactly the committed early entries as Text downloaded; later entries were Not downloaded and disabled.
- [x] A committed real chapter opened/read successfully while partial.
- [x] At the partial boundary, Next was disabled because the next primary entry was not downloaded; no fake/empty reader opened.
- [x] Owen force-quit Expo Go and relaunched through Metro; the same **4/34** committed partial state persisted.
- [x] Download did not restart automatically; prior committed chapters stayed locally readable after relaunch.
- [x] Owen explicitly resumed; missing work completed to **34/34**.
- [x] The final story remained one logical Library entry, without a duplicate story.
- [x] Completed Eyes Open text rendered successfully; author metadata was **ViridiMayai**.

Implementation/tests establish missing-only request logic. The phone report establishes correct visible persistence/resume behavior; it is **not packet-level proof that prior bodies were never requested again**.

## Final Library isolation and real reader — reported passed

| Library story | Downloaded / total |
| --- | ---: |
| Eyes Open (Pokemon Fanfic) | 34 / 34 |
| Normal Isn't Ordinary [Pokemon SI] | 25 / 25 |
| The Lantern Cartographer | 3 / 3 |

- [x] No duplicate real story appeared; the synthetic fixture stayed intact.
- [x] S1/S2A remained development-only diagnostics.
- [x] Real Eyes Open examples **Prologue**, **Chapter 3: Trespassing** and **Chapter 12: Racketeering** rendered readably.
- [x] Standard font/theme controls, Previous/Contents/Next and persistent locator behavior worked in the normal reader.

Only chapter-title metadata is recorded here. No story prose/raw pages/screenshots are committed.

The demonstrated loop is: paste public URL → COMPLETE primary manifest → persist story/manifest → download sanitized text → cancel safely retaining completed bodies → survive app restart → explicitly resume only missing work → complete story → read local real chapters → preserve position → avoid duplicate story creation.

## Remaining limits and unreported checks

I0 remains text-first: source images are not downloaded and remain placeholders. No manual update/check-for-new-chapters, rename/reorder/removal reconciliation, historical edit detection, Sidestory/Apocrypha/Informational/Omake import, read/unread, download/story deletion, search, sync, backend or notifications exists. Public/commercial, republication and App Store authorization remain separate. The next product slice must be explicitly chosen.

- [ ] Confirm actual iOS/Expo Go versions.
- [ ] Fresh first/middle/last numeric post-ID comparison beyond the supplied contents/order match to prior S1 evidence was not separately reported.
- [ ] Physical image-variant, VoiceOver and direct reader script/network diagnostics were not newly reported for I0; previous statuses remain unchanged.
- [ ] **S2B deferred:** independently installed Stowaway, bundled JS/assets, no Expo Go/Metro, successful offline cold launch and offline force-quit/relaunch.

These unreported checks do not revoke core I0 acceptance and are not marked as passes. The network-disabled result belongs to already-running Story A reading; no independent offline launch or separate Story C network-disabled run is inferred.

## Reproducing the accepted loop

Future regression work may use the two public URLs above. It is not unfinished core acceptance work. Keep Node 22 LTS >=22.13 or Node 24 LTS >=24.3, SDK 57 Expo Go and Metro; CLI/Expo Go use the same account, Windows/iPhone the same Wi-Fi and local-network permissions.

```powershell
cd C:\Users\ocac0\Documents\GitHub\stowaway
git switch feat/spacebattles-import-slice
npm.cmd ci
npm.cmd start
```

Open Add Story and tap Import deliberately. For a new partial run cancel after several commits, inspect Library/Contents, force-quit/relaunch through Metro, then explicitly Resume Download. An already-complete story returns its existing state without a new import. Stop on blocked/login/challenge or typed failure; never copy cookies, authenticate, proxy or bypass. No EAS/signing or paid setup is required.

**CORE I0 PHYSICAL ACCEPTANCE PASSED. S2B deferred; full v0 incomplete. Acceptance follow-up authorizes documentation, a separate commit/push and PR preparation only. No PR merge or new product slice is authorized.**

## Review-fix physical regressions — pending

PR #4's targeted review fixes follow accepted checkpoint **c707f39**. The reported passes above remain historical acceptance; no new iPhone run is claimed for the changed parser, cancellation guard or prefill behavior. All malformed/conflicting source regressions use generated fixtures, never live source requests.

- [ ] Cancel/background during a deliberately chosen initial import and body download; inspect authoritative counts, relaunch and explicitly resume. Retain existing accepted stories/positions without resetting storage. The final cancellable boundary is after FK validation and before returning control for COMMIT; later cancellation may retain completed work.
- [ ] Open Resume, observe saved-story loading, then edit/import a different URL; verify counts/actions remain attached to that operation and loading alone starts no source traffic.
- [ ] Smoke-check bare and anchor/span-wrapped image omission placeholders beside prose, current-story navigation, passage restoration and fixture harbor isolation; source images remain undownloaded.
- [ ] Repeat relevant default S2A transaction/recovery and reader smoke checks with its isolated database. The optional guard leaves callers without a guard and global FK validation unchanged; host tests are not native recovery evidence.
- [ ] If a bounded selected-story S1 range smoke is repeated, verify normal range discovery still works; absent explicit fragment identity remains supported. Do not infer wire-level or S2B acceptance from it.

The [review-fix record and deferred follow-ups](I0_Real_Story_Import.md#pr-4-targeted-review-fixes--5-october-2026) document unchanged global FK-scan performance and S1 concurrent diagnostic budgeting. PR #4 must remain unmerged until separately authorized.
