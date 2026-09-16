# Beta.4 detector and precision backlog

Created and verified 2026-09-16 in
[redact-secret v0.1.0-beta.4](https://github.com/redact-secret/redact-secret/milestone/7):
**20 new detector work items and 10 false-positive test work items**.

## Selection method

This is a qualitative developer/operations shortlist, not a claim of the
20 largest platforms by measured market share. Selection balances cloud,
identity, delivery, collaboration, messaging, observability, and data-platform
workflows; credential exposure in everyday configuration/logs; and absence
of a dedicated equivalent in the pinned beta.3 detector registry.

The [Stack Overflow 2025 technology survey](https://survey.stackoverflow.co/2025/technology)
provides developer/cloud workflow context; the
[Postman 2025 API report](https://www.postman.com/state-of-api/2025/)
provides API-workflow context. Neither ranks all selected vendors together.
Each issue links the relevant pinned Gitleaks/TruffleHog registration and
documents its credential scope and false-positive boundary.

A missing dedicated detector does not prove a runtime miss: generic, Bearer,
JWT, or private-key detection may already catch some values. Provider-specific
public IDs, publishable configuration, legacy formats, and secret components
need explicit policy decisions. Implementation remains deterministic/offline;
no live credential verification or TruffleHog implementation vendoring.

## Platform detector issues

| Category | Platform / scope | Issue |
| --- | --- | --- |
| Cloud and AI | Google Cloud / Gemini API keys | [#296](https://github.com/redact-secret/redact-secret/issues/296) |
| Cloud and identity | Microsoft Entra application client secrets | [#297](https://github.com/redact-secret/redact-secret/issues/297) |
| Cloud and delivery | Azure DevOps personal access tokens | [#298](https://github.com/redact-secret/redact-secret/issues/298) |
| Collaboration | Atlassian Jira / Confluence Cloud API tokens | [#299](https://github.com/redact-secret/redact-secret/issues/299) |
| Collaboration | Notion integration tokens | [#300](https://github.com/redact-secret/redact-secret/issues/300) |
| Messaging | Discord bot tokens | [#301](https://github.com/redact-secret/redact-secret/issues/301) |
| Messaging | Telegram bot API tokens | [#302](https://github.com/redact-secret/redact-secret/issues/302) |
| Messaging | Twilio Auth Tokens and API key secrets | [#303](https://github.com/redact-secret/redact-secret/issues/303) |
| Observability | Datadog API and application keys | [#304](https://github.com/redact-secret/redact-secret/issues/304) |
| Observability | Grafana service-account and Cloud tokens | [#305](https://github.com/redact-secret/redact-secret/issues/305) |
| Observability | Sentry user and organization auth tokens | [#306](https://github.com/redact-secret/redact-secret/issues/306) |
| Observability | New Relic API credentials | [#307](https://github.com/redact-secret/redact-secret/issues/307) |
| Data platforms | Databricks personal access tokens | [#308](https://github.com/redact-secret/redact-secret/issues/308) |
| Data platforms | Confluent Cloud API key secrets | [#309](https://github.com/redact-secret/redact-secret/issues/309) |
| Developer tools | Postman API keys | [#310](https://github.com/redact-secret/redact-secret/issues/310) |
| Deployment | Netlify personal access tokens | [#311](https://github.com/redact-secret/redact-secret/issues/311) |
| Deployment | Heroku API tokens | [#312](https://github.com/redact-secret/redact-secret/issues/312) |
| Messaging | Mailchimp Marketing API keys | [#313](https://github.com/redact-secret/redact-secret/issues/313) |
| Messaging | Mailgun private API and signing keys | [#314](https://github.com/redact-secret/redact-secret/issues/314) |
| Identity | Okta API tokens | [#315](https://github.com/redact-secret/redact-secret/issues/315) |

## False-positive test issues

These are independent-benchmark test-depth gaps, not newly confirmed
production defects or assertions that upstream has no relevant tests.
Acceptance starts with an upstream test audit and adds missing cases plus
positive guards. The 10 issues cover 24 existing detector families.

| Test area | Detector families | Issue |
| --- | --- | --- |
| Public versus secret prefixes: Stripe, Shopify, Supabase | stripe-token, shopify-token, supabase-token | [#316](https://github.com/redact-secret/redact-secret/issues/316) |
| AI token namespace and boundary negatives: OpenAI, Anthropic | openai-token, anthropic-token | [#317](https://github.com/redact-secret/redact-secret/issues/317) |
| AWS public identifiers, documentation literals, and near misses | aws-access-key | [#318](https://github.com/redact-secret/redact-secret/issues/318) |
| SCM and package token boundary negatives | github-token, gitlab-token, npm-token, pypi-token | [#319](https://github.com/redact-secret/redact-secret/issues/319) |
| Infrastructure provider namespace negatives | vault-token, cloudflare-token, digitalocean-token, docker-token, vercel-token | [#320](https://github.com/redact-secret/redact-secret/issues/320) |
| Application provider punctuation and near-miss negatives | huggingface-token, linear-token, slack-token, sendgrid-token | [#321](https://github.com/redact-secret/redact-secret/issues/321) |
| PEM public material and malformed-delimiter false-positive controls | private-key | [#322](https://github.com/redact-secret/redact-secret/issues/322) |
| JWT and Bearer grammar false-positive controls | jwt, bearer-token | [#323](https://github.com/redact-secret/redact-secret/issues/323) |
| Connection-string grammar and public URL negatives | connection-string | [#324](https://github.com/redact-secret/redact-secret/issues/324) |
| OTP URI query grammar and non-secret base32 negatives | otpauth-uri | [#325](https://github.com/redact-secret/redact-secret/issues/325) |

Generic-token already has extensive benchmark negatives; its reproduced
reference and nested-quote failures remain in [#292](https://github.com/redact-secret/redact-secret/issues/292),
[#293](https://github.com/redact-secret/redact-secret/issues/293), and
[#294](https://github.com/redact-secret/redact-secret/issues/294).
These were not duplicated.

All 30 issue bodies, labels, URLs, and milestone membership were read back and
verified. This task creates the backlog only; no detector behavior or fixture
expectations were changed.
