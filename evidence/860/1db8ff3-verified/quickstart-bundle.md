## Quickstart browser bundle (candidate build)

Core `1db8ff38b16e50c51229eb27025452952bf621e1`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11340 | 4103 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 521777 | 179383 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 807882 | 299226 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 10926 | 3114 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 10918 | 3111 |
| `index.html` | yes | 187 | 164 |
| **fetched** | | 544222 | 186761 |
| emitted (diagnostic) | | 1363030 | 489101 |
