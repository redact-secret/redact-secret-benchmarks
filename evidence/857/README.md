# Evidence: redact-secret#857, bounded T3 credential policy qualification

**Result:** PARTIAL PASS on the frozen candidate. Connection-string passwords, OTP seeds, and bounded assignment literals pass every `credential-policy-v1` gate and classify as `Stable · Policy qualified`; Bearer credentials remain provisional because the single-use protected holdout recorded one unresolved failure. All four remain `T3` with `evidenceBasis: project-policy`.

This is the final benchmark evidence for
[redact-secret#857](https://github.com/redact-secret/redact-secret/issues/857)
and [redact-secret-benchmarks#365](https://github.com/redact-secret/redact-secret-benchmarks/issues/365).
The profile is a credential-policy track and makes no PII qualification claim.
No raw protected fixture, seed, matched value, statistical score, weight,
probability, or evasion-enabling threshold is recorded here.

## Source revisions and artifacts

| Item | Identity |
| --- | --- |
| Published baseline product | `@redact-secret/core@0.1.0-beta.9`, measured from clean product revision `266204c87126a9de2c0ff28e7913bccabebd1d98` |
| Published baseline benchmark | clean `f73a5f717481ecc863965477f6306329788d1f1b` |
| Frozen candidate product | clean `de8526146fd8f11c884f79f26e91f1e2f4ae3faa` |
| Frozen candidate benchmark | clean `b1f685d127532481d68a8d77414750b332f277a9` |
| Core candidate tarball | sha256 `51fc3d78f24ed5c13d7460c25627476e1751a71c511ce51bd1fe6cfd69047664` |
| Native candidate tarball | sha256 `ca5774f0248c722cdcdae16991f6ed19c74794b7402df3c7bf8968f69f97bf65` |
| WASM candidate tarball | sha256 `9784a4bddbb0cd5bffb290b57a5d6fe9df4642b7148abe0713c978ffcb7c2375` |
| Candidate set identity | sha256 `0cbb7e773ac387d864a73ada005464bbbaba59a9184bced7a19a15a947272361` |

The candidate product commit changes the public contract documentation, not
detector code. The separate candidate build still matters: it freezes the
exact product revision against which public conformance and the protected
holdout were judged.

## Scanner pins

| Scanner | Version / mode |
| --- | --- |
| redact-secret baseline | published `@redact-secret/core@0.1.0-beta.9` |
| redact-secret candidate | isolated npm tarballs above, declared `0.1.0-beta.9`, candidate mode |
| Gitleaks | `8.30.1` |
| TruffleHog | `3.97.4` (provisioned pin; the host's `3.97.6` was rejected before measurement) |
| flare-redact | `1.6.1` |

## Before and after

`P/A` is positive cases / positive context axes; `B/A` is independent benign
cases / benign axes. Actions are `warn/redact/block`; false alarms use the
same action order. Exact-span counts exclude controls. The baseline profile
view was computed on the clean baseline corpus before the new public
conformance corpus; the old released classifier still kept every T3 family
provisional because no policy-qualified route existed.

| Family | Baseline evidence | Candidate evidence | Protected holdout | Classification |
| --- | --- | --- | --- | --- |
| Bearer credential | P/A `14/11`; B/A `18/7`; twins `13`; exact `14/14`; actions `0/14/0`; FA `0/0/0` | P/A `16/13`; B/A `19/8`; twins `14`; exact `16/16`; actions `0/16/0`; FA `0/0/0`; public conformance `4/4` | 4 cases; exact `1/1`; action mismatches `0`; failures `1` | `Provisional` → `Provisional`; failed `policy.protected-holdout` |
| Connection-string password | P/A `24/4`; B/A `15/4`; twins `15`; exact `24/24`; actions `0/24/0`; FA `0/0/0` | P/A `26/6`; B/A `16/5`; twins `16`; exact `26/26`; actions `0/26/0`; FA `0/0/0`; public conformance `4/4` | 5 cases; exact `1/1`; action mismatches `0`; failures `0` | `Provisional` → `Stable · Policy qualified` |
| OTP seed | P/A `6/1`; B/A `5/1`; twins `6`; exact `6/6`; actions `0/6/0`; FA `0/0/0` | P/A `9/4`; B/A `8/4`; twins `7`; exact `9/9`; actions `0/9/0`; FA `0/0/0`; public conformance `7/7` | 5 cases; exact `2/2`; action mismatches `0`; failures `0` | `Provisional` → `Stable · Policy qualified` |
| Assignment literal | P/A `41/11`; B/A `75/17`; twins `9`; exact `41/41`; actions `4/37/0`; FA `0/0/0` | P/A `43/13`; B/A `76/18`; twins `10`; exact `43/43`; actions `5/38/0`; FA `0/0/0`; public conformance `4/4` | 5 cases; exact `2/2`; action mismatches `0`; failures `0` | `Provisional` → `Stable · Policy qualified` |

The candidate support report covers 9,347 cases and classifies 74 detected
families: candidate-mode distribution `66 stable / 7 provisional / 1 pending /
0 unsupported`, with stable profiles `39 documented / 24 empirical / 3 policy
qualified`. The generated 108-family taxonomy matrix is `83 stable / 7
provisional / 1 pending / 17 unsupported`. Previously stable families remain
stable. The candidate gate also reports zero required-positive misses on the
150-case fixed corpus, and zero required-positive misses plus zero policy
misses across 358 policy spans on the 2,859-case expanded corpus.

## Protected holdout

The independent custodian sealed 19 deterministic synthetic cases (6
positive, 13 controls, 4 context/value twins) before opening the corpus to the
frozen candidate. Run `6fe6752c-f05c-43b4-8cf5-28800b2b5681`, corpus sha256
`373bc5c0d0270b2c94f824a29e163c804a1bb66f9ccd344b97b5a442b64cae2c`,
and plan sha256
`3baa992bbce59a3ce524b794b2c55dbbdaacfb931138d960b8a921d201c05fee`
completed with all four scanners and consumed the only allowed run. The
aggregate contains no case contents. Bearer's one failure is intentionally
not diagnosed or tuned against; it is the reason that family remains
provisional.

## Commands

Run from a clean checkout of benchmark revision `b1f685d127532481d68a8d77414750b332f277a9`.
`CANDIDATE_DIR` must contain the three tarballs whose hashes are listed above,
and `HOLDOUT_RECEIPT` must be the custodian-issued aggregate receipt bound to
the two frozen revisions.

```sh
npm ci
npm run peers:provision
export PATH="$PWD/.peer-bin:$PATH"
trufflehog --version # must print 3.97.4

# Published beta.9 baseline on f73a5f717481ecc863965477f6306329788d1f1b:
npm run eval:classify -- --output=results-output/365-baseline-support-status.json

# Frozen candidate classification and support matrix:
npm run eval:classify -- \
  --output=results-output/support-status-857-final.json \
  --policy-holdout-report="$HOLDOUT_RECEIPT" \
  --candidate-package="$CANDIDATE_DIR/redact-secret-core-0.1.0-beta.9.tgz" \
  --candidate-node-package="$CANDIDATE_DIR/redact-secret-node-darwin-arm64-0.1.0-beta.9.tgz" \
  --candidate-wasm-package="$CANDIDATE_DIR/redact-secret-wasm-0.1.0-beta.9.tgz" \
  --candidate-source-commit=de8526146fd8f11c884f79f26e91f1e2f4ae3faa
npm run eval:matrix -- \
  --input=results-output/support-status-857-final.json \
  --output=results-output/support-matrix-857-final.json
```

The protected holdout command is not repeatable: its single-run budget is a
deliberate anti-tuning control. Its aggregate receipt can be revalidated and
consumed by classification without reopening protected bytes.

## Verification

- targeted policy and candidate-adapter tests: 15 passed;
- full benchmark test suite: 741 passed;
- typecheck and build: passed;
- Decisions validation: 0 errors;
- fixture/index/pin/profile drift, review ledger, decision queue, support UI,
  and repository diff checks: passed;
- product documentation links, reachability, decision validation, support
  matrix check, detector inventory/docs, and repository diff check: passed;
- product governed fixture references: 23/23 resolve;
- product candidate: fixed 150 and expanded 2,859 gates passed as described
  above.

## Limitations

- Bearer carrier syntax is grounded in the RFC, but value length, padding,
  and free-text choices remain project policy; the protected failure prevents
  a stable claim.
- Connection-string qualification covers only the enumerated schemes,
  userinfo value boundary, and Redis password-only form. Azure `AccountKey`
  is excluded as a separate future claim.
- OTP qualification covers the bounded `otpauth://totp` / `hotp` envelope,
  first `secret` parameter, and the project's uppercase Base32/minimum-length
  policy; it does not claim arbitrary OTP material.
- Assignment qualification covers only named fields, supported operators,
  and direct literals. References, placeholders, and arbitrary assignments
  are excluded; high-signal names resolve to `redact`, while the bounded
  ambiguous set resolves to `warn`. No case resolves to `block`.
