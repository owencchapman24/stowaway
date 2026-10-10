# Stowaway Public App Store Release Readiness & Source-Permission Report

**Date:** 9 October 2026  
**Project:** Stowaway  
**Current product state:** Standalone, local-first iPhone reader; SpaceBattles-only personal-use v0 complete  
**Purpose:** Define the legal/policy, App Store, privacy, safety, support, and source-permission work required before a public release.

> **Important:** This is a product/compliance research report, not legal advice. Third-party terms, Apple rules, and regional law can change. Before public submission—especially if Stowaway will monetize third-party content—obtain advice from a qualified attorney.

---

## 1. Executive verdict

Stowaway is technically much closer to public release than most early apps: it has no account system, no backend, no advertising, no analytics, no centralized story hosting, and no hidden background scraping. Those are major advantages.

However, the **public App Store blocker is source/content authorization and content moderation**, not coding quality.

Apple requires an app that accesses or displays a third-party service's content to be specifically permitted under that service's terms. Apple also treats creator/user-generated content as a sensitive category and expects moderation, reporting, blocking, contact information, age-rating compliance, and controls around mature content.

### Current decision matrix

| Capability/source | Current public-release decision |
|---|---|
| Local EPUB/HTML/file import | **GO — preferred public-safe foundation** |
| AO3 official-download/file import | **CONDITIONAL GO** |
| AO3 direct URL adapter | **CONDITIONAL GO only if free, unofficial, non-logo, non-paywalled, content-gated, and preferably confirmed in writing by OTW** |
| SpaceBattles direct adapter | **HOLD for public build pending written permission** |
| Royal Road direct adapter | **NO-GO without express written permission or official API partnership** |
| FanFiction.net direct adapter | **NO-GO without express written authorization** |
| Accounts/sync | **NOT REQUIRED for v1; defer** |
| Custom Terms of Service | **NOT REQUIRED initially; Apple standard EULA is sufficient** |
| Privacy policy/support site | **REQUIRED before submission** |
| Public reporting/blocking/content controls | **REQUIRED before submission** |
| Monetization | **Launch free, ad-free, no subscription/IAP around third-party content** |

### Recommended public product sequence

1. **Decide public seller identity** before creating the first App Store record.
2. Send source permission requests.
3. Build a **permission-gated source adapter registry**.
4. Add source-neutral EPUB/HTML import and backup/restore.
5. Build privacy/support/legal infrastructure.
6. Add content rating/filter/report/block functionality.
7. Add only sources whose authorization status is acceptable.
8. Run TestFlight.
9. Submit with a complete rights/evidence package.

---

## 2. What Apple requires

### 2.1 Third-party content rights

Apple App Review Guideline 5.2.2 says that if an app uses, accesses, monetizes access to, or displays content from a third-party service, the app must be specifically permitted to do so under that service's terms. App Store Connect also requires a Content Rights declaration for apps that show or access third-party content.

**Practical consequence:** `robots.txt` permission, public accessibility, or a lack of an explicit prohibition is not the same as App Store-grade authorization.

For every direct source adapter, retain:

- the terms version/date;
- official policy pages;
- the permission request;
- the full written response;
- the responder's role/contact;
- any conditions imposed;
- screenshots/PDF captures;
- the app architecture and rate-limit summary sent to the source;
- a concise authorization document for App Review.

Apple notes that documentation review can lengthen review time, and recommends supplying authorizations/licenses/partnership material in App Review Information before submission.

### 2.2 User-generated and creator content

Apple Guideline 1.2 requires apps with user-generated content or social networking services to provide:

- filtering of objectionable material;
- a reporting mechanism and timely response;
- blocking of abusive users;
- published contact information.

Apple also says web-service NSFW content must be incidental, hidden by default, and only displayed after the user enables it through the website. Creator-content apps must provide a way to identify content that exceeds the app's age rating and use an age restriction mechanism.

Stowaway does not host comments or social interactions, but it **does display creator/user-generated fiction**. App Review may therefore apply Guideline 1.2 even though the app is a reader rather than a social network.

#### Required Stowaway controls

Before submission, add:

- **Report on Source** — opens the source's official reporting mechanism.
- **Report to Stowaway** — sends URL/source/author metadata, not story text by default.
- **Block author/source locally** — prevents future display/import on that device.
- **Remove from Stowaway** — immediate local removal.
- **Public contact information**.
- **Content-rating filtering** using source metadata where available.
- **A mature-content policy** that avoids graphic sexual content in the App Store build.
- **A source/author opt-out process**.
- A documented response-time target for reports.

### 2.3 Age rating

Apple's current iOS 26-era categories include 4+, 9+, 13+, 16+, and 18+. Relevant examples:

