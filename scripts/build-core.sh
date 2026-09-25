#!/usr/bin/env bash
# Builds core's native, browser, JavaScript, CLI and Python artifacts in one
# checkout (the paired performance run's build, #303). Its content is part of
# the baseline build cache key (#307): a change here invalidates every cached
# baseline build. Needs wasm-bindgen-cli and maturin on PATH.
set -euo pipefail
cd "$1"
npm --prefix bindings/node run build
npm run js:build
npm run wasm:build
cargo build --release --locked -p redact-secret-cli
maturin build --release --locked -m bindings/python/Cargo.toml -o dist
