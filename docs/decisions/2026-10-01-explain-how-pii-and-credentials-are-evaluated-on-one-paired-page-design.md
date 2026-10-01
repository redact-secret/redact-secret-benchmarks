---
decision_id: decision-web-evaluation-domain-pages
status: accepted
scope: benchmarks
title: Explain how PII and credentials are evaluated on two pages with one design, and read each from its committed record
decided_at: 2026-10-01
---

# Explain how PII and credentials are evaluated on two pages with one design, and read each from its committed record

## Context

#611, part of #543 (Evaluation section, phase P4). The old site has `/evaluation/credentials` (a three-line intro that links to the
maintainer-only Workbench) and `/evaluation/pii` (a client-rendered, schema-only page that shows metric definitions and no value). The
new app has no evaluation page, and `/comparison/accuracy` already shows a credential view and a PII view but explains neither domain.
The brief: say how each domain is evaluated and show its current status, as a pair. Mockup:
https://claude.ai/artifact/8jeZ1T8zQruJAzL5LowktG (desktop and phone, light and dark, both pages).

The two domains are measured differently. Credentials: fixtures judged per span (EXACT, COVERED, OVERBROAD, PARTIAL, MISS), three
evidence levels, six methods, a support classification by floors. PII: cases judged on two axes (type identity, sensitivity in context),
ten metrics each with its own population, an identity oracle, a protected corpus run once. The boundary rule applies to both: the repository
measures and records, every artifact says `supportClaims: false`.

## Decision

1. **One design, one block set.** `/evaluation/pii/` and `/evaluation/credential/` render `DomainView` (`web/components/evaluation/domain/`)
   with different data. Order: head with a switch to the other domain, three facts, method, coverage, current status, how to read the
   numbers, sources. What differs between the pages is the ledger, never the design.
2. **Method** is four steps (author, run, compare, record), the words an outcome or a level can take, who decides the expected answer,
   the methods that build cases, the metrics defined (a disclosure; values are not shown), and what "recorded, not graded" means: outcomes are
   recorded against an expected answer, never turned into a score, a rank or a verdict about a product; a family's status is a classification
   by published rules with `supportClaims` false.
3. **Coverage** shows counts and the mode of the record they come from. Credential: fixtures by kind and level, cases and variants by method.
   PII: cases by family and view (oracle plan, qualification plan, diagnostic-balanced, benign-heavy, protected), each split by what the author
   expects. **No total across views, families or domains** (views overlap, so a sum counts a case twice); the one sum shown is the protected
   cases, which are disjoint corpora. Provider and family lists are not repeated: `/report` has them.
4. **Current status** has three groups: recorded, not measured yet, known gaps. Every row has a status word and a shape (a status is never a
   colour alone), the recorded value, the source and a link or the follow-up issue. A status that depends on the build names its mode.
5. **Missing facts are states.** A fact the ledger does not hold is the dashed "Not recorded" or "Not measured" with the issue that owns it:
   #615 (PII product activation), #616 (PII validator observation and bound population comparison), #617 (PII per-method counts, which the
   credential domain commits), #618 (PII metric values per family), #619 (credential policy-qualified profile, needs a protected holdout).
6. **PII data.** `services/domains.ts` rebuilds the PII support matrix at build time from the reviewed Beta.11 protected binding
   (`bindPiiProtectedSupport` logic: `loadPiiProtectedSupportEvidence`, `validatePiiProtectedSupportBinding`, `buildPiiSupportMatrixV2`,
   `validatePiiSupportMatrixV2`). This is the route the production publish binds (`scripts/publish-pii-support.ts` with no product record), so no
   `public/results` file and no product artifact is needed. Case counts come from the frozen report the binding commits to; a binding that
   does not validate gives "Not recorded" for the whole domain, never a part. **Mode: candidate** (core `8b6a5fd`, unreleased, version string
   0.1.0-beta.10), read from the report's own `candidate.released`. No PII number is shown without it.
7. **Credential data.** Fixture counts come from the catalog (the corpus, independent of a run). The stable count comes from the support record
   (`evidence/<n>/<commit>/support-status-published.json` or `-candidate.json`) whose package version, or candidate commit, equals the run's, the
   newest by `generatedAt`, accepted only if its distribution recounts from its own families. With no matching record the count is "Not
   recorded"; a published record never stands in for a candidate run. The engine qualification record
   (`docs/specs/qualification/engine-v1.json`) supplies the per-method counts and is read only when it says `supportClaims: false`. Findings
   come from `known-gaps.json` through the existing validator.
8. **Tests assert structure, never ledger values.** The services are exercised on the committed tree for shape (a distribution recounts, views are
   bound, every state word has a meaning) and on overlays for each refusal; the resolvers on synthetic data.

## Old to new addresses

For cutover (#594-style host redirects; nothing is redirected now):

| Old | New |
| --- | --- |
| `/evaluation/credentials` | `/evaluation/credential/` |
| `/evaluation/pii` | `/evaluation/pii/` |
| `/support?domain=pii` | stays on the old site; its family list is not repeated |
| `/workbench` (credential evidence) | the Evaluation phases P1 to P3, not this page |

## Consequences

- Both pages are server components with no client island: the numbers are in the HTML and no file is added to the export's data directory.
- The Evaluation entrance in the header and section navigation belongs to P1 (#614). Until it is on `develop` these pages are reachable by
  address and from each other through the switch.
- A repin re-keys the PII counts (a new reviewed binding) and the credential stable count (a new support record); no test names them.
- The credential domain descriptor on the old site lists only the documented and empirical profiles. The new page names policy-qualified too and
  marks it not measured (#619).
