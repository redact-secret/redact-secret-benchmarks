"""Scan the Batch 1 corpus through the Python binding (#717).

Reads a corpus JSON (`[{id, text}]`), prints `{id: {whole, stream}}` with UTF-8
byte offsets. Ranges from the binding are Unicode code points and are converted
here; no finding text is read or printed.
"""
import json
import sys

import redact_secret

CHUNK = 7
LIMITS = dict(max_input_bytes=1_000_000, max_buffered_bytes=32_896, max_token_bytes=8_192, max_multiline_bytes=32_768)


def to_bytes(text, index):
    return len(text[:index].encode("utf-8"))


def norm(text, findings):
    return [
        {"start": to_bytes(text, f.start), "end": to_bytes(text, f.end), "type": f.type, "detector": f.detector, "action": f.action}
        for f in findings
    ]


def stream(text):
    found = []
    with redact_secret.IncrementalSanitizer(redact_secret.IncrementalLimits(**LIMITS)) as session:
        for i in range(0, len(text), CHUNK):
            found.extend(session.append(text[i : i + CHUNK]).findings)
        found.extend(session.finalize().findings)
    return found


cases = json.load(open(sys.argv[1], encoding="utf-8"))
out = {"version": redact_secret.__version__ if hasattr(redact_secret, "__version__") else None, "rangeUnit": redact_secret.RANGE_UNIT, "cases": {}}
for case in cases:
    text = case["text"]
    out["cases"][case["id"]] = {
        "whole": {"findings": norm(text, redact_secret.scan(text))},
        "stream": {"findings": norm(text, stream(text))},
    }
json.dump(out, sys.stdout)
