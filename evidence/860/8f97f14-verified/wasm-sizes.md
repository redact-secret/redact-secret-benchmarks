## WebAssembly artifact sizes (candidate build)

Core `8f97f14d97d73b76602e5396eea35d0a5a4f0eb3`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `650b7b5a8f05` | 534232 | 184422 | 144287 |
| common | `redact_secret_wasm_common_bg.wasm` | `bb99d2ef84a3` | 348254 | 125295 | 100561 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `49edb63c7469` | 819740 | 305065 | 238306 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `792467d1dc28` | 633823 | 243752 | 195663 |
