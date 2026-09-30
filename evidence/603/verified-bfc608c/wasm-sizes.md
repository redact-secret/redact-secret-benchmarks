## WebAssembly artifact sizes (candidate build)

Core `bfc608cce75f79f6a5cab037d7e558ba629777f6`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `b35a5e4316f1` | 594833 | 205068 | 159608 |
| common | `redact_secret_wasm_common_bg.wasm` | `77ab9b7882a5` | 406556 | 142525 | 114080 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `18501716b3cb` | 896237 | 328857 | 257311 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `40c6071ccc83` | 708032 | 265924 | 211806 |
