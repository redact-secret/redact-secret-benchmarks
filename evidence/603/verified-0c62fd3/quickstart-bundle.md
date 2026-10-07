## Quickstart browser bundle (candidate build)

Core `0c62fd38bca75c5b28b042dc79789b708ebf1d17`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 16530 | 5510 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 682427 | 235713 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 981328 | 359236 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 12951 | 3545 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 12943 | 3541 |
| `index.html` | yes | 187 | 167 |
| **fetched** | | 712087 | 244931 |
| emitted (diagnostic) | | 1706366 | 607712 |
