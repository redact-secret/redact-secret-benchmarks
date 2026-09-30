## WebAssembly artifact sizes (candidate build)

Core `4fb78827f1ddf5b3106f25130ca510a836ada186`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `bede377a6007` | 594022 | 205227 | 158274 |
| common | `redact_secret_wasm_common_bg.wasm` | `8db4e2232f51` | 380851 | 136250 | 108877 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `e35e9a153ea2` | 885354 | 326932 | 254873 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `fa6a5f7effbc` | 672245 | 257240 | 205204 |
