## WebAssembly artifact sizes (candidate build)

Core `1db8ff38b16e50c51229eb27025452952bf621e1`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `7fdf0739a17e` | 521777 | 179388 | 140653 |
| common | `redact_secret_wasm_common_bg.wasm` | `4f6a4ff3efaf` | 341247 | 122544 | 98489 |
