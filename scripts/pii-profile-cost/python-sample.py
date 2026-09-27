#!/usr/bin/env python3
import base64
import gc
import importlib
import json
import os
import sys
import time
import tracemalloc


def elapsed(operation):
    started = time.perf_counter()
    result = operation()
    return (time.perf_counter() - started) * 1000.0, result


def rss_bytes(field):
    try:
        with open("/proc/self/status", encoding="ascii") as handle:
            line = next(line for line in handle if line.startswith(field))
        return int(line.split()[1]) * 1024
    except (OSError, StopIteration, ValueError):
        return {"status": "not-applicable", "reasonCode": "linux-proc-status-unavailable"}


encoded = sys.stdin.read()
if len([line for line in encoded.splitlines() if line]) != 1:
    raise RuntimeError("invalid input framing")
request = json.loads(encoded)
if sorted(request) != ["chunksBase64", "credentialProfile", "expectedActivation", "expectedArtifact", "selectors", "workloadBase64"]:
    raise RuntimeError("invalid input keys")
if request["credentialProfile"] != "full":
    raise RuntimeError("python binding has no common entrypoint")
workload = base64.urlsafe_b64decode(request["workloadBase64"] + "==").decode()
chunks = [base64.urlsafe_b64decode(value + "==").decode() for value in request["chunksBase64"]]
workload_bytes = len(workload.encode())
tracemalloc.start()
import_ms, redact_secret = elapsed(lambda: importlib.import_module("redact_secret"))
initialize_ms, _ = elapsed(lambda: redact_secret.initialize(request["selectors"]))
if redact_secret.pii_activation() != request["expectedActivation"] or request["expectedArtifact"] != "compiled":
    raise RuntimeError("python activation or artifact identity mismatch")
whole_ms, _ = elapsed(lambda: redact_secret.scan(workload))


def incremental():
    limits = redact_secret.IncrementalLimits(
        max_input_bytes=max(workload_bytes + 1024, 65536),
        max_buffered_bytes=32768,
        max_token_bytes=8192,
        max_multiline_bytes=16384,
    )
    session = redact_secret.IncrementalSanitizer(limits)
    for chunk in chunks:
        session.append(chunk)
    session.finalize()


incremental_ms, _ = elapsed(incremental)
_, python_peak = tracemalloc.get_traced_memory()
workload = ""
chunks = []
gc.collect()
python_retained, _ = tracemalloc.get_traced_memory()
tracemalloc.stop()


def throughput(milliseconds):
    return sys.float_info.max if milliseconds == 0 else workload_bytes * 1000.0 / milliseconds


print(json.dumps({
    "import": import_ms,
    "initialize": initialize_ms,
    "wholeInput": whole_ms,
    "incremental": incremental_ms,
    "bytesPerSecond": {"wholeInput": throughput(whole_ms), "incremental": throughput(incremental_ms)},
    "memory": {
        "processPeakRss": rss_bytes("VmHWM:"),
        "processRetainedRss": rss_bytes("VmRSS:"),
        "pythonPeakHeap": python_peak,
        "pythonRetainedHeap": python_retained,
    },
}, separators=(",", ":")))
