## Quickstart browser bundle (candidate build)

Core `bfc608cce75f79f6a5cab037d7e558ba629777f6`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11389 | 4125 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 594833 | 205068 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 896237 | 328857 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 11590 | 3159 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 11582 | 3155 |
| `index.html` | yes | 187 | 167 |
| **fetched** | | 617991 | 212515 |
| emitted (diagnostic) | | 1525818 | 544531 |
