# Research intake routing

Two issue forms feed provider and credential-family research. Neither weakens the
dossier gates: only a dossier PR records a verdict.

| Form | File | Label | Audience |
| --- | --- | --- | --- |
| Suggest a provider or credential to research | `.github/ISSUE_TEMPLATE/suggest-research.yml` | `research-suggestion` | Anyone. Needs a provider name and a reason; no taxonomy, verdict or tier. |
| Research a provider or family | `.github/ISSUE_TEMPLATE/research-family.yml` | `research` | Experienced researchers, maintainer-created tasks, dossier-ready work. |

Both forms state the synthetic-only rule: never paste a real, live, unrevoked or newly
generated credential. Describe shapes in words; examples are synthetic.

## Routing

```text
suggestion
  -> maintainer triage
  -> taxonomy/dossier scaffold when warranted   (npm run family:new)
  -> advanced research issue                    (research-family form)
  -> dossier PR                                 (Closes #N, any verdict)
```

A maintainer may close a suggestion as:

- duplicate of an existing suggestion or research issue;
- covered by an existing family (check `npm run family:status`);
- insufficient evidence (no public provider source can be found);
- out of scope (not a credential, or outside what this repository measures).

Closing a suggestion never manufactures research work. The advanced issue, not the
suggestion, is the one a dossier PR closes. The dossier schema is
`schemas/dossier-v1.json`.
