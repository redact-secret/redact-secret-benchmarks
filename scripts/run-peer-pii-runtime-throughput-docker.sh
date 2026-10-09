#!/usr/bin/env bash
# #513: build the addon from a pinned product commit and run the peer PII runtime-throughput measurement.
#
#   scripts/run-peer-pii-runtime-throughput-docker.sh [--out=<repo-relative path>] [--cpus=N]
#
# REDACT_SECRET_REF defaults to benchmarks/pin-manifest.json pins.redactSecretRevision. Overriding it is
# allowed for a smoke check, but the measurement refuses to write evidence/429/ unless it equals the pin.
# On a non-amd64 Docker host (Apple Silicon) the run is emulated: it is a smoke check and cannot write evidence/429/.
set -euo pipefail
cd "$(dirname "$0")/.."

out="results-output/peer-pii-runtime-throughput/run-$(date +%s)-$$/report.json"
cpus=4
for argument in "$@"; do
  case "$argument" in
    --out=*) out="${argument#--out=}" ;;
    --cpus=*) cpus="${argument#--cpus=}" ;;
    *) echo "unrecognized argument: $argument" >&2; exit 2 ;;
  esac
done

# Validate before Docker can build or measure; normalize the bind mount to the repository.
out=$(node --input-type=module - "$out" <<'NODE'
import path from 'node:path';
import { measurementOutput } from './scripts/lib/measurement-output.mjs';
const root = process.cwd();
const target = measurementOutput(path.resolve(root, process.argv[2]), root, { directory: false });
console.log(path.relative(root, target));
NODE
)

pin=$(node -e "console.log(JSON.parse(require('fs').readFileSync('benchmarks/pin-manifest.json','utf8')).pins.redactSecretRevision)")
ref="${REDACT_SECRET_REF:-$pin}"
host_arch=$(docker info --format '{{.Architecture}}')
case "$host_arch" in x86_64|amd64) emulated=false ;; *) emulated=true ;; esac

docker build --platform linux/amd64 --build-arg "REDACT_SECRET_REF=$ref" -t peer-pii-runtime-throughput:"${ref:0:12}" .
digest=$(docker image inspect --format '{{.Id}}' peer-pii-runtime-throughput:"${ref:0:12}")

mkdir -p "$(dirname "$out")"
# The output directory is bind-mounted so the report lands on the host; benchmarks/pin-manifest.json comes from the image.
docker run --rm --platform linux/amd64 --cpus="$cpus" \
  -e "IMAGE_DIGEST=$digest" -e "CPU_LIMIT=$cpus" -e "EMULATED=$emulated" \
  -v "$(pwd)/$(dirname "$out"):/bench/$(dirname "$out")" \
  peer-pii-runtime-throughput:"${ref:0:12}" "--out=$out"