- **16+** includes unrestricted web access and frequent mature/suggestive themes.
- **18+** includes frequent sexual content/nudity, frequent realistic violence, and frequent substance references.
- Graphic sexual content or prolonged graphic/sadistic realistic violence may make an app **Unrated**, which cannot be published on the App Store.

#### Recommended Stowaway position

- Do not target Kids.
- Plan for at least **16+**, likely **18+** depending on final source/content rules.
- Do not permit arbitrary Explicit/Not Rated AO3 content in the initial public build without a reviewed Apple-compliant gating strategy.
- Avoid an unrestricted generic-URL reader in the public build.
- Prefer structured source adapters and local file import.
- Provide a higher-rating override if the questionnaire calculates lower than the real content exposure.

### 2.4 Privacy

Apple requires:

- a public **Privacy Policy URL**;
- App Privacy answers in App Store Connect;
- disclosure of the app's own collection and integrated third-party SDK practices;
- accurate updates if practices change.

Stowaway's current architecture supports a favorable privacy posture:

- story bodies and reading state stay on-device;
- no Stowaway account;
- no Stowaway backend;
- no ads;
- no analytics;
- no tracking;
- no centralized content mirror.

A provisional App Privacy answer may be **“No, we do not collect data from this app”**, but confirm this only after:

1. generating and reviewing the release build's privacy report/manifests;
2. checking every included SDK;
3. deciding whether crash reporting or analytics will be added;
4. documenting that direct source requests disclose ordinary network metadata to those source sites.

The privacy policy should clearly say that third-party source sites receive requests directly from the user's device and may receive IP address, user agent, and normal web-request metadata under their own policies.

### 2.5 Support URL and public contact

Apple requires a Support URL that leads to actual contact information through which users can reach the developer regarding bugs, feedback, and feature requests.

Minimum public site:

- `/` — product overview
- `/support` — support email/form, response expectations, known issues
- `/privacy` — privacy policy
- `/legal` — unofficial-source disclaimers, content rights, EULA note
- `/takedown` or `/content-removal` — author/source opt-out and rights complaints
- `/security` — vulnerability reporting
- optionally `/age-suitability`

A static site is enough. It can be hosted on GitHub Pages, Cloudflare Pages, Netlify, or another simple host. A custom domain is preferable but not required.

### 2.6 EULA / Terms

Apple supplies a standard EULA automatically if you do not provide a custom one.

**Recommendation:** use Apple's standard EULA for v1. Do not create a lengthy custom Terms of Service merely for appearances.

Add a concise in-app **About & Legal** screen covering:

- Stowaway is unofficial and unaffiliated with source sites;
- authors retain rights in their works;
- users must comply with source terms;
- no redistribution through Stowaway;
- local data and removal behavior;
- privacy/support/takedown links.

Create custom Terms later only if Stowaway adds accounts, subscriptions, cloud sync, community features, or other contractual complexity.

### 2.7 Seller/developer name

Stowaway is currently under an **individual** Apple Developer Program membership. Apple states that an individual developer's public developer name is their legal name. Individuals cannot choose a separate developer name.

If you want the App Store seller/developer label to read **Stowaway**, **Stowaway Labs**, or another business name rather than your legal name, resolve that before creating the first App Store app record:

- form/use an eligible legal organization;
- obtain the required business identifiers;
- enroll/convert to an organization account or later transfer the app.

Do not create the App Store record until you have decided whether the legal-name seller display is acceptable.

### 2.8 EU Digital Services Act

Apple requires every developer to declare trader/non-trader status. If distributing in the EU as a trader, Apple displays verified contact information on the product page.

For an individual trader, this can include:

- address or P.O. box;
- phone number;
- email address.

Apple says a hobbyist with no commercialization intent may be a non-trader, but the developer must self-assess; Apple does not make the legal determination.

**Recommended launch simplification:** consider a US-only initial release while you complete source rights, moderation, and DSA decisions. Expand territories deliberately.

### 2.9 Export compliance, SDK, and build requirements

Already complete or substantially complete:

- iOS bundle identifier established.
- EAS internal build established.
- Standard/exempt encryption declaration configured.
- Standalone cold-start/offline acceptance passed.
- Branding and launch treatment implemented.

Before App Store submission:

- use the current required Xcode/iOS SDK through EAS;
- produce an App Store/production build, not an ad-hoc preview build;
- verify privacy manifests and required-reason API declarations;
- verify App Store screenshots and metadata;
- complete App Review Information and Content Rights.

---

## 3. Source-permission matrix

### 3.1 Summary

