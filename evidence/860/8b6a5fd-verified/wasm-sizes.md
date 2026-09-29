## WebAssembly artifact sizes (candidate build)

Core `8b6a5fde52ecb4dfce13f09c7a947062d21483c7`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `31341087d9fa` | 542445 | 187246 | 145911 |
| common | `redact_secret_wasm_common_bg.wasm` | `55aab13d44bf` | 356476 | 127655 | 102323 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `a7831fd5dea1` | 833741 | 310056 | 242832 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `e94c03ee7470` | 647875 | 248463 | 198806 |
