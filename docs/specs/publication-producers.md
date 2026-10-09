# Publication producers

`publish-site.yml` selects credential producers through the existing credential
publication seam. It selects PII independently through
`check-pii-authority.mjs --github-output`, which runs the complete existing schema,
criteria, owner-target and reader gate before emitting an output. Neither workflow
selection writes an authority value, owner authorisation or engine pin.

| Input | New authority | Legacy authority |
| --- | --- | --- |
| Credential accuracy | Validated qualification view from canonical official RunArtifacts; no fresh legacy `run.json` required | Strict benchmark, released package on production or verified candidate on staging |
| Credential support and candidate | View support matrix and recorded candidate diff | Legacy qualification, classification, matrix and candidate evaluation |
| PII public measurement | Strictly validated pinned pii-eval artifacts; legacy population comparison `not-measured` | Same validated engine artifacts where supplied, optional staging TypeScript comparison explicitly marked `--bounded-population-oracle` |
| Discovery | `eval:discover`, checksum-pinned peer scanners, bundle publication | The same live discovery measurement |

The four committed PII population artifacts and their pin set are inputs on both
environments. Staging additionally consumes the transport-verified PUBLIC/SYNTHETIC
artifact and pin set. The PII consumer checks engine/build and artifact identity;
product binding separately determines whether a measurement names the publication
product. Production has no candidate binding and never labels those recorded
artifacts a fresh measurement of its released product. A stale optional population
bundle cannot activate the oracle under PII `new`.

Assembly receives the validated credential authority explicitly. Its `new` gate
checks the view, official runs, scanner roster, evidence pins and populations;
`legacy` retains the old run contract. Summary records under `new` identify the
actual recorded engine, scanners and population semantic digests instead of calling
historical `run.json` a fresh candidate run.

The production candidate refusal, qualified-tarball digest verification, scoped
GitHub App read token, denied default permissions, publication guards before OIDC,
immutable-bundle upload/readback and mutable pointer/index ordering are unchanged.
The obsolete Vite support-status guard is removed with its UI consumer. Publication
workflow changes select the full retained validation suite; neutral credential
consumer and shared statistical input changes invalidate both data cache keys.

Tests execute the real workflow producer/consumer shell for all four independent
authority combinations, including a stale optional population bundle, and verify
the PII output seam writes nothing when validation fails. No new scanner run or
workflow dispatch is needed for these contracts.

The legacy accuracy benchmark also records elapsed scanner durations. Those
incidental timings are not the registered performance measurements. Performance
retains its separate registered harnesses and accepted measured inputs; this
producer selection removes no performance lane or observation.
