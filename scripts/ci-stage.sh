#!/usr/bin/env bash
# Run one workflow stage and append "<name>\t<seconds>\t<exit>" to $STAGE_TIMINGS (#707), so the job summary can report
# per-stage timings even when the stage fails. The stage's own exit status is preserved. Usage: ci-stage.sh <name> -- <command...>
set -u
name="$1"; shift
[ "${1:-}" = "--" ] && shift
start=$(date +%s)
"$@"
status=$?
if [ -n "${STAGE_TIMINGS:-}" ]; then printf '%s\t%s\t%s\n' "$name" "$(( $(date +%s) - start ))" "$status" >> "$STAGE_TIMINGS"; fi
exit "$status"
