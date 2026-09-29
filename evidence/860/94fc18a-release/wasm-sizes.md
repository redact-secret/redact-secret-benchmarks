## WebAssembly artifact sizes (candidate build)

Core `94fc18a974f659ea882c89120dbf1adb3acf2f28`. gzip is budgeted (`size/wasm/<profile>/gzip`); raw and brotli are recorded. PII-runtime builds: present.

| Profile | File | sha256 | raw | gzip | brotli |
| --- | --- | --- | ---: | ---: | ---: |
| full | `redact_secret_wasm_bg.wasm` | `525e2f22f981` | 542318 | 187236 | 145984 |
| common | `redact_secret_wasm_common_bg.wasm` | `6106d21b8a59` | 356349 | 127653 | 102229 |
| full-pii | `redact_secret_wasm_pii_bg.wasm` | `85c3786b313c` | 833614 | 310041 | 241536 |
| common-pii | `redact_secret_wasm_common_pii_bg.wasm` | `80af06e4a70f` | 647706 | 248432 | 199144 |
