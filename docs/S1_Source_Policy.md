# S1 source-policy review — personal spike gate cleared

Review date: **5 October 2026, America/New_York**. Authority: the [October groundwork audit](Stowaway_October_2026_Groundwork_Audit.md) and Owen's S1 task. Branch: `feat/spacebattles-access-spike`. Intended test: a bounded, personal, unauthenticated iPhone feasibility check of user-selected public threads, complete primary manifests and minimal representative posts. This description is not evidence of source permission.

## Earlier tool retrieval results — preserved history

Only the three policy URLs specified by Owen were submitted to the browsing tool. No story, threadmark, Reader or post page was requested.

| Official document | Observed tool result | Review status |
| --- | --- | --- |
| [Terms](https://forums.spacebattles.com/pages/terms/) | `Failed to fetch ...: (403) Forbidden` | Contents unavailable; not reviewed |
| [Site Rules](https://forums.spacebattles.com/pages/site-rules/) | `Failed to fetch ...: (403) Forbidden` | Contents unavailable; not reviewed |
| [robots.txt](https://forums.spacebattles.com/robots.txt) | `URL ... is not accessible via this tool.` No HTTP status or body was exposed. | Contents unavailable; not reviewed |

These results describe this environment's policy-retrieval attempts. They do not establish that ordinary requests from Owen's iPhone will be blocked, or that the proposed test is permitted or prohibited. No retries, alternative source endpoints, proxy, authentication, copied cookies or challenge workaround were used.

## Current review — user-supplied official text

On **5 October 2026**, Owen supplied the current Terms, relevant Site Rules and robots.txt copied from the official URLs above in his normal browser. He reports reviewing the complete Site Rules. This review uses those supplied copies; the earlier tool's 403 is no longer the policy blocker. The pages were not re-fetched merely to replace his copies.

- **Terms:** the supplied text covers submitted content, staff moderation, minimum signup age, the service's license to submitted works, authors retaining copyright and changing terms. It does not explicitly prohibit public-page automated reader requests, nor expressly authorize an automated reader or grant reuse/distribution rights.
- **Site Rules:** supplied GR6/GR6A/GR6B address copyright, unauthorized sharing and plagiarism; GR13 addresses attacks on security/stability, illegal/confidential material and unauthorized sharing; GR13C addresses making forum reading harder through excessive content/features. These constraints remain applicable. No specific clause supplied clearly prohibits this ordinary, read-only, low-frequency personal test. Owen identified no explicit automated-reader prohibition in his complete review; no affirmative automated-reader authorization was identified either.
- **robots.txt:** several named AI/crawler agents, including GPTBot and ChatGPT-User, are disallowed on all paths. The wildcard group allows ordinary public paths while disallowing account, login, search, attachment, challenge and other sensitive/utility paths. The Stowaway client must use its own honest identity, never a browser or blocked crawler identity. Development probes must also use the Stowaway request layer, not the blocked browsing-tool agent.
- **Grouping:** the pasted `Crawl-delay: 1` belongs to the Yandex group, not clearly to the wildcard group. It is not an official one-second requirement for Stowaway. At least two seconds between request starts is Stowaway's own conservative default.
- **Rights and remaining uncertainty:** robots directives are crawling preferences, not copyright permission, contractual authorization, App Store approval or a legal conclusion. Policy silence is not affirmative permission. Neither another project's operation nor the user's provision of public URLs supplies distribution rights.

## Gate decision

**Proceed for this bounded personal S1 feasibility spike only**, following Owen's explicit scope decision. The supplied current documents identify no explicit prohibition of ordinary unauthenticated public-page reader requests; generic agents may crawl normal public paths; a low-frequency read-only test with minimal samples has a sufficient basis for this personal technical experiment. This is a narrow engineering decision, not a claim of explicit site authorization.

Public/commercial distribution and App Store authorization remain separate unresolved gates; copyright considerations are not waived. Stop on prohibited paths, access denial, login/challenge/interstitials, or any need for cookies/authentication, spoofing, bypasses or proxies. No mass download or persistence of real story bodies is authorized by S1. Owen supplied examples A/B/C; no stories were selected on his behalf. S1 physical acceptance remains pending his phone results.
