## WebAssembly artifact sizes (candidate build)

Core `4227160c4dac402d7add53d3f8fe990f693912c1`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `53a20c055f82` | 594833 | 205059 | 159365 |
| common | `redact_secret_wasm_common_bg.wasm` | `36be6a2d0a04` | 406556 | 142515 | 114074 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `dc36e7cff37d` | 896237 | 328866 | 257476 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `b3c139618aad` | 708082 | 265950 | 211990 |