| Source | Official automated-access position | Commercial/public-app position | Apple/content risk | Recommended public status |
|---|---|---|---|---|
| AO3 | Bots/scraping generally allowed unless policy-violating; app hosting/paywalling content forbidden | OTW says unofficial apps are acceptable if clearly unofficial, no logos, and no charge | Very high mature/explicit UGC risk | **Conditional go** |
| SpaceBattles | Terms do not expressly authorize a third-party reader; robots allows general access but is not service permission | Authors retain copyright; site license does not clearly sublicense Stowaway | Moderate UGC + unclear rights | **Hold for written permission** |
| Royal Road | Terms expressly prohibit scraping/crawling/caching unless permitted | Personal-use license; competitive service prohibition | High contractual risk | **No-go without permission/API** |
| FanFiction.net | Terms restrict access to site/service and automated offline readers; no public API identified | Prior written authorization needed | High contractual risk | **No-go without permission** |
| Generic local EPUB/HTML | User supplies local file | Source-specific terms still govern how user obtained file, but Stowaway does not scrape | Lower | **Go** |

---

### 3.2 AO3 / Organization for Transformative Works

#### Official policy evidence

AO3's TOS FAQ says:

- scraping/bots that violate policy are forbidden;
- creating an app that hosts or paywalls AO3 content is forbidden;
- scraping for purposes that do not violate policy is generally allowed;
- AO3 can restrict or ban a bot that causes problems.

OTW also published an official statement that it is okay with individuals creating unofficial apps if they:

- clearly state that the app is unofficial;
- do not use AO3 logos;
- do not charge users for usage.

OTW emphasizes that AO3 will remain free. Its more recent explanation of why AO3 has no official app also warns that third-party apps with ads/payments are problematic and that App Store content restrictions conflict with AO3's maximum-inclusiveness mission.

AO3 officially supports downloads for offline reading.

#### Rights caveat

AO3/OTW does **not** own users' fanworks. Authors own their original expression and may request that unauthorized app copies be removed. OTW cannot authorize use of each author's copyright on their behalf.

#### Public-release conditions

A public AO3 adapter should be:

- free;
- ad-free;
- no subscription/IAP gating AO3 access;
- clearly unofficial;
- no AO3/OTW logos or confusing branding;
- no credential collection in v1;
- public works/downloads only;
- user-initiated;
- conservatively rate-limited and cached;
- local-only, no central mirror;
- source attribution and Open on AO3;
- author opt-out/removal process;
- content-rating filtering;
- likely exclude Explicit and Not Rated works from the initial App Store build.

#### Status

**CONDITIONAL GO.**

AO3 is the most promising direct source, but the main risk is **Apple content policy**, not AO3 automation policy. Obtain a written clarification from OTW and design explicit-content handling before submission.

#### Contact

- AO3 Support form for policy/technical questions.
- OTW Contact form; select Legal or Communications for official clarification.
- OTW Legal can provide information but not legal advice.

---

### 3.3 SpaceBattles

#### Official policy evidence

SpaceBattles' terms say:

- user content expresses its author's views;
- authors retain copyright;
- authors grant SpaceBattles a broad license connected to the service;
- the terms do not expressly authorize a third-party reader.

Its `robots.txt` currently allows general crawling at `/`, while reserving AI training and disallowing named bots. This is useful operational evidence but **not sufficient App Store authorization**.

SpaceBattles also has strong copyright/fair-use rules against reproducing full third-party articles. Those rules concern posts to SpaceBattles, not Stowaway, but reinforce that the site takes content-rights questions seriously.

#### Public-release conditions to request

Ask SpaceBattles for written permission for:

- user-initiated public Threadmark imports;
- low-rate serialized requests;
- local offline text/image caching;
- no login/private content;
- no comments/discussion copying;
- no central mirror;
- no ads/paywall around source content;
- attribution and Open on SpaceBattles;
- deletion/opt-out behavior;
- use of “SpaceBattles” descriptively in source-selection UI.

#### Status

**HOLD FOR WRITTEN PERMISSION.**

The personal/internal app can remain as-is. Do not include the direct SpaceBattles adapter in the public App Store build unless SpaceBattles supplies permission sufficiently clear for Apple Guideline 5.2.2.

#### Contact

- Use the site's **Contact Us** function or a private **Staff Communications** thread.
- SpaceBattles' own guidance says policy/administrative requests belong in Staff Communications and administrators should not be contacted directly without permission.

---

### 3.4 Royal Road

#### Official policy evidence

Royal Road's current Terms (last updated September 1, 2026) provide a personal-use license and state that content is for personal use only. They prohibit, unless expressly permitted:

- manual or automated scraping;
- crawling;
- caching;
- spidering;
- bots;
- access that exceeds human browser request rates.

