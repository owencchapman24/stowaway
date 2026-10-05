# I0 physical iPhone checklist — acceptance pending

**I0 is NOT physically accepted.** This checklist is for Owen's next run, not a report of results. S0/S1/S2A retain their accepted status; **S2B remains deferred**. Use Expo Go/Metro, not an independently installed build. No EAS/signing/paid setup is needed.

Implementation branch: **feat/spacebattles-import-slice**. See [implementation/model/validation notes](I0_Real_Story_Import.md). Record iPhone model, iOS and Expo Go versions and the tested commit. Keep screenshots/prose/captures out of Git.

On Windows:

```powershell
cd C:\Users\ocac0\Documents\GitHub\stowaway
git switch feat/spacebattles-import-slice
node --version
npm.cmd --version
npm.cmd ci
npm.cmd start
```

Use Node 22 LTS >=22.13 or Node 24 LTS >=24.3 and the current SDK 57 App Store Expo Go. Keep CLI/Expo Go on the same Expo account, Windows/iPhone on the same Wi-Fi, Windows private-network firewall permitting Node and Expo Go local-network permission enabled. Scan the terminal QR. Keep Metro running for relaunch.

Acceptance story A: **Normal Isn't Ordinary [Pokemon SI]** — [public source](https://forums.spacebattles.com/threads/normal-isnt-ordinary-pokemon-si.1234421/). Copy this URL into the Add Story field:

```text
https://forums.spacebattles.com/threads/normal-isnt-ordinary-pokemon-si.1234421/
```

S1 observed **25 primary entries**, first post **111923315**, last **124318183**. Compare with the current source; these are historical observations, not hard-coded application values. If the source has changed, record the actual primary count/IDs and explain the difference.

## A — migration and partial download

- [ ] Before starting, confirm Library contains **The Lantern Cartographer**, three downloaded chapters, and the old passage/preferences/bundled harbor image still work after v2 migration. Record the baseline.
- [ ] Tap **Add Story**. Opening the screen and pasting the URL alone cause no import.
- [ ] Tap **Import** deliberately. Observe complete primary manifest discovery, total **25** if unchanged, then foreground text download with downloaded/total and current chapter title.
- [ ] Tap **Cancel** after several chapter commits, preferably 3–5 and before completion. Wait for the cancelled status. Record the final authoritative downloaded count **N**; a chapter that committed just before cancellation can increase the final count.
- [ ] Tap **Library**. A single real story remains at **N / 25**, alongside the original fixture.
- [ ] Open that story's contents. Exactly N entries say **Text downloaded**; remaining entries say **Not downloaded**, are disabled and cannot open a fake/empty reader.
- [ ] Open a downloaded entry, verify actual chapter text and use **Contents** to return to this story.

If blocked, challenge/login/interstitial, wrong body or typed parser/storage/network failure occurs, stop and record code/HTTP status if displayed, stage, downloaded/total and selected post ID. Do not log prose, bypass a challenge, copy cookies, authenticate, proxy or substitute alternate endpoints. Already committed text should remain available; report that too.

## B — real restart and explicit resume

- [ ] Force-quit Expo Go from the iOS app switcher. Relaunch Stowaway through Metro with networking restored as necessary.
- [ ] Partial story still exists with the same COMPLETE manifest and authoritative N downloaded count. No automatic download starts.
- [ ] Previously downloaded entries still open/read locally; missing entries still say **Not downloaded**.
- [ ] Tap **Resume Download** from story contents. The Add Story screen loads saved URL/counts without fetching until the next deliberate tap.
- [ ] Tap **Resume Download** there. Progress starts from N, preserves existing chapters and reaches **25 / 25** if the source is unchanged.
- [ ] Library has one fixture and one real story, exactly 25 primary entries/bodies, and no duplicate titles/IDs. Earlier downloaded chapters/positions remain intact.

Host tests verify missing-only requests and duplicate avoidance. The UI's counts do not independently prove native packet-level no-refetch behavior; report visible device behavior without claiming wire inspection.

## C — compare primary source contents

- [ ] Compare persisted story title and author with the source's thread header. Report **Author unavailable** if extraction is uncertain; do not infer from a later post.
- [ ] Compare all 25 ordered primary chapter titles with the site's primary/default Threadmarks, including any pages/ranges. Excluded side categories must not appear.
- [ ] Compare first/middle/last source post IDs against the development **Post ID** lines in story contents. Record the actual selected middle ID and endpoint IDs.

## D — real reading and story-specific navigation

- [ ] Open the first, a middle and the final real chapter. Confirm exact matching post content and readable headings/emphasis/quotes/lists/tables/spoilers where present.
- [ ] Any source image is an explicit omitted-image placeholder. Imported chapters show no fixture harbor image; no source-image download is claimed.
- [ ] Previous/Next stay inside the real story; first/final bounds do not enter the synthetic story.
- [ ] **Contents** returns to this real story. Fixture Contents and navigation remain separate.
- [ ] Safe links open only after a deliberate tap. Do not use external links during the offline test.

## E — position and preferences

- [ ] Scroll to a recognizable passage in a real chapter, expand spoiler ancestors if relevant, and wait briefly for the position save.
- [ ] Change font size/theme. The same-version passage remains usable after reflow.
- [ ] Tap **Contents**, reopen that chapter and confirm the saved passage/preferences.
- [ ] Force-quit/relaunch through Metro and reopen the same chapter. The last completed locator remains, with unchanged content hash.

## F — already-running offline text reading

- [ ] Keep the Expo Go project already running and disable phone Wi-Fi/cellular.
- [ ] Open/read downloaded real chapters and navigate between them. No SpaceBattles source connection is required to render SQLite text or regenerate local reader files.
- [ ] Contents/counts remain available locally; source images stay placeholders.
- [ ] Re-enable networking for Metro as needed. Do not treat this as standalone/offline cold-start acceptance or S2B.

## G — idempotency and isolation

- [ ] After 25/25, paste the same URL again and tap Import. It shows/opens the existing complete story without creating a second story or restarting body downloads.
- [ ] Fixture still has its original three bodies, image and saved passage; current global reading preferences are those deliberately selected during testing, since preferences are shared.
- [ ] S1/S2A remain development diagnostics, separate from normal story import. Do not reset/repair S2A for this test. No other real story appears.

Send results A–G, actual counts/IDs, tested commit/client versions, any failure and anything untested. **Only Owen's reported device results can establish I0 physical acceptance.** No PR creation/merge, source images, updates or S2B follows automatically.
