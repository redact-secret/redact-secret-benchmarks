---
decision_id: decision-carry-finding-type-keys-and-the-beta11-pii-families-in-the-support-matrix
status: accepted
scope: benchmarks
title: Carry finding-type keys and the six Beta.11 PII families in the support matrix, apart from the credential counts
decided_at: 2026-10-02
---

# Carry finding-type keys and the six Beta.11 PII families in the support matrix, apart from the credential counts

## Context

#647, from the core repository's detection-support audit (`redact-secret/redact-secret#1067`). The core's pinned matrix has no
finding-type key, so the 16 registered detectors that emit several finding types cannot be joined to their rows per type, and
the six opt-in PII families are absent, so the core states their statuses by hand. Their statuses come from the published
Beta.11 disposition at core `8b6a5fde`; email, IBAN, phone, payment-card and us-ssn code changed after it.

## Decision

1. **Every family row carries `findingTypes`**, derived only from `benchmarks/detector-finding-types.json` (the core detector
   inventory at one recorded revision) and the reviewed `arrivalFindingTypes` table. A row none of them grounds is `null`
   (unset), never guessed. The key is added by the matrix generator and not by `buildSupportMatrix`, so the qualification view
   and its parity report do not move.
2. **The six PII families are `piiFamilies`, a section beside `families`.** They are not credential families: `providerCount`,
   `familyCount`, `distribution` and `stableDistribution` stay credential-only, and the PII domain keeps its own denominator
   (decision-bind-pii-publication-to-the-measured-product). A row is the reviewed `pii-v1` projection checked against the
   published aggregate disposition; the generator does not run the binder, which opens the sealed protected partition.
3. **Statuses are exactly the disposition's**: five `provisional`, us-ssn `pending`, none `stable` (the schema fixes `stable` at
   0). No gate, threshold or status is changed by this.
4. **The rows say they were qualified at the Beta.11 core commit and not re-qualified.** `piiQualification.requalification`
   is `not-requalified` with a null commit until a later qualification sets both, and the model refuses one without the other.
5. **Recording each provisional or pending credential family against the Beta.13 candidate is not done here.** It needs the
   frozen candidate and is the rest of #647.

## Consequences

- The core re-pins the schema and the matrix and reads `piiFamilies` for its PII-status gate.
- A new product revision needs `node scripts/refresh-detector-finding-types.mjs` next to the detector snapshot; until then keys
  describe the snapshot revision, which the matrix names.

## Rejected

- PII rows inside `families`: they would enter `familyCount`, `distribution` and every page's denominator, and merge two
  domains the PII decisions keep apart.
- Fixture expectations as a key source: they do not record finding types, and scanner output is never a source.
