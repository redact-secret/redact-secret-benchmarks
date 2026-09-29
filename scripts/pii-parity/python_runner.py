"""#427 job runner for the `redact_secret` Python binding.

Runs the same operations as scripts/pii-parity/js-runner.mjs in the same order. Ranges stay native (Unicode code
points); the harness converts them. Usage: python python_runner.py <job.json> <result.json>
"""

import json
import sys

import redact_secret as rs


def code_of(error):
    return getattr(error, "code", None) or "UNCODED_ERROR"


def row(finding):
    return {"type": finding.type, "detector": finding.detector, "action": finding.action,
            "confidence": finding.confidence, "start": finding.start, "end": finding.end}


def chunks_of(text, cuts):
    out, previous = [], 0
    for cut in list(cuts) + [len(text)]:
        out.append(text[previous:cut])
        previous = cut
    return out


def attempt(action):
    try:
        return {"status": "ok", **action()}
    except rs.SecretScanError as error:
        return {"status": "error", "errorCode": code_of(error)}


def limits_of(limits):
    return rs.IncrementalLimits(max_input_bytes=limits["maxInput"], max_buffered_bytes=limits["maxBuffered"],
                                max_token_bytes=limits["maxToken"], max_multiline_bytes=limits["maxMultiline"])


def session(limits, chunks):
    try:
        sanitizer = rs.IncrementalSanitizer(limits_of(limits))
    except rs.SecretScanError as error:
        return {"status": "error", "errorCode": code_of(error), "text": "", "findings": [], "state": None}
    text, findings = "", []
    try:
        for chunk in chunks:
            result = sanitizer.append(chunk)
            text += result.text
            findings.extend(row(f) for f in result.findings)
        result = sanitizer.finalize()
        text += result.text
        findings.extend(row(f) for f in result.findings)
        return {"status": "ok", "text": text, "findings": findings, "state": sanitizer.state}
    except rs.SecretScanError as error:
        return {"status": "error", "errorCode": code_of(error), "text": text, "findings": findings, "state": sanitizer.state}


def run_case(job, case):
    text = case["input"]
    scan = attempt(lambda: {"findings": [row(f) for f in rs.scan(text)]})
    redact = attempt(lambda: {"text": rs.redact(text, rs.scan(text))})

    def scan_and_redact():
        result = rs.scan_and_redact(text)
        return {"text": result.text, "findings": [row(f) for f in result.findings]}

    partitions = [{"id": p["id"], **session(job["incrementalLimits"], chunks_of(text, p["cuts"]))} for p in case["partitions"]]
    whole = []
    for limit in case["wholeLimits"]:
        limits = rs.WholeInputLimits(max_input_bytes=limit["maxInputBytes"], max_findings=limit["maxFindings"])
        whole.append({"id": limit["id"],
                      "scan": attempt(lambda: {"count": len(rs.scan(text, limits=limits))}),
                      "redact": attempt(lambda: {"text": rs.redact(text, rs.scan(text), limits=limits)}),
                      "scanAndRedact": attempt(lambda: {"text": rs.scan_and_redact(text, limits=limits).text})})
    failures = [{"id": f["id"], **session(f["limits"], chunks_of(text, f["cuts"]))}
                for f in case["incrementalFailures"]]
    return {"key": case["key"], "scan": scan, "redact": redact, "scanAndRedact": attempt(scan_and_redact),
            "partitions": partitions, "wholeLimits": whole, "incrementalFailures": failures}


def main():
    job_file, out_file = sys.argv[1], sys.argv[2]
    with open(job_file, encoding="utf-8") as handle:
        job = json.load(handle)
    rs.initialize(pii=job["selectors"])
    identity = {"rangeUnit": rs.RANGE_UNIT, "version": rs.VERSION, "artifact": "python-extension", "piiActivation": rs.pii_activation()}
    result = {"identity": identity, "cases": [run_case(job, case) for case in job["cases"]]}
    with open(out_file, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False)


if __name__ == "__main__":
    main()
