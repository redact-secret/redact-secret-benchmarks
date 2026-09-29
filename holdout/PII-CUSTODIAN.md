# PII protected corpus: custodian guide (beta.11, six families)

You are the custodian. You write every protected case, seal them, and run the
sealed cases once against the frozen beta.11 candidate. No agent writes, sees,
or suggests a case. Agents that have seen the development plans must not shape
your cases in any way.

Only counts come out of a run. Case text, ids, ranges, labels and your seed
never leave `holdout/generated/`, and that directory is never committed.

## 1. Where the input lives

```sh
mkdir -p holdout/generated && chmod 700 holdout/generated
cp holdout/pii-custodian-template.json holdout/generated/pii-b11-input.json
chmod 600 holdout/generated/pii-b11-input.json
```

- The directory must be mode `0700` and the file `0600`. Neither may be a
  symlink. Every command rejects anything else.
- Edit the file in place. Do not keep copies outside `holdout/generated/`, and
  do not paste case text into issues, chat, terminals you share, or an agent
  session.
- `holdout/generated/` is gitignored. `npm run fixtures:check` fails if
  anything under it is ever tracked or staged.

## 2. JSON shape

The template [`pii-custodian-template.json`](pii-custodian-template.json) has
the exact shape. Every `<CUSTODIAN: …>` string is a placeholder. Replace it
with a value of the stated type: `true` for the statements, integers for
`candidate.start` / `candidate.end`, `null` for "none", and an array for the
two `…Basis` fields. The template itself never validates.

Top level: `schemaVersion` 1, `kind` `pii-b11-protected-input`, a private
`seed` (32–256 characters), your `attestation`, and `cases`.

One object per case, with exactly these keys:

