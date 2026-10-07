## WebAssembly artifact sizes (candidate build)

Core `0c62fd38bca75c5b28b042dc79789b708ebf1d17`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `981b9aa776ee` | 682427 | 235713 | 181463 |
| common | `redact_secret_wasm_common_bg.wasm` | `1d8eaea86e90` | 479216 | 168891 | 133568 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `2d4fa12906cf` | 981328 | 359236 | 279415 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `d1df0179af9d` | 778199 | 292165 | 231450 |
