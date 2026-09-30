## Quickstart browser bundle (candidate build)

Core `4fb78827f1ddf5b3106f25130ca510a836ada186`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11340 | 4102 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 594022 | 205227 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 885354 | 326932 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 10926 | 3115 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 10918 | 3112 |
| `index.html` | yes | 187 | 168 |
| **fetched** | | 616467 | 212609 |
| emitted (diagnostic) | | 1512747 | 542656 |
