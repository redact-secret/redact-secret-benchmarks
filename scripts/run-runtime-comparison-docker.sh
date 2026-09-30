#!/usr/bin/env bash
# #562 / #563: build the addon from the pinned product commit (the same image as #513) and measure every setting of
# qualification/runtime-comparison-v2.json, one container per setting (the native add-on takes one PII selection per process).
#
#   scripts/run-runtime-comparison-docker.sh [--out-dir=<repo-relative dir>] [--cpus=N]
#
# Like the #429 runner: REDACT_SECRET_REF defaults to benchmarks/pin-manifest.json pins.redactSecretRevision, the
# measurement refuses to write evidence/562/ unless it equals the pin, and a non-amd64 Docker host is emulated (a smoke
# check that cannot write evidence/562/).
set -euo pipefail
cd "$(dirname "$0")/.."

out_dir="public/results/runtime-comparison"
cpus=4
for argument in "$@"; do
  case "$argument" in
    --out-dir=*) out_dir="${argument#--out-dir=}" ;;
    --cpus=*) cpus="${argument#--cpus=}" ;;
    *) echo "unrecognized argument: $argument" >&2; exit 2 ;;
  esac
done

pin=$(node -e "console.log(JSON.parse(require('fs').readFileSync('benchmarks/pin-manifest.json','utf8')).pins.redactSecretRevision)")
ref="${REDACT_SECRET_REF:-$pin}"
host_arch=$(docker info --format '{{.Architecture}}')
case "$host_arch" in x86_64|amd64) emulated=false ;; *) emulated=true ;; esac

docker build --platform linux/amd64 --build-arg "REDACT_SECRET_REF=$ref" -t peer-pii-runtime-throughput:"${ref:0:12}" .
digest=$(docker image inspect --format '{{.Id}}' peer-pii-runtime-throughput:"${ref:0:12}")

mkdir -p "$out_dir"
for setting in default pii-global pii-global-us; do
  docker run --rm --platform linux/amd64 --cpus="$cpus" \
    -e "REDACT_SECRET_REF=$ref" -e "IMAGE_DIGEST=$digest" -e "CPU_LIMIT=$cpus" -e "EMULATED=$emulated" \
    -v "$(pwd)/$out_dir:/bench/$out_dir" \
    --entrypoint node \
    peer-pii-runtime-throughput:"${ref:0:12}" --import tsx scripts/measure-runtime-comparison.mjs "--setting=$setting" "--out=$out_dir/runtime-comparison-$setting.json"
done