They also prohibit using viewed/obtained content to provide a service Royal Road considers competitive.

Royal Road operates an API for its own mobile app, but no public developer API authorization was identified.

#### Status

**NO-GO FOR DIRECT INTEGRATION WITHOUT EXPRESS WRITTEN PERMISSION OR AN OFFICIAL API/PARTNERSHIP.**

Do not implement a public scraping adapter first and ask later.

#### Contact

- Royal Road Contact form.
- Support ticket if logged in.
- Ask specifically for API/partnership availability and express authorization.

---

### 3.5 FanFiction.net

#### Official policy evidence

FanFiction.net's Terms restrict:

- distributing site/user-submission content without prior written authorization;
- accessing content through technology or means other than the service itself;
- automated systems, including offline readers, when request volume exceeds what a human browser user could reasonably produce.

Its `robots.txt` allows general access with a crawl delay but blocks some paths. This does not override the Terms.

No public developer API was identified.

#### Status

**NO-GO FOR DIRECT INTEGRATION WITHOUT EXPRESS WRITTEN AUTHORIZATION.**

The terms are materially less favorable than AO3's and provide weak App Store evidence absent a direct written approval.

#### Contact

- Official FanFiction.net Support page and listed support email/contact route.
- Ask for written permission and whether an official API/integration route exists.

---

## 4. Recommended public-source architecture

### 4.1 Permission-gated adapter registry

Every adapter should carry a public-distribution policy record:

```ts
type DistributionStatus =
  | 'internal-only'
  | 'public-approved'
  | 'public-file-import-only'
  | 'disabled';

interface SourceCompliancePolicy {
  source: SourceId;
  distributionStatus: DistributionStatus;
  permissionEvidenceId?: string;
  allowedEndpoints: string[];
  publicContentOnly: boolean;
  authenticationAllowed: boolean;
  monetizationAllowed: boolean;
  localCachingAllowed: boolean;
  deletedContentPolicy: 'retain' | 'prompt-remove' | 'remove';
  authorOptOutSupported: boolean;
  matureContentPolicy: string;
  ratePolicyId: string;
}
```

Use a **build-time public source allowlist**, not a hidden remote switch. Apple rejects hidden or post-review feature changes.

Recommended builds:

- **Internal/private build:** current SpaceBattles functionality and experimental adapters.
- **Public App Store build:** only approved adapters plus generic file import.

### 4.2 File import as universal fallback

Add source-neutral:

- EPUB import;
- HTML import;
- possibly TXT/Markdown later;
- share-sheet/open-in support;
- backup/export.

Benefits:

- lower source-access risk;
- works with AO3's official downloads;
- allows users to bring legally obtained files;
- preserves Stowaway's reader/locator/library value;
- reduces pressure to violate source terms.

Do not market or link to source-specific scraping tools that violate a site's terms.

### 4.3 Deletion and author opt-out

The current saved-unlisted behavior is valuable for users but needs source/author review for public release.

Recommended public policy:

- ordinary source reordering/removal can preserve local copies only if source permission allows;
- explicit author/source takedown should disable new imports immediately;
- public app should support a source/author denylist;
- users should receive a prompt to remove affected local content;
- do not centrally collect or redistribute story bodies;
- document that fully remote deletion from an offline device cannot be guaranteed.

Negotiate this explicitly with each source.

---

## 5. Monetization recommendation

### Public v1

Launch:

- free;
- no ads;
- no subscriptions;
- no IAP;
- no paid source access;
- no analytics-based advertising.

This is especially important for AO3. OTW publicly states unofficial apps must not charge users for usage, and AO3 content must not be paywalled.

If monetization is considered later:

- obtain source-specific written permission;
- monetize only clearly original Stowaway services that do not gate source content;
- use Apple IAP where required;
- get legal review before implementing.

---

## 6. Public website and policy infrastructure

### 6.1 Required pages

**Home**
- what Stowaway does;
- supported sources;
- local-first privacy;
- unofficial status.

**Privacy**
- no account/backend/analytics/tracking;
- on-device storage;
- direct network requests to source sites;
- support email handling;
- optional diagnostics;
- deletion/export;
- policy update date.

**Support**
- email/contact form;
- version/build request;
- troubleshooting;
- known issues;
- response target.

**Content removal / author opt-out**
- source URL;
- proof of authorship or authorized representation;
- requested action;
- contact;
- expected response time.

**Security**
- vulnerability reporting address;
- what not to include;
- response process.

**Legal / Source attribution**
- unofficial and unaffiliated;
- source trademarks belong to their owners;
- author rights;
- source terms apply;
- standard Apple EULA.

### 6.2 In-app About & Legal

