## WebAssembly artifact sizes (candidate build)

Core `99c8c2b33e99142620bcc66f115200ca615d6d0a`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `a2d40a9314df` | 585454 | 203748 | 157589 |
| common | `redact_secret_wasm_common_bg.wasm` | `bfcafee3091f` | 387442 | 137650 | 109932 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `6ad05277534c` | 877251 | 326377 | 254895 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `3333504b3d7b` | 679317 | 259264 | 207362 |
