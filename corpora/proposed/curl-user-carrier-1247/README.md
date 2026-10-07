# curl -u / --user carrier corpus (redact-secret#1247)

Independent, scanner-free corpus for the product decision on whether the password
component of `curl -u user:pass` is read. It is authored before any reader exists and
is not the implementer's work. Each expected outcome comes from curl's documented
argument semantics (the password is the text after the first colon; no colon means
curl prompts), never from scanner output.

- `cases.mjs`: 128 cases built at run time from public SHA-256 seeds; no secret-shaped
  literal is stored. 48 `must-redact` (password span only), 70 `must-not-flag`, 10
  `accepted-fn` (stated false negatives: curlrc, argument arrays, other tools,
  unterminated quote, over-bound password, nested escaped quotes).
- Offsets are UTF-16 code units plus UTF-8 bytes, end exclusive.
- Not registered in `benchmarks/categories.json` or any manifest, so it does not enter
  normal evaluation or the pin manifest. Registration (a category, `fixture-detectors.json`
  rows, an assessment rule, a generated-corpora hash) is the stage-3 step after the
  product reader lands.
- `tests/curl-user-carrier-1247.test.mjs` checks structure only.
