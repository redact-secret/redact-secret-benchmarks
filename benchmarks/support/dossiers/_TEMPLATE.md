---
# Provider dossier — see README.md in this folder.
# Hand-write only research judgement here. Do NOT record measured status,
# fixture counts, or detector presence: those are derived from taxonomy.json,
# detectors.json and the published support matrix.
provider: <provider-id>            # taxonomy.json providers[].id ("generic" for provider-less families)
families:
  - id: <provider-id>:<family>     # taxonomy.json families[].id
    research:
      verdict: unresearched        # unresearched | ready | issuance-gated | date-gated | not-found | rejected
      tier: null                   # T0 | T1 | T2 | T3 once researched
      sources: []                  # provider docs, SDK or generator code backing the grammar
      issues: []                   # owner/repo#N research issues (open or closed)
      evidence: null               # 40-hex permalink to final evidence, if any
      researchedAt: null           # YYYY-MM-DD of the latest verdict
    blockedBy: null                # one line: what stops the next stage
---

# <Provider name>

<!-- One paragraph: what the provider is and which credential kinds it issues.
     Link the provider's own token/key documentation. -->

## Families

<!-- One subsection per family listed in the frontmatter. Copy the block below.
     Describe shapes in words or as a grammar; never paste a real, live or
     unrevoked credential, and do not invent a new secret-shaped literal. -->

### `<provider-id>:<family>`

- **Shape:** prefix, body alphabet, length or range, checksum or structure, separators.
- **Sources:** which source backs which property (T1 provider-documented,
  T2 corroborated by independent scanners, T3 project policy).
- **Issuance:** can we mint a sample and revoke it? Plan, cost or approval needed?
- **Collisions:** other providers or generic shapes this could be confused with.
- **Current contract in core:** link the `redact-secret` `docs/specs/detector-families.md`
  row or evidence (by `main` URL for living docs, 40-hex permalink for past state).

## Candidates that are not families yet

<!-- Credential kinds seen for this provider that are not in taxonomy.json,
     with the reason (e.g. undocumented format, not secret, generic coverage
     is enough). Remove the section if there are none. -->

## Open questions

<!-- What the next contributor should look at first. -->

## Research log

<!-- Links only: issue comments and PRs where the research happened,
     newest first. The iterative discussion stays in the issue. -->
