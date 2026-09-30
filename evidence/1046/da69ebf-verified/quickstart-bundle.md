## Quickstart browser bundle (candidate build)

Core `da69ebf5090e0fb9519eb07829ff46001ede0de2`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11340 | 4101 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 586043 | 203957 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 877840 | 326601 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 10926 | 3114 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 10918 | 3112 |
| `index.html` | yes | 187 | 165 |
| **fetched** | | 608488 | 211335 |
| emitted (diagnostic) | | 1497254 | 541050 |
