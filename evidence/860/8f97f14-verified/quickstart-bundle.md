## Quickstart browser bundle (candidate build)

Core `8f97f14d97d73b76602e5396eea35d0a5a4f0eb3`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11340 | 4102 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 534232 | 184422 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 819740 | 305065 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 10926 | 3115 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 10918 | 3113 |
| `index.html` | yes | 187 | 164 |
| **fetched** | | 556677 | 191801 |
| emitted (diagnostic) | | 1387343 | 499981 |
