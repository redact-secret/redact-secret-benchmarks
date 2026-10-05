# Square issuance check (structure only)

Part of [#584](https://github.com/redact-secret/redact-secret-benchmarks/issues/584) (Square is added to its scope) and
[#583](https://github.com/redact-secret/redact-secret-benchmarks/issues/583). The product record recommends an issuance
check before the Square claim is final: Square disclaims length validation ("don't use token length for validation") and
its own examples disagree (an `EAAA` + 60 access token against an `EAAl` + 59 form, `sq0csp-` at 43 against 44). The
contract (`benchmarks/lib/beta8/583a.ts`) claims the stable widths under ruling Q8 (open) and leaves the conflicting
shapes unclaimed; this check is how one key the maintainer issues himself settles them.

The benchmark never asks for, receives or stores a credential. The kit is a local script the maintainer runs. It reads
the value from standard input only, keeps it in one variable, and prints and records structure only. It does not read
the value from argv, an environment variable or a file, does not echo or log it, and refuses a command line that carries a
bare word. Every record says `rawValueRetained: false`.

## What it records

For each role: total length, body length after the prefix, alphabet classes (`lower`, `upper`, `digit`, `mixed-ascii`),
which special characters occur (`underscore`, `hyphen`, `plus`, `equals`, `slash`, `dot`), a prefix class from the fixed
public vocabulary (`EAAA`, `EAAl`, `EQAA`, `sq0csp-`, `sandbox-sq0csb-`, `sq0atp-`, else `other` with no text), and which
claimed or unclaimed shape matches. The `observation` field has exactly the fields of an empirical observation
(`benchmarks/support/empirical.ts`, the shape of the #526 issuance records), so it can be copied into
`benchmarks/support/empirical-observations.json` once the family is qualified empirically.

| Role | Settles |
| --- | --- |
| `access-token` | total length (expect 64), whether `+`, `=`, `_` or `-` occur |
| `sandbox-access-token` | whether the sandbox access token also starts with `EAAA` |
| `refresh-token` | whether `EQAA` is a real prefix or a placeholder edit, and its length |
| `oauth-secret-production` | whether the `sq0csp-` body is 43 or 44 characters |
| `oauth-secret-sandbox` | whether the `sandbox-sq0csb-` body is 43 characters |

## Checklist (the maintainer runs this)

1. In the Square developer dashboard, create or open an application and issue one key for the role (a production or
   sandbox access token, a refresh token through the OAuth flow, or the OAuth application secret). Use a throwaway
   application; do not use a key that guards real seller data.
2. Copy the value to the clipboard. **Revoke or rotate it in the dashboard now.** The value stays in your clipboard, and
   only its structure is needed, so nothing live is measured.
3. Run the command below for that role with `--revoked-after-observation=true`. On a terminal the input is hidden; paste
   the value and press Enter. Or pipe it from the clipboard (`pbpaste | npm run issuance:square -- ...`), which keeps it out
   of shell history.
4. Clear the clipboard (`pbcopy < /dev/null`) and the terminal scrollback.
5. Paste the printed structure (no value) into a comment on #584. With `--record=benchmarks/support/issuance-records/square.json`
   the same record is written into that file, replacing the role's `pending issuance by the maintainer` entry.

```sh
# one role at a time; --issued-at is the day you issued the key
npm run issuance:square -- --role=access-token --issued-at=YYYY-MM-DD \
  --revoked-after-observation=true \
  --record=benchmarks/support/issuance-records/square.json
```

Roles: `access-token`, `sandbox-access-token`, `refresh-token`, `oauth-secret-production`, `oauth-secret-sandbox`. Optional
flags: `--observed-at=YYYY-MM-DD`, `--issuance-route="..."`, `--subject-id=subject-<label>` (a label, never an account identifier). Any other argument, including a bare
word, fails with `invalid-arguments-the-value-is-read-from-stdin-only` and echoes nothing.

## After the result

A role's result decides a field of the Square contract, never a fixture by itself:

- `access-token` length 64 and the claimed alphabet: the `body-length` and `alphabet` fields stay `frozen`; a `+` or `=` makes
  the alphabet twins in `beta8-583a` assert a property the provider does not hold (re-author them).
- `EAAl` 63 or `EQAA` 64 confirmed as real prefixes: author them as claimed shapes (a new field and positives) and drop them
  from `DISPUTED_PROPERTIES`; a placeholder edit confirms they stay unclaimed.
- `sq0csp-` 43 or 44 only: the union narrows to the issued width, and the other becomes unclaimed.

Until the maintainer runs the check, every role in `benchmarks/support/issuance-records/square.json` reads
`pending issuance by the maintainer`, and #584 stays open.
