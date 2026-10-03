## Quickstart browser bundle (candidate build)

Core `66b492bdff5e6751fc6b5409266916346ed7c723`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11614 | 4195 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 596899 | 206697 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 895935 | 329901 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 11590 | 3159 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 11582 | 3155 |
| `index.html` | yes | 187 | 167 |
| **fetched** | | 620282 | 214214 |
| emitted (diagnostic) | | 1527807 | 547274 |
