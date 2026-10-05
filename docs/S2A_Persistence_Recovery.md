# S2A persistence, interruption recovery and local resilience

Implementation date: 5 October 2026. Starting branch was clean `feat/persistence-installation-spike` at **a68f197**, the merged S1 baseline (PR #2). Clean `main` was fetched/pulled without changes; implementation branch is **feat/persistence-recovery-spike**. The older branch was preserved. The [October audit](Stowaway_October_2026_Groundwork_Audit.md) remains the architecture specification.

**Local implementation complete; physical S2A acceptance pending Owen's results.** Core S0/S1 acceptance remains the previously reported evidence. No older pending device checks are newly passed.

## Milestone split and scope

Owen deliberately split the audit's original S2 into **S2A recovery/resilience now** and **S2B independent installation/offline cold start later**. Signing, Mac access and an installation workflow must not block this local recovery work. Passing S2A will not mean full original S2 passed. After phone acceptance the appropriate status is **S2A accepted; S2B deferred/pending**.

S2A uses only the existing original synthetic fixture and bundled raster. It adds explicit development diagnostics and real host SQLite/filesystem tests. There were zero live SpaceBattles requests. S1 transport/parsing/diagnostic code is unchanged. No real-story importer, download manager, reconciliation, new sites, accounts, sync, backend, notifications or product styling was added. SDK 57, package.json, package-lock.json and app.json are unchanged; no dependencies were added.

## Production behavior reused

- `createRepository`, `serializeWrites` and `exclusiveTransaction` remain the actual storage path. Two small repository operations replace canonical chapter content and commit an asset reference through the same serialized exclusive transaction queue. Optional transaction-boundary callbacks provide deterministic exceptions and the held transaction. Identity/title/order are retained. No schema change or destructive migration is needed.
- `local-files.ts` extracts the existing image integrity checks and render-document generation behind relative file operations. `files.ts` is the native Expo filesystem adapter; host tests supply actual Node filesystem operations. Both run the same staging and render algorithm. New asset files are completed and validated by PNG checks and the exact bundled SHA-256 before any database reference is supplied; staging refuses an existing target. Accepted referenced files are never overwritten by staging.
- The existing chapter reader moved into `reader/ChapterReader.tsx`, with repository/preferences/render/navigation inputs. The normal route supplies its original S0 dependencies. S2A supplies its isolated repository/root and retains disposable renders for the removal experiment. Controlled WebView settings, CSP, sanitizer, app-owned bridge and PositionSession are reused unchanged.
- Failed text operations retain committed HTML/hash/sanitizer version/block IDs/links and locator. Successful replacement retains the old locator with its old hash. The unchanged bridge uses progression for a changed hash; stale locator writes are rejected. There is no cross-edit semantic matching. Loading/restoration/font changes retain the existing transient-save guards.

## Isolation and first inspection

Normal storage stays `stowaway-s0.db` in Expo's normal SQLite location, with normal document `assets/` and `reader/`. S2A uses exactly:

```text
<Paths.document>/stowaway-s2a/
  database/stowaway-s2a.db   (plus SQLite-owned sidecars)
  assets/<UUID>.png
  reader/<UUID>/index.html
  reader/<UUID>/asset-harbor.png  (only when a referenced image validates)
  checkpoint.txt
```

The diagnostic is reachable only in development from Contents. Entering it subscribes to status but does not open, inspect, seed, migrate, repair or reset S2A. Tap **Inspect persisted S2A state (no repair)** first. An absent database is reported without creating a directory or database. Existing supported state is read without migration, reseeding, image repair, orphan promotion or cleanup. An absent/unsupported schema raises a retained-data error and requires explicit reset. SQLite's own recovery on opening is expected; application repair does not run.

Explicit initialization refuses an existing S2A database, migrates only a newly created test DB, commits the three synthetic chapters, one image reference, a baseline locator at block-0011 + 12px/progression 0.3 and dark/22 preferences. Read the S2A chapter to choose a more recognizable saved passage if desired. The normal app's pre-existing S0 startup behavior is unchanged; S2A never substitutes its test DB into that provider.

Every diagnostic mutation/reset/cleanup validates the exact document-root child, database name and database directory. Relative file operations reject absolute paths, parent traversal and unsupported path characters. Reset closes only the S2A handle, deletes only the named test DB through Expo SQLite, and removes recognized test image/render files and its boundary marker. It does not wipe the test root or application documents. Unrecognized files are retained. Normal S0 paths/database cannot be supplied to these controls.

Orphan cleanup removes only direct UUID PNG files under S2A assets, excluding the active database reference, any in-progress stage, directories and unrecognized filenames. All mutating controls are also blocked during an active operation. Render cleanup removes only UUID session directories with the two recognized leaf files; foreign children prevent deletion. Reader directories are disposable; SQLite text/settings/locators remain canonical. The reset control requires two deliberate taps after inspection.

## Failure boundaries and exact checkpoints

| Scenario | Boundary/evidence | Expected persisted result |
| --- | --- | --- |
| Before mutation | JS exception before first UPDATE | Entire revision A and locator unchanged |
| Between SQL writes | Exception after HTML/hash UPDATE, before sanitizer/block/link UPDATE | Exclusive transaction rolls back; no mixed fields |
| Commit failure | Host driver's injected exception after all work, before COMMIT | All prior content/locator retained; queue accepts later writes |
| Commit/retry | Both UPDATEs complete in one exclusive transaction | Revision B fields move together; identities remain; 1 story/3 chapters |
| Normal reopen | Close/reopen without seed/repair | Correct committed A after failure or B after success |
| Real text kill | Await an unresolved gate inside the exclusive transaction after both UPDATEs | Phone must prove previous committed state survives process death |
| Corrupt stage | Write deliberately truncated bundled bytes; run real image validator | No new asset reference; old reference remains |
| Reference failure | Completed/validated new file; throw after reference SQL before commit | Old reference intact; new file unreferenced |
| Image retry/commit | Fresh validated file, then reference transaction | One logical harbor asset row, completed valid reference |
| Missing/corrupt reference | Explicit test-only file removal/corruption | SQLite text/locator/settings stay; reader supplies local image placeholder |
| Render loss | Remove only owned disposable session directories | Regenerate HTML from canonical SQLite and accepted local image, preserving locator/preferences |

The text gate visibly pins **READY TO FORCE-QUIT BEFORE COMMIT** above the diagnostic scroll area. At this point both SQL UPDATEs have run on the actual Expo exclusive transaction connection; the callback is still waiting and COMMIT has not run. The UI remains alive. There is **no background handler that releases or rolls back the gate**, and leaving/resetting/cleanup are disabled. Force-quit Expo Go by swiping it away in the iOS app switcher. Do not use reload/Fast Refresh as a process-kill substitute or edit the code while armed.

After relaunch through Metro, open diagnostics and inspect before initialization/repair/retry. The last boundary marker should still say READY, while the committed chapter/hash/locator should be the previous revision. An inspection during a held WAL transaction also sees the earlier committed state, not uncommitted changes.

The image gate pins **READY TO FORCE-QUIT: VALIDATED IMAGE, BEFORE DB REFERENCE** after a fresh file is completely written and re-read/validated, before starting its reference transaction. A force-quit here should leave the old reference and one harmless completed unreferenced file. This does not claim iOS interrupted a filesystem syscall. The truncated-byte experiment is an **injected partial/corrupt file**, not a native mid-write kill test.

Optional **Release checkpoint and commit** / **Release checkpoint with JS rollback** controls are JS-only alternatives. They are not phone process-interruption evidence. A normal database close/reopen is also not a kill. A separate force-quit after **Text commit completed: revision B** proves post-commit retention; do not confuse it with before-commit rollback.

`checkpoint.txt` is a small diagnostic boundary hint, written outside the SQL transaction. It is not an atomic commit journal: a kill between DB commit and marker write can leave an older label. Inspect actual SQLite fields/reference rather than inferring commit success from the label alone. It is not a production job ledger.

## Automated verification

System environment: Node **22.23.3**, npm **10.9.9**, Windows PowerShell. Execution policy was unchanged. No portable Node path, package upgrade, audit fix, override or EAS setup was used.

Added **16 real host SQLite/filesystem integration cases** and **3 mocked UI cases**. The existing 98 S0/S1 tests remain unchanged. Integration tests cover explicit no-repair inspection, failed transactions at each boundary, whole-field rollback, normal reopen, successful/idempotent retry, write queue recovery, stale locator rejection, an actually open SQLite transaction, staged-file validation/failure, missing/corrupt referenced images, regeneration without bundle/source access, cleanup exclusions, exact path guards and reset against a neighboring real normal-library DB/assets/locator/preferences. The held-transaction tests release with JS commit/rollback; they are not real process kills.

The UI tests verify no automatic diagnostic work, inspection gating, two-action reset and checkpoint visibility/unmount without reset. Existing deterministic DOM geometry tests still exercise progression fallback and transient-position suppression; they are not native WKWebView evidence.

Commands/results after implementation and sequential review:

```text
npm.cmd run check                 TypeScript + lint + 117 tests / 13 suites passed
npx.cmd expo install --check       Dependencies are up to date
npx.cmd expo-doctor@latest         21/21 checks passed
npx.cmd expo export --platform ios iOS Hermes bundle + bundled harbor.png exported to ignored dist/
git diff --check                   Passed (including staged new files)
```

Initial new assertions were corrected for the real placeholder wording, stored chapter shape and reopened handle. No old tests or acceptance criteria were weakened. Node's experimental host SQLite warning and Metro's color environment warnings are informational. A separate sequential diff review confirmed the moved reader body matches the baseline after accounting for its dependency seams. It corrected a text encoding issue, checkpoint gate cleanup after a failed marker write, non-file mutation/reset guards, checkpoint visibility and stale README milestone wording. Regression cases cover marker failure and a pre-schema database without auto-repair. All untracked source/tests/docs were inspected before staging. No build outputs, private downloads or credentials are committed.

## Physical acceptance and limits

All [S2A phone checks](S2A_Device_Checklist.md) are **pending** until Owen supplies results. Host SQLite/filesystem evidence cannot prove iOS durability, Expo Go lifecycle or WKWebView behavior. The local export is compilation evidence only. No iPhone was operated by the agent. Actual power-loss/storage hardware behavior is outside this diagnostic; image corruption is deliberately injected into disposable data. Known limits of same-hash block restoration/progression fallback remain unchanged.

S2A uses Expo Go/Metro for relaunch. Initial bundled-asset materialization may use Metro in Expo Go; regeneration reads already accepted local files and never calls bundle materialization or a source client. It does not prove a standalone installed app can cold-launch with Metro unavailable. Prior S0 VoiceOver/direct WebView network/script checks and S1 wire-level checks remain at their existing status.

## Deferred S2B — independent installation/offline cold start

S2B must still prove Stowaway installed independently of Expo Go, JavaScript/assets bundled locally, Metro unavailable, Wi-Fi/cellular disabled, a successful cold launch, and saved passage/preferences/images surviving force-quit/offline relaunch. **S2A passing does not mean full original S2 passed.**

Two future routes remain unchosen:

- **Free:** borrow/use a Mac with Xcode and a free Apple Personal Team for temporary personal-device signing. Apple's [membership comparison](https://developer.apple.com/support/compare-memberships/) documents free on-device personal testing and Personal Team limitations.
- **Paid:** Apple Developer Program membership plus the appropriate EAS/Apple signing workflow when warranted.

Defer S2B until Mac/Xcode Personal Team access or a membership/EAS signing route is worthwhile, a persistent personal Stowaway install is needed, or TestFlight/external testing becomes relevant. No route was configured or executed here: no EAS project/IDs/ownership, Apple signing/bundle registration/device registration/certificates/profiles, membership purchase, Mac/Xcode workflow, dev-client, eas.json, cloud build/upload, TestFlight or standalone preview build. No PR/merge is authorized by this implementation task; stop after branch commit/push, ready for Owen's S2A phone diagnostic.
