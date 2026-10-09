#!/usr/bin/env bash
# #562 / #563: build the addon from the pinned product commit (the same image as #513) and measure every setting of
# qualification/runtime-comparison-v2.json, one container per setting (the native add-on takes one PII selection per process).
#
#   scripts/run-runtime-comparison-docker.sh [--out-dir=<repo-relative dir>] [--cpus=N] [--source=published|local-build]
#
# --source=published (the default, #562): measure the @redact-secret/core release package.json pins (npm ci installs it; nothing
# is built from product source). The container runs natively on the Docker host's architecture, so an arm64 host is not an
# emulated run; set HOST_CPU_MODEL to name the machine when the container only sees a virtual CPU. --source=local-build: the
# original mode below, an add-on built from the pinned product commit.
#
# Like the #429 runner: REDACT_SECRET_REF defaults to benchmarks/pin-manifest.json pins.releaseSourceRevision (the published package's source commit; #583 lets the registry pin sit ahead of it), the
# measurement refuses to write evidence/562/ unless it equals the pin, and a non-amd64 Docker host is emulated (a smoke
# check that cannot write evidence/562/).
set -euo pipefail
cd "$(dirname "$0")/.."

out_dir="results-output/runtime-comparison/run-$(date +%s)-$$"
cpus=4
source_mode="published"
for argument in "$@"; do
  case "$argument" in
    --out-dir=*) out_dir="${argument#--out-dir=}" ;;
    --cpus=*) cpus="${argument#--cpus=}" ;;
    --source=*) source_mode="${argument#--source=}" ;;
    *) echo "unrecognized argument: $argument" >&2; exit 2 ;;
  esac
done
case "$source_mode" in published|local-build) ;; *) echo "--source must be published or local-build" >&2; exit 2 ;; esac

# Validate before Docker can build or measure; normalize the bind mount to the repository.
out_dir=$(node --input-type=module - "$out_dir" <<'NODE'
import path from 'node:path';
import { measurementOutput } from './scripts/lib/measurement-output.mjs';
const root = process.cwd();
const target = measurementOutput(path.resolve(root, process.argv[2]), root, { directory: true });
console.log(path.relative(root, target));
NODE
)

pin=$(node -e "console.log(JSON.parse(require('fs').readFileSync('benchmarks/pin-manifest.json','utf8')).pins.releaseSourceRevision)")
ref="${REDACT_SECRET_REF:-$pin}"
host_arch=$(docker info --format '{{.Architecture}}')
case "$host_arch" in x86_64|amd64) native=linux/amd64 ;; aarch64|arm64) native=linux/arm64 ;; *) native="" ;; esac

if [ "$source_mode" = published ]; then
  [ -n "$native" ] || { echo "unsupported Docker host architecture: $host_arch" >&2; exit 2; }
  platform="$native"; emulated=false; target=(--target published)
  tag="peer-pii-runtime-throughput:published-${ref:0:12}"
  entry=(--source=published)
else
  platform=linux/amd64; target=(); tag="peer-pii-runtime-throughput:${ref:0:12}"; entry=(--source=local-source-build)
  case "$host_arch" in x86_64|amd64) emulated=false ;; *) emulated=true ;; esac
fi

docker build --platform "$platform" ${target[@]+"${target[@]}"} --build-arg "REDACT_SECRET_REF=$ref" -t "$tag" .
digest=$(docker image inspect --format '{{.Id}}' "$tag")

mkdir -p "$out_dir"
for setting in default pii-global pii-global-us; do
  docker run --rm --platform "$platform" --cpus="$cpus" \
    -e "REDACT_SECRET_REF=$ref" -e "IMAGE_DIGEST=$digest" -e "CPU_LIMIT=$cpus" -e "EMULATED=$emulated" -e "HOST_CPU_MODEL=${HOST_CPU_MODEL:-}" \
    -v "$(pwd)/$out_dir:/bench/$out_dir" \
    --entrypoint node \
    "$tag" --import tsx scripts/measure-runtime-comparison.mjs "--setting=$setting" "--out=$out_dir/runtime-comparison-$setting.json" "${entry[@]}"
done
