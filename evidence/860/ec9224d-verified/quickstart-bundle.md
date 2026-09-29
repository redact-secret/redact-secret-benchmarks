## Quickstart browser bundle (candidate build)

Core `ec9224d9743066fe73d6e61e9843ef52bd853833`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11340 | 4102 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 542375 | 187248 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 860700 | 318323 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 10926 | 3114 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 10918 | 3112 |
| `index.html` | yes | 187 | 166 |
| **fetched** | | 564820 | 194628 |
| emitted (diagnostic) | | 1436446 | 516065 |