Add:

- app version/build;
- Privacy Policy;
- Support;
- Content removal;
- Security;
- source attribution;
- open-source licenses;
- “Stowaway is unofficial and unaffiliated” statement;
- local data/export/delete information.

---

## 7. Privacy-policy starting position

A concise privacy policy can state:

1. Stowaway does not require an account.
2. Library, story text, images, positions, and preferences are stored locally.
3. Stowaway does not operate a content server.
4. Stowaway does not use ads, analytics, or tracking.
5. When a user imports/checks a source, the device contacts that source directly; the source may receive IP address, user agent, request URLs, and other normal web metadata under its own privacy policy.
6. Support messages are voluntarily supplied and retained only as needed to respond and maintain records.
7. Users can remove stories/local data in the app; uninstalling removes the sandbox.
8. Exported backups are controlled by the user.
9. Children's privacy: Stowaway is not directed to children.
10. Contact and effective date.

Before submission, compare the release binary's privacy report against the policy and App Privacy label.

---

## 8. Content moderation and safety plan

### Minimum public v1 functionality

- structured source ratings/tags;
- source-based filters;
- hide disallowed ratings;
- report on source;
- report to Stowaway;
- local author block;
- local source/work block;
- content-removal web process;
- published community/content policy;
- support response workflow;
- 16+/18+ positioning;
- no graphic sexual content in public source adapters;
- no comments/chat/social features.

### Proposed report workflow

1. User taps **Report**.
2. Options:
   - Report on source;
   - Hide this work;
   - Block this author locally;
   - Contact Stowaway support.
3. Stowaway support record stores source URL/IDs and reporter message, not story body by default.
4. Review:
   - policy violation;
   - rights/takedown;
   - technical/source metadata error.
5. Add source/work/author to denylist or ship a corrective update where warranted.
6. Respond within a published target, e.g. 7 business days for ordinary reports and faster for credible legal/safety complaints.

---

## 9. Security and release operations

Before public beta, add:

- `SECURITY.md`;
- public vulnerability email;
- source-adapter threat model;
- privacy-manifest review;
- dependency/SBOM report for releases;
- secret-scanning/branch protection;
- backup/export/import;
- local diagnostic export with story text excluded by default;
- version/build screen;
- release notes/changelog;
- TestFlight process;
- incident and takedown log;
- App Review evidence folder;
- source-terms monitoring schedule.

Accounts are **not required**. If accounts are added later, Apple requires in-app account deletion and Stowaway will need authentication, token storage, retention, deletion, security, and sync-conflict policies.

---

## 10. App Store submission package

Prepare:

- app name/subtitle/description/keywords;
- Books primary category;
- support URL;
- privacy URL;
- marketing URL;
- screenshots;
- age rating;
- Content Rights answer;
- copyright;
- DSA status;
- App Privacy label;
- export compliance;
- source authorizations;
- review notes;
- test instructions;
- approved public test URLs or bundled demo;
- no-login statement;
- version release notes.

### Review notes should explain

- Stowaway is a local-first reader.
- No account is required.
- No story bodies are hosted on Stowaway servers.
- Imports are user-initiated.
- Included sources are authorized.
- Content filtering/reporting/blocking is available.
- How to test with a permitted work.
- Where source permission documentation is attached.

---

## 11. Exact outreach drafts

These drafts should be sent from a stable Stowaway support/business email. Replace bracketed fields.

---

### 11.1 AO3 / OTW

**Channel:** OTW Contact form, selecting Legal or Communications; optionally AO3 Support for routing.  
**Subject:** Request for written confirmation regarding a free unofficial local AO3 reader

