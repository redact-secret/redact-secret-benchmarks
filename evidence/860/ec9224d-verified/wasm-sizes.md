## WebAssembly artifact sizes (candidate build)

Core `ec9224d9743066fe73d6e61e9843ef52bd853833`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `755e54945864` | 542375 | 187248 | 145820 |
| common | `redact_secret_wasm_common_bg.wasm` | `587c97576971` | 356406 | 127661 | 102415 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `fba443d4ad4d` | 860700 | 318323 | 247322 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `3cea06de4935` | 674876 | 256694 | 204880 |
