---
decision_id: decision-link-pii-family-values-in-the-existing-evaluation-page
status: accepted
scope: benchmarks
title: Link PII family values in the existing evaluation page
decided_at: 2026-10-08
---

# Link PII family values in the existing evaluation page

Status: accepted implementation decision for #618.

## Decision

Keep `/evaluation/pii/` as the family metric page. Its existing validated
population, scanner, family and view rows already carry the required values;
another route would repeat them. Add navigation to stable anchors composed from
the protocol, population, scanner, view and family identities. Metric values,
counts and artifact digests are excluded from the address, so changing a result
does not change its family link. Different scanners never share a row identity.

Read each row's scanner identity from its validated binding. Show the exact
configuration, activation and artifact SHA-256 values in eight-character blocks
and link the measured source commit when the pin supplies it. A source commit
that is not recorded for that scanner stays unavailable. Preserve schema minor,
official/exploratory mode, population identity and every withheld reason.

The reviewed protected binding can expose historical `b11` quantities from its
own bound report. Each row names the protocol, numerator, denominator, interval,
threshold and direction. Its source and historical role remain explicit. A
missing interval stays not measured. These quantities never replace `pii-v1`
occurrence quantities and their thresholds are never applied to them. An invalid
protected binding cannot expose even a partial historical qualification report.

New public baseline/candidate evidence is a separate sidecar. Reading it changes
neither PII authority nor a qualification state. Missing, mismatched or withheld
evidence is stated, never inferred from historical reports or runtime previews.
The page displays paired family quantities. Language and control-class strata
remain inspectable through links to both exact public artifacts, and the strict
consumer recomputes every stratum. Repeating every stratum inline exceeded the
1.5 MB export budget; the source links preserve access without expanding the
initial page.

## Consequences

No new family route, ranking, pooled total or support claim is created. Deep
links work in the server-rendered static export without script. The historical
qualification report, current public measurement and peer adapter readiness
remain distinct sources.