> Hello,
>
> My name is Owen Chapman, and I am developing Stowaway, an independent iOS reading app. I am requesting written clarification before enabling AO3 support in a public App Store release.
>
> Stowaway is designed as a local-first reader. The proposed AO3 integration would:
>
> - be clearly labeled unofficial and unaffiliated with AO3/OTW;
> - avoid AO3/OTW logos and confusing branding;
> - remain free, with no ads, subscriptions, paywall, or charge for AO3 usage;
> - access only public works or official AO3 download endpoints selected by the user;
> - perform work import only after an explicit user action;
> - use conservative serialized requests and caching;
> - store accepted content only on the user's device;
> - operate no central mirror or redistribution service;
> - link prominently back to the original AO3 work;
> - avoid collecting AO3 credentials in the initial release;
> - support author/work opt-out and removal requests;
> - comply with robots.txt and any technical/rate guidance you provide.
>
> I have reviewed AO3's Terms of Service FAQ, including the statement that policy-compliant scraping is generally allowed, and OTW's public statement that unofficial apps are acceptable when clearly unofficial, logo-free, and not charging users. Because Apple may require documentary authorization under App Review Guideline 5.2.2, I would appreciate written confirmation of whether the behavior above is permitted and any conditions you require.
>
> I would also appreciate guidance on:
>
> 1. whether official AO3 download files are the preferred integration method;
> 2. any request-rate or User-Agent requirements;
> 3. required author opt-out/deletion behavior;
> 4. whether descriptive use of the name “Archive of Our Own (AO3)” in a source picker is acceptable;
> 5. any content-rating or mature-content conditions you would like the app to enforce;
> 6. whether Stowaway may retain local offline copies if a work is later removed, or whether removal should be required.
>
> I am happy to provide screenshots, technical architecture, request-flow documentation, and a TestFlight build.
>
> If the proposed integration is acceptable, could your response state clearly that Stowaway is permitted to access and display public AO3 content in this local, user-initiated, free and unofficial manner, subject to the conditions you specify? Apple may request that written evidence during review.
>
> Thank you for your time and for AO3's work supporting fan communities.
>
> Owen Chapman  
> Stowaway  
> [support email]  
> [website]

#### AO3 follow-up if response is vague

> Thank you for the clarification. Apple may ask for direct written evidence that the app is permitted under the service's terms. Would you be comfortable confirming the following, with any necessary edits?
>
> “The OTW permits Stowaway to operate as a clearly unofficial, free, non-ad-supported iOS reader that retrieves public AO3 works or official downloads only at the user's request, stores them locally on the user's device, links back to AO3, does not use AO3/OTW logos, and does not centrally host or paywall AO3 content, subject to AO3's Terms and any technical conditions stated in this correspondence.”

---

### 11.2 SpaceBattles

**Channel:** Private Staff Communications thread or Contact Us.  
**Subject:** Permission request for an unofficial public iOS reader using public Threadmarks

> Hello SpaceBattles Staff,
>
> My name is Owen Chapman, and I have developed Stowaway, an independent local-first iPhone reader for public threadmarked fiction. It currently exists as a private personal build. Before including SpaceBattles support in a public App Store release, I am requesting written permission and technical guidance.
>
> The proposed public integration would:
>
> - support only public story threads and primary Threadmarks;
> - never access private, login-gated, or restricted content;
> - never copy comments or discussion pages into the reader;
> - run only after the user explicitly imports or updates a selected thread;
> - use one conservative serialized request queue, caching, delay/backoff, and immediate stop on access challenges;
> - store story text and accepted images only on the user's device;
> - operate no central story mirror, search index, or redistribution server;
> - clearly attribute SpaceBattles, the thread, and the author;
> - provide an “Open on SpaceBattles” action;
> - remain free and ad-free for the initial public release;
> - honor author/site opt-out or removal requirements;
> - use “SpaceBattles” only descriptively and not imply endorsement.
>
> The app sanitizes imported HTML, executes no source JavaScript, loads no remote reader resources, and makes no automatic/background source requests.
>
> Apple App Review Guideline 5.2.2 may require written evidence that a third-party service permits this use. Would SpaceBattles authorize the behavior described above for a public iOS app? If so, please identify any conditions, rate limits, User-Agent requirements, branding rules, or deletion/retention rules you require.
>
> In particular, I would appreciate guidance on:
>
> 1. local offline caching of full author-posted chapters;
> 2. retaining or removing a local chapter if it is later unlisted/deleted;
> 3. an author opt-out process;
> 4. permitted request pacing and identification;
> 5. descriptive use of the SpaceBattles name;
> 6. whether the permission may be shown to Apple as App Review documentation.
>
> I can provide a technical document, screenshots, source/request policy, and TestFlight build. I will not include the SpaceBattles adapter in the public App Store build without an acceptable permission basis.
>
> Thank you,
>
> Owen Chapman  
> Stowaway  
> [support email]  
> [website]

#### SpaceBattles follow-up wording request

> Thank you. For Apple review purposes, could you confirm whether the following accurately states SpaceBattles' permission?
>
> “SpaceBattles permits Stowaway to retrieve and locally display public primary-Threadmark story content at the user's request, subject to the request-rate, attribution, branding, caching, deletion, and other conditions stated in this correspondence.”

---

### 11.3 Royal Road

**Channel:** Royal Road Contact form or support ticket.  
**Subject:** Request for express authorization or API partnership for a local-first iOS reader

