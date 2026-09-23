"""Snapshot released upstream registry metadata, never detector implementations.

Requires Python 3.11+ and authenticated gh. Tags match the benchmark binaries.
The explicit related-family mapping is conservative: it never asserts parity.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tomllib

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {
    "gitleaks": ("gitleaks/gitleaks", "v8.30.1", "config/gitleaks.toml"),
    "trufflehog": ("trufflesecurity/trufflehog", "v3.97.4", "pkg/engine/defaults/defaults.go"),
    "flare-redact": ("flare-collection/flare-redact", "v1.6.1", "spec/detectors.json"),
}

# A shared provider does not establish equal prefixes, formats, or verification.
GITLEAKS_FAMILIES = {
    "anthropic-": "anthropic-token", "aws-": "aws-access-key",
    "cloudflare-": "cloudflare-token", "digitalocean-": "digitalocean-token",
    "github-": "github-token", "gitlab-": "gitlab-token",
    "huggingface-": "huggingface-token", "linear-": "linear-token",
    "npm-": "npm-token", "openai-": "openai-token", "pypi-": "pypi-token",
    "sendgrid-": "sendgrid-token", "shopify-": "shopify-token",
    "slack-": "slack-token", "stripe-": "stripe-token", "vault-": "vault-token",
    "hashicorp-tf-": "terraform-cloud-token", "pulumi-": "pulumi-access-token",
    "databricks-": "databricks-personal-access-token",
    # confluent-access-token is the public key ID, never a secret family here.
    "confluent-secret-key": "confluent-cloud-api-secret-legacy",
    "postman-": "postman-api-key", "netlify-": "netlify-token",
    "curl-auth-header": "bearer-token", "jwt": "jwt", "private-key": "private-key", "generic-api-key": "generic-token",
}
TRUFFLEHOG_FAMILIES = {
    "anthropic": "anthropic-token", "aws": "aws-access-key",
    "azure_openai": "openai-token", "openai": "openai-token",
    "cloudflare": "cloudflare-token", "digitalocean": "digitalocean-token",
    "docker": "docker-token", "github": "github-token", "gitlab": "gitlab-token",
    "hashicorpvault": "vault-token", "hashicorpbatchtoken": "vault-token",
    "huggingface": "huggingface-token", "linearapi": "linear-token",
    "npmtoken": "npm-token", "pypi": "pypi-token", "sendgrid": "sendgrid-token",
    "shopify": "shopify-token", "slack": "slack-token", "stripe": "stripe-token",
    "supabase": "supabase-token", "vercel": "vercel-token",
    "terraformcloud": "terraform-cloud-token", "pulumi": "pulumi-access-token",
    "databrickstoken": "databricks-personal-access-token",
    "confluent": "confluent-cloud-api-secret-legacy",
    "postman": "postman-api-key",
    # netlify/v1 is the pre-2023-11 unprefixed, keyword-gated shape shared by
    # every Netlify token class; only the nfp_-prefixed v2 is this family.
    "netlify/v2": "netlify-token",
    "jwt": "jwt", "privatekey": "private-key", "mongodb": "connection-string",
    "postgres": "connection-string", "redis": "connection-string",
    "azure_storage": "connection-string", "rabbitmq": "connection-string",
}
# flare-redact detector ids are discrete, not prefixed variants (mirrors the
# runtime mapping in scanners/families.mjs); an exact-id lookup, not a prefix.
FLARE_REDACT_FAMILIES = {
    "github_token": "github-token", "gitlab_token": "gitlab-token", "npm_token": "npm-token",
    "sendgrid_key": "sendgrid-token", "slack_token": "slack-token",
    "aws_access_key": "aws-access-key", "aws_secret_key": "aws-access-key",
    "private_key": "private-key", "jwt": "jwt", "anthropic_key": "anthropic-token",
    "openai_key": "openai-token", "shopify_token": "shopify-token", "stripe_key": "stripe-token",
    "generic_assignment": "generic-token", "vault_token": "vault-token",
    "huggingface_token": "huggingface-token", "digitalocean_token": "digitalocean-token",
    "linear_key": "linear-token", "supabase_key": "supabase-token", "bearer_token": "bearer-token",
    "url_credentials": "connection-string", "databricks_token": "databricks-personal-access-token",
    "postman_key": "postman-api-key", "netlify_token": "netlify-token",
}


def gh(endpoint, raw=False):
    args = ["gh", "api", endpoint]
    if raw:
        args += ["-H", "Accept: application/vnd.github.raw+json"]
    result = subprocess.check_output(args, text=True)
    return result if raw else json.loads(result)


def related(tool, identifier):
    if tool == "flare-redact":
        return FLARE_REDACT_FAMILIES.get(identifier)
    mapping = GITLEAKS_FAMILIES if tool == "gitleaks" else TRUFFLEHOG_FAMILIES
    return next((family for prefix, family in mapping.items() if identifier.startswith(prefix)), None)


def inventory(gitleaks, trufflehog, flare_redact, sources):
    rows = []
    config = tomllib.loads(gitleaks)
    rule_lines = {m.group(1): gitleaks[:m.start()].count("\n") + 1
                  for m in re.finditer(r'^id = "([^"]+)"', gitleaks, re.M)}
    for rule in config["rules"]:
        identifier = rule["id"]
        rows.append({"tool": "gitleaks", "id": identifier,
                     "sourceUrl": sources["gitleaks"]["url"] + f"#L{rule_lines[identifier]}",
                     "activation": "default-rule"})

    imports = {}
    for alias, package in re.findall(r'^\s*(?:(\w+)\s+)?"github.com/trufflesecurity/trufflehog/v3/pkg/detectors/([^"]+)"', trufflehog, re.M):
        imports[alias or package.split("/")[-1]] = package
    begin = trufflehog.index("dets := []detectors.Detector{")
    end = trufflehog.index("dets = slices.DeleteFunc", begin)
    body = trufflehog[begin:end]
    gated = dict(re.findall(r'case \*(\w+)\.Scanner:\s*return !feature\.(\w+)\.Load\(\)', trufflehog[end:]))
    for offset, line in enumerate(body.splitlines()):
        code = line.split("//")[0].strip()
        if code in ["dets := []detectors.Detector{", "}", ""]:
            continue
        match = re.fullmatch(r'(?:&(\w+)\.Scanner\{\}|(\w+)\.New\(\)),', code)
        if not match:
            raise ValueError("Unrecognized registry constructor: " + code)
        alias = match.group(1) or match.group(2)
        package = imports[alias]
        line_number = trufflehog[:begin].count("\n") + offset + 1
        rows.append({"tool": "trufflehog", "id": package,
                     "sourceUrl": sources["trufflehog"]["url"] + f"#L{line_number}",
                     "activation": "feature-gated" if alias in gated else "registered",
                     "featureFlag": gated.get(alias)})

    # FRS-1's own portable spec: a plain JSON detector array, not source code.
    spec = json.loads(flare_redact)
    spec_lines = {m.group(1): flare_redact[:m.start()].count("\n") + 1
                  for m in re.finditer(r'"id":\s*"([^"]+)"', flare_redact)}
    for detector in spec["detectors"]:
        identifier = detector["id"]
        rows.append({"tool": "flare-redact", "id": identifier,
                     "sourceUrl": sources["flare-redact"]["url"] + f"#L{spec_lines[identifier]}",
                     "activation": "default-detector" if detector.get("default") else "opt-in-detector"})

    for row in rows:
        family = related(row["tool"], row["id"])
        row["relatedDetector"] = family
        row["status"] = "related-family" if family else "no-dedicated-detector"
    return sorted(rows, key=lambda row: (row["tool"], row["id"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fetch pinned sources and reject snapshot drift")
    args = parser.parse_args()
    sources, contents = {}, {}
    for tool, (repo, tag, path) in SOURCES.items():
        revision = gh(f"repos/{repo}/commits/{tag}")["sha"]
        content = gh(f"repos/{repo}/contents/{path}?ref={revision}", raw=True)
        contents[tool] = content
        sources[tool] = {"version": tag.removeprefix("v"), "revision": revision,
                         "path": path, "sha256": hashlib.sha256(content.encode()).hexdigest(),
                         "url": f"https://github.com/{repo}/blob/{revision}/{path}"}
    registry = json.loads((ROOT / "benchmarks/detectors.json").read_text())
    version = json.loads((ROOT / "package.json").read_text())["dependencies"]["@redact-secret/core"]
    release = version.rsplit("-", 1)[-1]
    rows = inventory(contents["gitleaks"], contents["trufflehog"], contents["flare-redact"], sources)
    snapshot = {"schemaVersion": 1, "reviewedAt": "2026-09-22",
                "redactSecretVersion": version,
                "redactSecretRevision": registry["sourceRevision"],
                "method": f"Explicit provider-family mapping against the {len(registry['detectors'])} registered {release} detectors. No dedicated detector means no named equivalent in that registry; generic/contextual detection may still match. Related families have unverified format parity. Upstream entries and versions are not deduplicated into providers. Feature-gated registrations may be disabled at runtime. No runtime accuracy claim.",
                "sources": sources, "entries": rows}
    target = ROOT / "benchmarks/detector-inventory.json"
    serialized = json.dumps(snapshot, indent=2) + "\n"
    if args.check:
        if target.read_text() != serialized:
            raise SystemExit("Inventory drift; run npm run detectors:refresh and review the mapping.")
    else:
        target.write_text(serialized)
    for tool in SOURCES:
        selected = [row for row in rows if row["tool"] == tool]
        print(tool, len(selected), "entries;", sum(row["status"] == "no-dedicated-detector" for row in selected), "without a dedicated equivalent")


if __name__ == "__main__":
    main()
