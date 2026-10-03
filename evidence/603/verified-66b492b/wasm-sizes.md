## WebAssembly artifact sizes (candidate build)

Core `66b492bdff5e6751fc6b5409266916346ed7c723`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `d3d77f29e1c4` | 596899 | 206697 | 160685 |
| common | `redact_secret_wasm_common_bg.wasm` | `d629723dab9a` | 405667 | 142866 | 114497 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `3570a7f9e038` | 895935 | 329901 | 260256 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `db07280026d5` | 704793 | 265752 | 212315 |
