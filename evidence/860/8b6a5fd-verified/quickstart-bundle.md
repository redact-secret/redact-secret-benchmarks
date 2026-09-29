## Quickstart browser bundle (candidate build)

Core `8b6a5fde52ecb4dfce13f09c7a947062d21483c7`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11340 | 4101 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 542445 | 187246 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 833741 | 310056 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 10926 | 3115 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 10918 | 3112 |
| `index.html` | yes | 187 | 167 |
| **fetched** | | 564890 | 194626 |
| emitted (diagnostic) | | 1409557 | 507797 |
