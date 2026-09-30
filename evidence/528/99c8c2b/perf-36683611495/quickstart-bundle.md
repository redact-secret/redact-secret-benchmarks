## Quickstart browser bundle (candidate build)

Core `99c8c2b33e99142620bcc66f115200ca615d6d0a`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11340 | 4101 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 585454 | 203748 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 877251 | 326377 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 10926 | 3115 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 10918 | 3112 |
| `index.html` | yes | 187 | 169 |
| **fetched** | | 607899 | 211130 |
| emitted (diagnostic) | | 1496076 | 540622 |
