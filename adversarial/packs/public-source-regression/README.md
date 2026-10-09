# Public-source regression

These 80 fixtures are maintainer-authored regression, assembled from the licensed public sources documented in `sources.json`. They are not independently authored evaluation. The historical pack ID remains `beta9-external-inputs`; all fixture IDs, submission bytes, expectations and qualification remain unchanged. Beta.9 is introduction metadata, not the corpus purpose.

The immutable first-run trust input now lives in `adversarial/run-records/public-source-regression/first-run.json`, still validated against the SHA in the unchanged intake and adjudication. It remains an active provenance gate. The obsolete rerun and original narrative are preserved in the #875 original-byte archive described in `docs/specs/corpus-role-boundaries.md`.

Upstream attribution and licenses remain in `sources.json` and the archived original README: MIT, Apache-2.0, and BSD-3-Clause/IETF Trust Legal Provisions. Assembly is contributed under this repository's MIT license.

## Sources and licenses

| Key | Source | License |
| --- | --- | --- |
| `rfc6749`, `rfc6750`, `rfc7515`, `rfc7519`, `rfc7617`, `rfc7636`, `rfc8959`, `rfc3986` | IETF RFC example values (rfc-editor.org text) | IETF Trust Legal Provisions; code components BSD-3-Clause |
| `detect-secrets` | [Yelp/detect-secrets@5e14193](https://github.com/Yelp/detect-secrets/tree/5e141933554a0b74e7341841f318be21e895339c/tests) test cases | Apache-2.0 |
| `noseyparker` | [praetorian-inc/noseyparker@2e6e7f3](https://github.com/praetorian-inc/noseyparker/tree/2e6e7f36ce36619852532bbe698d8cb7a26d2da7/crates/noseyparker/data/default/builtin/rules) rule examples | Apache-2.0 |
| `blns` | [minimaxir/big-list-of-naughty-strings@db33ec7](https://github.com/minimaxir/big-list-of-naughty-strings/blob/db33ec7b1d5d9616a88c76394b7d0897bd0b97eb/blns.txt) | MIT |
| `trojan-source` | [nickboucher/trojan-source@e3dc153](https://github.com/nickboucher/trojan-source/tree/e3dc153fcf465f4a84424ea874ff39be29adb1f7/JavaScript) | MIT |
| `aws-cli` | [aws/aws-cli@4a54791](https://github.com/aws/aws-cli/blob/4a54791df2da35778bca1325f71b1cb0b4ba770a/awscli/examples/iam/create-access-key.rst) | Apache-2.0 |


## Evaluation scope

Use these fixtures for maintainer regression only. They are public and cannot serve as a protected holdout or support qualification. Do not tune detector features, thresholds or weights to this pack. Intake v1 evaluates whole fixtures, without a streaming chunk dimension; results describe these 80 fixtures only. Submitted expectations and raw-input adjudication remain separate and unchanged.
