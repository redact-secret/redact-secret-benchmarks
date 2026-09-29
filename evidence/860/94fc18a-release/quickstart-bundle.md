## Quickstart browser bundle (candidate build)

Core `94fc18a974f659ea882c89120dbf1adb3acf2f28`, vite 7.3.6. `size/browser-bundle/quickstart/gzip` is the fetched total; the emitted total is a diagnostic, not budgeted.

| File | Fetched | bytes | gzip |
| --- | --- | ---: | ---: |
| `assets/index-<hash>.js` | yes | 11340 | 4101 |
| `assets/redact_secret_wasm_bg-<hash>.wasm` | yes | 542318 | 187236 |
| `assets/redact_secret_wasm_pii_bg-<hash>.wasm` | no (lazy) | 833614 | 310041 |
| `assets/redact_secret_wasm_pii-<hash>.js` | no (lazy) | 10926 | 3114 |
| `assets/redact_secret_wasm-<hash>.js` | yes | 10918 | 3112 |
| `index.html` | yes | 187 | 166 |
| **fetched** | | 564763 | 194615 |
| emitted (diagnostic) | | 1409303 | 507770 |
