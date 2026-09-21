# Author PyPI macaroon positives synthetically

Date: 2026-09-21 · Status: accepted

## Context

[Issue #104](https://github.com/redact-secret/redact-secret-benchmarks/issues/104)
asked a decision, not a fixture-authoring question, per `AGENTS.md`'s
unconditional security boundary: can a synthetic value be constructed that is
structurally faithful enough to earn a T1 `pypi-token` positive — correct
prefix, correct serialisation, well-formed caveat structure, a signature
chain of the right shape — while being unmistakably non-credential and
unusable? [#107](https://github.com/redact-secret/redact-secret-benchmarks/issues/107)
("E1: fill the PyPI evidence gap") is blocked on this answer and owns the
actual fixture, twin pairs and benign controls; this record does not author
any of those.

The existing contract (`benchmarks/lib/assessment.ts`, `pypi-token`) already
carries a T1 tier and a `providerSource`, but its `review` explains why no
positive has ever been scored: "Existing pypi- plus 90 arbitrary characters
lacks the encoded macaroon prefix and structure." `classifyFixture` special-
cases `pypi-token` to `policy` for exactly this reason
(`benchmarks/lib/assessment.ts:255`).

## Decision: yes

A synthetic value meeting all three of the issue's tests was constructed and
verified against the real, pinned scanner binaries this repository runs
(`scanners/index.mjs`). Detailed evidence and the construction rule follow.
This decision does not itself change `assessment.ts`, `taxonomy.json`, or any
`fixtures/generated/*` file — wiring the positive in, and building its twin
pairs and benign controls, is #107's acceptance criteria.

## Provider evidence

Two independent PyPI-owned sources agree on the shape:

- `pypi.org/help/#apitoken` (the contract's existing `providerSource`): set
  the password to the token value "including the `pypi-` prefix"; "Advanced
  users may wish to inspect their token by decoding it with base64, and
  checking the output against the unique identifier displayed on PyPI" — the
  identifier inside the macaroon is meant to be inspectable, not itself a
  secret.
- **New**, more precise: `pypi/warehouse`'s own published docs,
  `docs/user/api/secrets.md` (rendered at
  [docs.pypi.org/api/secrets](https://docs.pypi.org/api/secrets/), fetched
  2026-09-21):

  > A PyPI API token is a string consisting of a prefix (`pypi`), a separator
  > (`-`) and a string representing a Macaroon `base64` serialized with
  > [PyMacaroon](https://pymacaroons.readthedocs.io/):
  >
  > `pypi-[A-Za-z0-9-_]{85,}`
  >
  > The `base64` string will not be shorter than 85 characters. A token can
  > be arbitrarily long because we may add arbitrary caveats to the
  > serialized Macaroon.

  This page exists specifically so third parties (GitHub, deps.dev) can
  detect and report leaked PyPI tokens — it is a detection-format
  specification, not incidental documentation, and settles scope item 1 with
  an exact regex and a named serialization library.

## What the pinned detectors actually key on (scope item 2)

- **trufflehog 3.97.4**, `pkg/detectors/pypi/pypi.go`:
  `keyPat = regexp.MustCompile("(pypi-AgEIcHlwaS5vcmcCJ[a-zA-Z0-9-_]{150,157})")`.
  `FromData` only runs this regex; the HMAC/signature chain is never
  recomputed. A live check exists (`verifyMatch`, a POST to
  `upload.pypi.org/legacy/`) but only runs when the caller passes
  `verify: true` — this repo's own invocation
  (`scanners/index.mjs`'s `trufflehogArguments`) passes
  `--no-verification`, so that path never executes in this corpus's scoring.
- **gitleaks 8.30.1**, `config/gitleaks.toml:2809` (`pypi-upload-token`):
  `regex = '''pypi-AgEIcHlwaS5vcmc[\w-]{50,1000}'''`. Gitleaks has no
  verification step for any rule.
- **flare-redact 1.6.1** (`spec/detectors.json`, the product this repo scores
  as primary): carries no `pypi` detector among its 81 entries at all. This
  is a pre-existing, separately-tracked coverage gap in the product itself —
  unrelated to whether a synthetic positive *can* be authored, and out of
  scope for this decision.

Decoding the literal segment both tools require (`AgEIcHlwaS5vcmc`, right
after `pypi-`) gives exactly `02 01 08 'pypi.org' 02`. That is
[libmacaroons](https://github.com/rescrv/libmacaroons/blob/master/doc/format.txt)'
documented v2 binary framing, field for field:

```
macaroon: VERSION opt_location IDENTIFIER EOS caveats EOS SIGNATURE
field    = varuint64(type) varuint64(length) content
LOCATION=1  IDENTIFIER=2  VID=4  SIGNATURE=6
```

`02`=VERSION, `01 08 "pypi.org"`=a LOCATION field, then `02`=the start of the
IDENTIFIER field. trufflehog's regex goes one base64 character further
(`...vcmcCJ`) than gitleaks's (`...vcmc`); that extra character (`J`)
constrains the IDENTIFIER field's length byte to 36–39, i.e. every real token
trufflehog has seen carries a 36–39-byte identifier — consistent with PyPI's
own "unique identifier displayed on PyPI" being a UUID (36 characters).

**Conclusion for scope item 2**: neither pinned tool verifies the signature
chain by default. Both are closed-form regexes over the outer envelope
(fixed prefix, one literal segment, a length window). A structurally
faithful envelope is sufficient; a live, cryptographically valid HMAC chain
is not required. This directly answers the issue's central question: yes.

## Constructing a candidate (scope item 3)

Deterministic algorithm, no live PyPI dependency and no macaroon-signing key
of any kind:

1. **Identifier** — the RFC 4122 Nil UUID, `00000000-0000-0000-0000-000000000000`
   (36 bytes: the length real tokens use, but a reserved sentinel no
   provider issues as a live per-token id).
2. **One first-party caveat** — the literal ASCII string
   `permission=synthetic-benchmark-fixture` (38 bytes): plain text the
   moment the base64 is decoded, naming itself as a fixture.
3. **Signature** — 32 bytes from this project's own `synthetic()` convention
   (`fixtures/generated/build.mjs`): repeated `SHA-256("secret-benchmark:
   never-issued:v2:<label>:<block>")`, truncated to 32 bytes. Never an HMAC,
   never derived from any PyPI key, mathematically incapable of verifying.
4. **Assemble** the libmacaroons v2 binary body:
   `VERSION(0x02) LOCATION("pypi.org") IDENTIFIER(nil-UUID) EOS
   CAVEAT(cid=permission=...) EOS EOS SIGNATURE(32 synthetic bytes)`,
   each field as `varuint(type) varuint(length) content`.
5. `"pypi-" + base64.urlsafe_b64encode(body).rstrip("=")`.

```python
def field(type_, content):            # varuint(type) varuint(len) content
    return bytes([type_, len(content)]) + content

body  = bytes([0x02])                                          # VERSION
body += field(1, b"pypi.org")                                  # LOCATION
body += field(2, b"00000000-0000-0000-0000-000000000000")      # IDENTIFIER
body += bytes([0x00])                                          # EOS (header)
body += field(2, b"permission=synthetic-benchmark-fixture")    # caveat cid
body += bytes([0x00, 0x00])                                    # EOS, EOS
body += field(6, synthetic_bytes("pypi-token:e0-candidate:signature", 32))
token = "pypi-" + base64.urlsafe_b64encode(body).rstrip(b"=").decode()
```

Resulting candidate (168-character body):

```
pypi-AgEIcHlwaS5vcmcCJDAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMAACJnBlcm1pc3Npb249c3ludGhldGljLWJlbmNobWFyay1maXh0dXJlAAAGIKWVxIcuChOJhvYbYYY22gYqXUn-MYEonQk9DJQfl_F_
```

Decoded (base64url), byte for byte:

```
\x02\x01\x08pypi.org\x02$00000000-0000-0000-0000-000000000000\x00&permission=synthetic-benchmark-fixture\x00\x00\x06 <32 SHA-256 filler bytes>
```

Every human-readable byte says "synthetic" or "never-issued"; the trailing
32 bytes are hash output, not a macaroon signature.

## Verification against the real, pinned tools — not just their regexes

Ran the exact binaries this repo pins, with the exact flags
`scanners/index.mjs` uses, against a file containing the candidate:

```
$ gitleaks version        # 8.30.1 (pinned)
$ trufflehog --version    # 3.97.5 (pinned: 3.97.4; regex unchanged between these patch releases)

$ echo 'TWINE_PASSWORD=pypi-AgEIcHlwaS5vcmc...' > sample.txt

$ gitleaks dir . --no-banner --no-color --exit-code 0 --report-format json --report-path -
# → RuleID "pypi-upload-token", full candidate string as Secret

$ trufflehog filesystem . --json --no-verification --no-update --results=verified,unknown,unverified
# → DetectorName "PyPI", Verified:false (no verification attempted, as expected),
#   SecretParts.key = full candidate string
```

Both real scanners flag the candidate exactly as constructed. trufflehog
reports `Verified:false`, matching the fact that this is not a real
credential (and matching this corpus's `--no-verification` invocation, which
never attempts the live check regardless).

The three properties the issue asks to confirm:

- **(a) matched by the detector** — confirmed directly above against both
  pinned tools' actual binaries, not just their published patterns.
  flare-redact has no `pypi` detector to check against (pre-existing,
  unrelated gap, noted above).
- **(b) unmistakably synthetic to a human reader** — the identifier is the
  reserved Nil UUID; the sole caveat literally reads
  `permission=synthetic-benchmark-fixture`; both are plain ASCII once
  base64-decoded, with no obfuscation.
- **(c) inert** — the signature is SHA-256 filler with no relationship to
  any PyPI signing key; it cannot authenticate against `pypi.org`.
  trufflehog's own live check would receive PyPI's 403 (invalid key) if it
  ever ran, though nothing in this corpus's scoring path calls it.

## Lexical separability (scope item 4)

Per `docs/decisions/2026-09-21-check-lexical-separability.md`, the check
only ever compares a `must-redact` positive's frozen `pattern` against
`must-not-flag` fixtures declaring the *same* contract. `pypi-token`
currently has three (`fixtures/generated/detector-coverage.mjs`:
`pypi-token-mask`, `pypi-token-reference`, `pypi-token-label-prose`).
Searched the fixture and benchmark source trees directly for the candidate's
distinguishing literal (`AgEIcHlwaS5vcmc`): zero matches anywhere in the
corpus today. No collision exists. This must be re-run once #107 actually
adds a positive and its `pattern` — this check is corpus-wide, not a
one-time guarantee about a single string.

## Consequences

- #107 proceeds at full scope: a positive built by this algorithm (or an
  equivalent construction meeting the same three properties), plus twin
  pairs and benign-axis controls, per its own acceptance criteria.
- A twin for this family should mutate the fixed envelope — the
  `AgEIcHlwaS5vcmc` literal segment or the `{85,}`/tool length floors, the
  same "mutate at/inside the boundary the contract actually checks" pattern
  already used for `aws-access-key`'s `AIDA` prefix twin and other T1
  families in `detector-coverage.mjs` — not the caveat or identifier
  content, which real tokens make attacker-controllable and which therefore
  carries no discrimination signal.
- flare-redact 1.6.1 has no `pypi` detector; the product itself will not
  flag this family regardless of fixture quality. That is a separate,
  already-implicit per-tool coverage gap and is unaffected by this decision.
- No plaintext or real-derived credential material appears anywhere in this
  record: the identifier is a reserved RFC 4122 sentinel, the caveat is a
  literal English sentence, and the signature is deterministic hash output.

## Not verified here

- The candidate has not been added to `fixtures/generated/*`; #107 owns
  authoring the scored fixture and its own `npm run fixtures:check` /
  `npm test` pass.
- trufflehog's *live* verification path (`verifyMatch`, an HTTP call to
  `upload.pypi.org`) was not exercised — it is off by design in this
  corpus's tooling and would only ever confirm the (already obvious) fact
  that the candidate is not a real credential.
