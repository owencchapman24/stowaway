# S2B standalone acceptance

Recorded: 9 October 2026, America/New_York. Branch: `chore/s2b-setup`.

**S2B — PASSED**, based on Owen's reported physical iPhone results. **SPACEBATTLES-ONLY STOWAWAY V0 COMPLETE** within the currently defined personal-use scope.

## Purpose

Close the independent-installation and Metro-free offline cold-start gate originally deferred from [S2A](S2A_Persistence_Recovery.md). The installed preview app must open its own local library, support downloaded reading and retain new local state across offline force-quit/cold-launch cycles.

## Build and setup facts

Repository configuration was inspected at starting commit `4d8754e082b704bedda02cc03b909a114c111dc9` plus the existing `app.json` export-compliance declaration. Pre-S2B hardening is merged in PR #12 at `0ae3ce12251781f11db3c8354fc46474b0305e8b`; its [implementation and evidence](Pre_S2B_Hardening.md) remain historical.

| Item | Recorded fact | Evidence |
| --- | --- | --- |
| Apple Developer Program | Enrollment approved | Owen's report |
| EAS project | `@stowaway/stowaway` | Owen's report |
| EAS project ID | `9d185605-2eeb-49c7-82bd-baf15a7f7345` | Owen's report and `app.json` |
| iOS bundle identifier | `com.owencchapman.stowaway` | Owen's report and `app.json` |
| EAS profile | `preview` | Owen's report and `eas.json` |
| Distribution | Internal / ad hoc | Owen's report; `preview.distribution` is `internal` |
| Physical iPhone | Registered in the Apple Developer team; Developer Mode enabled | Owen's report |
| First internal iOS build | Completed successfully | Owen's report |
| Installation | Build installed successfully on the registered iPhone | Owen's report |

The existing `ios.infoPlist.ITSAppUsesNonExemptEncryption = false` setting is retained and committed. This is the EAS/Apple export-compliance declaration corresponding to standard/exempt encryption usage; it does not mean the app uses no encryption. This pass records that declaration without changing application encryption or signing material.

## Evidence boundary

All physical-device results below are **user-reported by Owen**. The agent did not run or observe the iPhone, inspect the installed binary, or perform native wire-level inspection. The repository baseline above identifies this bookkeeping pass; it is not an independently verified build-to-binary attestation. No build ID, iPhone model or iOS version was supplied for this record.

The standalone app was seeded online with real local content before offline testing because its sandbox is independent from Expo Go. These passes establish offline relaunch of that seeded installation, not first-ever unseeded launch, migration from Expo Go, or persistence across uninstall/reinstall. No story prose or raw captures are included.

The S0–I4, pre-UI hardening and UI evidence retains its original physical-versus-deterministic boundaries. This S2B report does not turn previously unexercised mutation, failure-injection, VoiceOver, Dynamic Type or native-event cases into physical passes, or infer additional reading-session counts. Host validation of this documentation/configuration pass is recorded separately from the phone report.

## Exact physical sequence and results

Owen performed the following sequence on the installed Stowaway app after online seeding and reports **all steps passed**.

| Step | Action / observation | Result reported by Owen |
| --- | --- | --- |
| 1 | Metro/development server was not required for the installed preview build. | Pass |
| 2 | Stowaway was force-quit. | Pass |
| 3 | Airplane Mode was enabled and network access disabled. | Pass |
| 4 | Stowaway was cold-launched from the Home Screen. | Pass |
| 5 | The Library loaded successfully. | Pass |
| 6 | Previously downloaded story text remained available. | Pass |
| 7 | Previously downloaded local images remained available. | Pass |
| 8 | Continue Reading / saved passage restoration worked. | Pass |
| 9 | Reader font, theme and size preferences persisted. | Pass |
| 10 | Previous / Next chapter navigation worked. | Pass |
| 11 | Read/Unread changes worked while offline. | Pass |
| 12 | Contents reflected local Read/Unread changes. | Pass |
| 13 | New local state was changed while still offline. | Pass |
| 14 | Stowaway was force-quit again while still offline. | Pass |
| 15 | Stowaway cold-launched again while still offline. | Pass |
| 16 | The new local state persisted across that second cold launch. | Pass |

## Final S2B verdict

**S2B — PASSED.** Owen's report demonstrates that the installed iOS application runs independently of Expo Go and Metro; cold-starts without network access; opens its local library; reads downloaded text and accepted local images; restores semantic reading position; retains reader preferences; navigates downloaded chapters; updates and persists local Read/Unread state offline; and survives another offline force-quit/cold-launch cycle.

This closes the standalone/offline acceptance gate deferred from S2A. S2A remains separate evidence for its synthetic/local interruption-recovery scope.

## v0 status and future phases

**SPACEBATTLES-ONLY STOWAWAY V0 COMPLETE** within the currently defined personal-use scope, combining the historical accepted milestones with this user-reported S2B pass. This is the project acceptance status Owen requested, not a claim that every conditional historical phone check was exercised.

Included capabilities are public SpaceBattles primary Threadmarks import, offline text, supported offline images, same-version semantic passage resume, Read/Unread, manual updates/reconciliation, cancellation/recovery, library/download management, Continue Reading, the completed reader/UI, standalone installed iPhone operation and Metro-free airplane-mode cold start. Historical milestone records retain the exact evidence limits for each capability.

The next product phase is **multi-source architecture/research**, with implementation separately scoped. Additional v0 polishing is not the next milestone; the v0 reader/UI design remains frozen. No multi-source work begins in this documentation pass.

Deferred/excluded future work comprises App Store public release, TestFlight/public beta, AO3, FanFiction.net, Royal Road, other sites, accounts/sync/backend, search, TTS, highlights/bookmarks, pagination / Book reader style, and public-distribution/legal-authorization work. These are outside SpaceBattles v0, not failed requirements. Personal acceptance does not establish site permission, content rights or public distribution authorization.

## Repository bookkeeping scope

This pass creates this record, narrowly updates `README.md` and `AGENTS.md`, and commits the existing `app.json` export-compliance declaration. The branch also contains the earlier EAS/internal iOS configuration commit. No product behavior, reader/storage/source code, dependencies or UI are changed. No further EAS build, signing/provisioning change, App Store/TestFlight submission or live SpaceBattles request is performed.

Only non-secret project identifiers are recorded. Apple ID/password, UDID, certificate private material, provisioning-profile secrets, authentication cookies and 2FA data must not be included in the commit or PR.
