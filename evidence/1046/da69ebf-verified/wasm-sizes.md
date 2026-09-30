## WebAssembly artifact sizes (candidate build)

Core `da69ebf5090e0fb9519eb07829ff46001ede0de2`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `fd178354d50f` | 586043 | 203957 | 157736 |
| common | `redact_secret_wasm_common_bg.wasm` | `9cf0d916d890` | 388115 | 137879 | 109986 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `796d1ca7cb29` | 877840 | 326601 | 255363 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `2075bbfe099d` | 679992 | 259512 | 206711 |