| Key | Value |
| --- | --- |
| `id` | Unique. Lowercase letters, digits, `-`. Never published. |
| `family` | `pii:global:network-address`, `pii:global:email`, `pii:global:payment-card`, `pii:global:iban`, `pii:us:ssn` or `pii:global:phone` |
| `selector` | The activation the case runs under. The exact family (`pii:family:global:email`, `pii:family:us:ssn`, …), `pii:global` (global families only), or `pii:us` |
| `view` | `diagnostic-balanced` or `benign-heavy-stress`. Each case is in exactly one view |
| `axis` | Your tag for the evidence class (for example the kind of benign look-alike). Never published; only the number of distinct benign tags is |
| `twinOf` | `null`, or the `id` of its one-property twin: same family, same view, opposite side (sensitive vs. not). Each case can be a twin target once, and never both ways |
| `language` | `en` or `ko`. It must be `ko` exactly when the text contains Hangul |
| `text` | The whole case text, up to 8 KiB |
| `candidate` | `{ "start": n, "end": n }` in **UTF-8 bytes** (a Hangul syllable is 3 bytes), or `null` when there is no candidate value |
| `identity` | `valid`, `invalid` or `not-established` (the #423 oracle labels) |
| `identityBasis` | `contract-grammar`, `reference-validator`, `authority-published-value`; `[]` when identity is `not-established` |
| `sensitivity` | `sensitive`, `non-sensitive` or `not-established` |
| `sensitivityBasis` | `["contract-context-rule"]` for sensitive, `["authority-reserved-value"]` for non-sensitive, `[]` for not-established |
| `action` | `redact` for a sensitive case, `none` otherwise |

The allowed label combinations are:

- `valid` + `sensitive`, which needs a candidate and action `redact`;
- `valid` + `non-sensitive`, which needs an authority-reserved value;
- `valid` + `not-established`;
- `invalid` + `not-established`;
- `not-established` + `not-established`, with `candidate: null`.

Card, IBAN, SSN, phone and network-address candidates are checked by the
family's reference validator. A `valid` label must pass the validator and cite
`reference-validator`. An `invalid` label either cites it (the validator
rejects the value) or cites `contract-grammar` (the value passes the validator
but a contract rule rejects it).

## 3. Minimum cases per family

These come from `qualification/pii-v1.json` (`minDenominator` 4,
`minBenignCases` 6, `minBenignAxes` 3) and the #428 gate code
(`b11ViewGate`). Every required metric must be measured, never waived as
not-applicable. The same minimums apply to **each** view:

| Per view | network-address | email | payment-card | phone | iban | us-ssn |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| sensitive | ≥ 4 | ≥ 4 | ≥ 4 | ≥ 4 | ≥ 4 | ≥ 4 |
| benign (non-sensitive + not-established) | ≥ 6 | ≥ 6 | ≥ 6 | ≥ 6 | ≥ 6 | ≥ 6 |
| of which non-sensitive (authority-reserved) | ≥ 4 | ≥ 4 | ≥ 4 | ≥ 4 | 0 or ≥ 4 | 0 or ≥ 4 |
| distinct benign `axis` tags | ≥ 3 | ≥ 3 | ≥ 3 | ≥ 3 | ≥ 3 | ≥ 3 |
| twin pairs (`twinOf`) | ≥ 4 | ≥ 4 | ≥ 4 | ≥ 4 | ≥ 4 | ≥ 4 |
| minimum cases | 10 | 10 | 10 | 10 | 10 | 10 |

- The minimum is **20 cases per family** (10 per view) and **120 for all
  six**. More is better. A family you leave out is recorded unspent with the
  reason `no-sealed-corpus`.
- **Mass.** Each case weighs one unit, and nothing is renormalized. Every case
  must carry an authored label, so no mass is left without truth. In
  `benign-heavy-stress`, benign cases must outnumber sensitive cases.
- IBAN and SSN have no authority-reserved non-sensitive value in the public
  oracle, so their benign cases are normally all `not-established`. If you do
  use non-sensitive cases for them, use at least 4. One to three would leave
  that metric below its denominator and fail the gate.
- For `pii:us:ssn`, the run also scores every case under `pii:global`, where
  SSN must stay silent. No extra cases are needed for that.

## 4. Rules

- **Synthetic or authority-reserved values only.** Examples of reserved values
  are documentation address ranges, reserved example domains, published test
  card numbers, and the 555-0100 to 555-0199 phone lines. Never use a real
  person's data. Never use a live credential. Do not take values from real
  documents, even redacted ones.
- **Independent of the development plans.** Do not copy, paraphrase or mutate
  cases from the #423 oracle plans, the #424–#426 population plans, the v2
  plans, the #427 parity plan, or any fixture in this repository. Write the
  cases without looking at those files while you author.
- **Context is English or Korean only** (`pii-context/v2`). Any other language
  is outside the contract and is rejected.
- Label each case from the family contract (`docs/contracts/pii/*` in core),
  not from what the product currently does.
- Your reviewer checks every label before you seal. Sealing is your
  attestation of that review.

## 5. Commands

Run these from the repository root.

**Validate.** A dry run. It prints `PASS` and counts per family and view, or
`FAIL <code>#<case position>`. It never prints text, ids or values.

```sh
npm run pii:beta11:protected -- validate --input=holdout/generated/pii-b11-input.json
```

**Seal.** Each family gets its own one-attempt budget. The command writes
`holdout/pii-b11-<id>-seal.json` and one `holdout/pii-b11-<id>-<family>.json`
manifest per family. These hold commitments only. Commit exactly those files:

```sh
npm run pii:beta11:protected -- seal --input=holdout/generated/pii-b11-input.json --review=reviewed
git add holdout/pii-b11-*.json && git commit -m "chore(pii): seal the beta.11 protected corpus (#428)"
```

**Run** one family. The frozen beta.11 candidate is core
`8b6a5fde52ecb4dfce13f09c7a947062d21483c7` (product `main` after
redact-secret#996; its #428 record is
[`final-core-8b6a5fde.md`](../evidence/901/428/final-core-8b6a5fde.md)), and you
always pass it explicitly:

```sh
npm run pii:beta11:protected -- run --core-commit=8b6a5fde52ecb4dfce13f09c7a947062d21483c7 \
  --family=pii:global:email --seal=holdout/pii-b11-<id>-seal.json
```

A run needs all of the following:

- a clean working tree;
- the committed #428 freeze and report under `evidence/901/428/core-8b6a5fde52ec/`;
- the frozen build outputs under `results-output/pii-beta11/core-8b6a5fde52ec/`
  (gitignored; they exist in the checkout that ran the #428 freeze and
  measurement). From another checkout, add
  `--work=<that checkout>/results-output/pii-beta11` to `run`. Do not rebuild
  them: the run compares every tarball and payload hash with the committed
  freeze and refuses a mismatch.

Today every family's #428 `profile-cost` gate is `not-met` at this commit, so
`run` refuses all six with `FAIL public-gates-failed:<gates>:budget-not-spent`
(the list always includes `profile-cost`) and spends nothing. Sealing is still safe; run only after the #428 record for this commit
shows every public gate `met` for the family.

It checks every tarball, every Wasm payload (including `_pii`), the
identity-seam binary, the selectors and the `pii-context/v2` activation
identities against the freeze before it reads a byte. If a #428 public gate
for that family is already `not-met`, it refuses and does not spend the
budget.

The aggregate is written to
`evidence/901/428/core-8b6a5fde52ec/protected/<family>-aggregate-v1.json`.

**Resolve** trust. You and the reviewer read only the aggregate:

```sh
npm run pii:beta11:protected -- resolve --core-commit=8b6a5fde52ecb4dfce13f09c7a947062d21483c7 \
  --family=pii:global:email --decision=accepted --custodian=<you> --reviewer=<reviewer>
```

Use `--decision=rejected` if custody of the run is in doubt. The protected gate
then stays unresolved.

**Disposition.** This binds the runs to the #428 record:

```sh
npm run pii:beta11:protected -- disposition --core-commit=8b6a5fde52ecb4dfce13f09c7a947062d21483c7 \
  --seal=holdout/pii-b11-<id>-seal.json
```

A family becomes `provisional` only when every public gate, cost included, and
its protected run all pass. This route never produces `stable`.

## 6. One attempt, no exceptions

- A failed, crashed or interrupted run still uses the family's single attempt.
  A second run is refused.
- After a crash, first make sure no process is still running. Then delete only
  the stale `.lock` file in the epoch directory. Never edit `state.json`.
- If cases leak, are used for tuning, or change without review, mark the family
  contaminated before anything else:

  ```sh
  npm run eval:holdout -- contaminate --domain=pii --manifest=holdout/pii-b11-<id>-<family>.json --reason=exposed
  ```

  Then author new cases with a new seed and seal again (see
  [README](README.md#contamination-crashes-and-rotation)).
- A new candidate commit is a new epoch, which needs a new seal.
