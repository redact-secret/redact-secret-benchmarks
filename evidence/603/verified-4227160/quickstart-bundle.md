## Quickstart browser bundle (candidate build)

Core `4227160c4dac402d7add53d3f8fe990f693912c1`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11389 | 4123 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 594833 | 205059 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 896237 | 328866 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 11590 | 3159 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 11582 | 3154 |
| `index.html` | yes | 187 | 166 |
| **fetched** | | 617991 | 212502 |
| emitted (diagnostic) | | 1525818 | 544527 |