> Hello Royal Road Team,
>
> My name is Owen Chapman, and I am developing Stowaway, a local-first iOS fiction reader. I am contacting you before implementing or publicly distributing Royal Road support.
>
> I have reviewed Royal Road's current Terms of Service, including the restrictions on scraping, crawling, caching, bots, and competitive services unless expressly permitted. I will not ship a direct Royal Road adapter without written authorization or an approved API/integration route.
>
> The proposed integration would:
>
> - import a fiction only after an explicit user action;
> - use an official API if one is available to approved partners;
> - use conservative serialized requests and comply with all rate limits;
> - access only public content permitted by Royal Road;
> - store content locally on the user's device for offline reading;
> - operate no central mirror or content-hosting service;
> - preserve author/title/source attribution;
> - link prominently back to Royal Road;
> - remain free and ad-free for the initial release;
> - support author/work opt-out and required deletion behavior;
> - avoid Royal Road logos or any implication of endorsement.
>
> Would Royal Road consider:
>
> 1. granting express written permission for this integration;
> 2. providing access to an approved public/partner API;
> 3. identifying technical, branding, commercial, and offline-caching conditions;
> 4. confirming whether local offline copies are permitted;
> 5. specifying required behavior when a work or chapter is removed;
> 6. allowing your written response to serve as authorization for Apple App Review Guideline 5.2.2?
>
> I can provide a detailed architecture, privacy model, rate policy, screenshots, and TestFlight build. If direct integration is not permitted, I would appreciate confirmation so Stowaway can keep Royal Road disabled and support only user-supplied local documents.
>
> Thank you,
>
> Owen Chapman  
> Stowaway  
> [support email]  
> [website]

#### Royal Road follow-up wording request

> If permission is available, could the written authorization identify the allowed API/endpoints, local caching duration, rate limits, branding requirements, monetization limits, and removal/author-opt-out obligations? Apple may request the authorization during App Review.

---

### 11.4 FanFiction.net

**Channel:** Official FanFiction.net Support page/contact email.  
**Subject:** Request for written authorization for a third-party local iOS reader

> Hello FanFiction.net Support,
>
> My name is Owen Chapman, and I am developing Stowaway, a local-first iOS fiction reader. I am requesting authorization before implementing or publicly distributing FanFiction.net support.
>
> I have reviewed the FanFiction.net Terms of Service, including the restrictions on accessing content through means other than the service and on automated systems/offline readers. I will not ship a public direct adapter without written authorization.
>
> The proposed integration would:
>
> - import only a story explicitly selected by the user;
> - use an official API or approved integration mechanism if available;
> - use conservative serialized requests below ordinary human browsing volume;
> - access only public stories;
> - store content only on the user's device for offline reading;
> - operate no central mirror, archive, or content-hosting service;
> - preserve title/author/source attribution;
> - link to the original FanFiction.net story;
> - remain free and ad-free for the initial release;
> - honor required work/author removal rules;
> - avoid FanFiction.net logos or an implication of endorsement.
>
> Would FanFiction.net provide:
>
> 1. express written authorization for this type of local reader;
> 2. an official API or partner integration route;
> 3. approved request-rate and User-Agent requirements;
> 4. rules for offline caching and removed works;
> 5. branding/trademark conditions;
> 6. permission to provide the authorization to Apple under App Review Guideline 5.2.2?
>
> I can provide technical architecture, screenshots, rate-limit documentation, and a TestFlight build. If this integration is not permitted, I will keep the direct FanFiction.net adapter out of the public build.
>
> Thank you,
>
> Owen Chapman  
> Stowaway  
> [support email]  
> [website]

#### FanFiction.net follow-up wording request

> Apple may require a direct authorization statement. If the integration is approved, could you confirm:
>
> “FanFiction.net authorizes Stowaway to retrieve and locally display public story content at the user's request through the approved mechanism and subject to the rate, caching, attribution, branding, and removal conditions stated in this correspondence.”

---

## 12. Permission evidence package

Create this repository structure, but do **not** commit private emails or personal contact details to a public repository:

```text
compliance/
  apple/
    app-review-rights-summary.md
    content-rights-matrix.md
    age-rating-notes.md
  sources/
    ao3/
      policy-snapshot.md
      permission-summary.md
    spacebattles/
      policy-snapshot.md
      permission-summary.md
    royal-road/
      policy-snapshot.md
      permission-summary.md
    fanfiction-net/
      policy-snapshot.md
      permission-summary.md
```

Keep raw correspondence in a private encrypted folder. Commit only redacted summaries and links.

Each source record should include:

- source;
- policy URL;
- policy date;
- captured date;
- exact permitted behavior;
- exact prohibited behavior;
- caching rules;
- rate rules;
- branding rules;
- content rating rules;
- removal/opt-out rules;
- monetization rules;
- responder and authority;
- Apple-evidence status;
- expiry/re-review date.

Review source terms at least quarterly and before every public release.

---

## 13. Phased public-release roadmap

### Phase PR0 — Source rights and seller identity

- Decide individual vs organization Apple seller name.
- Create support/business email.
- Select domain/site host.
- Send all four source inquiries.
- Archive current policies.
- Decide initial distribution territories.
- Decide free/ad-free public model.

**Exit:** clear authorization status for every source planned for the first App Store build.

### Phase PR1 — Public-safe core

- Generic EPUB/HTML import.
- Backup/export/restore.
- About & Legal.
- Privacy/support/takedown/security pages.
- Public content policy.
- Report/block/remove controls.
- Permission-gated adapter registry.

**Exit:** app is useful and reviewable without an unauthorized direct source adapter.

### Phase PR2 — First approved source

Recommended priority:

1. AO3 official-download/import path.
2. AO3 direct adapter only after permission/content-policy resolution.
3. SpaceBattles after written permission.
4. Royal Road/FFN only with express approval/API.

**Exit:** source adapter satisfies service authorization, Apple content policy, and physical acceptance.

### Phase PR3 — TestFlight

- App Store Connect record.
- Privacy label/report.
- Age rating.
- DSA status.
- External beta.
- Support workflow.
- Crash/diagnostics decision.
- Review all source and mature-content paths.

**Exit:** no blocking safety, privacy, rights, or usability issue.

### Phase PR4 — Submission

- Final metadata/screenshots.
- Content Rights answer.
- Attach source authorizations.
- Reviewer test instructions.
- Public production build.
- Submit and respond to App Review.

---

## 14. Immediate next actions

1. **Do not create the App Store app record yet** until deciding whether the public seller name can be your legal name.
2. Create a Stowaway support/business email.
3. Choose a public website host/domain.
4. Send the four outreach messages.
5. Create a private compliance evidence folder.
6. Begin the permission-gated adapter architecture and generic EPUB import.
7. Draft privacy/support/takedown pages.
8. Design the content filter/report/block system.
9. Reassess the public source lineup when responses arrive.

---

## 15. Final go/no-go rules

### A source is public-GO only when:

- official terms or written permission authorize the integration;
- permission is clear enough for Apple 5.2.2;
- request/rate/API rules are implemented;
- caching/deletion/opt-out rules are implemented;
- branding rules are implemented;
- content ratings can be kept App Store-compliant;
- App Review evidence is stored.

### A source remains internal-only when:

- terms are silent or ambiguous;
- permission is pending;
- it relies on anti-bot workarounds;
- it requires private/authenticated content not approved by the source;
- it makes mature-content compliance unmanageable.

### A source is disabled when:

- permission is denied;
- terms expressly prohibit the planned integration;
- the required content cannot be offered within App Store rules;
- the source asks Stowaway to stop.

---

## Official sources reviewed

### Apple

- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- App information / Content Rights / standard EULA: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information
- App Privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Support URL and platform metadata: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
- Age ratings: https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/
- Age rating definitions: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions
- DSA trader requirements: https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements
- Developer name: https://developer.apple.com/help/app-store-connect/create-an-app-record/set-your-developer-name
- Custom/standard EULA: https://developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement
- Review documentation timing: https://developer.apple.com/help/app-review/after-submitting-for-review/review-status

### AO3 / OTW

- AO3 Terms: https://archiveofourown.org/tos
- AO3 TOS FAQ / bots and scraping: https://archiveofourown.org/tos_faq
- Why AO3 does not have an official app: https://www.transformativeworks.org/why-ao3-doesnt-have-an-official-app/
- AO3 is always free / unofficial apps: https://www.transformativeworks.org/ao3-is-always-free-to-use/
- OTW graphics/trademark policy: https://www.transformativeworks.org/graphics/
- OTW contact: https://www.transformativeworks.org/contact_us/
- AO3 Support: https://archiveofourown.org/support
- Unofficial app/author-rights statement: https://www.transformativeworks.org/update-on-unofficial-ao3-reader-apps/

### SpaceBattles

- Terms: https://forums.spacebattles.com/pages/terms/
- Robots: https://forums.spacebattles.com/robots.txt
- Site rules: https://forums.spacebattles.com/pages/site-rules/
- Staff guidance: https://forums.spacebattles.com/help/staff/

### Royal Road

- Terms: https://www.royalroad.com/tos
- Contact: https://www.royalroad.com/contact
- Support: https://www.royalroad.com/support
- Knowledge base contact: https://www.royalroad.com/support/knowledgebase/100

### FanFiction.net

- Terms: https://www.fanfiction.net/tos/
- Robots: https://www.fanfiction.net/robots.txt
- Support: https://www.fanfiction.net/support/
