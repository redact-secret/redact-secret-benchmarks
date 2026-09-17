import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
const exec = promisify(execFile);

export async function command(binary, args, cwd) {
  // Suppress raw output and environment-based Gitleaks rule overrides.
  const env = { ...process.env };
  delete env.GITLEAKS_CONFIG;
  delete env.GITLEAKS_CONFIG_TOML;
  try {
    return (
      await exec(binary, args, {
        cwd,
        env,
        timeout: 120_000,
        maxBuffer: 16 * 1024 * 1024,
      })
    ).stdout;
  } catch (error) {
    throw new Error(
      error.code === "ENOENT"
        ? "unavailable"
        : "Scanner process failed or timed out; raw output suppressed.",
    );
  }
}

export function locate(fixtures, root, file, raw, line) {
  if (typeof file !== "string" || typeof raw !== "string" || !raw.length)
    throw new Error("Unmappable scanner finding");
  const relative = path.isAbsolute(file)
    ? path.relative(root, file)
    : file.replace(/^\.\//, "");
  const fixture = fixtures.find((f) => f.path === relative);
  if (!fixture) throw new Error("Unknown scanner path");
  const content = Buffer.from(fixture.content),
    needle = Buffer.from(raw);
  const matches = [];
  for (
    let at = content.indexOf(needle);
    at !== -1;
    at = content.indexOf(needle, at + 1)
  ) {
    const foundLine = content.subarray(0, at).toString().split("\n").length;
    if (line == null || foundLine === line) matches.push(at);
  }
  if (matches.length !== 1)
    throw new Error("Ambiguous or unmappable scanner finding");
  return { path: relative, start: matches[0], end: matches[0] + needle.length };
}

function versionNumber(output) {
  return output.match(/\d+\.\d+\.\d+(?:-[\w.]+)?/)?.[0] ?? "unknown";
}

// Gitleaks can emit a second PEM finding after decoding its base64 body.
// Recover only this explicit, single-line-body transformation; never consult
// ground truth or silently accept arbitrary decoded output.
export function normalizeGitleaks(fixtures, root, row) {
  if (!row.Tags?.includes("decoded:base64"))
    return locate(fixtures, root, row.File, row.Secret, row.StartLine);
  if (row.RuleID !== "private-key" || !row.Tags.includes("decode-depth:1") ||
      typeof row.File !== "string" || typeof row.Secret !== "string")
    throw new Error("Unsupported decoded Gitleaks finding");
  const relative = path.isAbsolute(row.File)
    ? path.relative(root, row.File) : row.File.replace(/^\.\//, "");
  const fixture = fixtures.find(f => f.path === relative);
  if (!fixture) throw new Error("Unknown scanner path");
  const matches = [];
  const pem = /-----BEGIN ((?:(?:RSA|DSA|EC|OPENSSH|ENCRYPTED) )?PRIVATE KEY)-----(\r?\n)([A-Za-z0-9+/]+={0,2})(\r?\n)-----END \1-----/g;
  for (const match of fixture.content.matchAll(pem)) {
    const decoded = Buffer.from(match[3], "base64");
    if (decoded.toString("base64") !== match[3] ||
        !Buffer.from(decoded.toString("utf8")).equals(decoded)) continue;
    const transformed = `-----BEGIN ${match[1]}-----${match[2]}${decoded.toString("utf8")}${match[4]}-----END ${match[1]}-----`;
    const line = fixture.content.slice(0, match.index).split("\n").length;
    if (transformed !== row.Secret || line !== row.StartLine) continue;
    const start = Buffer.byteLength(fixture.content.slice(0, match.index));
    matches.push({ path: relative, start, end: start + Buffer.byteLength(match[0]) });
  }
  if (matches.length !== 1) throw new Error("Ambiguous or unmappable decoded PEM finding");
  return matches[0];
}

// Postgres detector 968 exports a normalized Raw URI with a default port
// and no database path. Recover the original whole URI, never an expected
// password range. Contract: TruffleHog v3.97.4 pkg/detectors/postgres/postgres.go.
export function normalizeTrufflehog(fixtures, root, row) {
  const metadata = row.SourceMetadata?.Data?.Filesystem;
  // v3.97.4 Shopify Raw concatenates token + shop domain; it is not a
  // contiguous source span. Recover only the documented token component.
  if (row.DetectorName === 'Shopify') {
    const parts = /^(shp(?:at|pa)_[a-fA-F0-9]{32})([a-zA-Z0-9-]+\.myshopify\.com)$/.exec(row.Raw);
    if (!parts) throw new Error('Unsupported Shopify composite finding');
    locate(fixtures, root, metadata?.file, parts[2]);
    return locate(fixtures, root, metadata?.file, parts[1], metadata?.line);
  }
  if (row.DetectorType !== 968)
    return locate(fixtures, root, metadata?.file, row.Raw, metadata?.line);
  const file = metadata?.file;
  if (typeof file !== "string" || typeof row.Raw !== "string")
    throw new Error("Unmappable Postgres finding");
  const relative = path.isAbsolute(file)
    ? path.relative(root, file)
    : file.replace(/^\.\//, "");
  const fixture = fixtures.find((f) => f.path === relative);
  if (!fixture) throw new Error("Unknown scanner path");
  const parse = (value) => {
    try {
      const url = new URL(value);
      if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.password)
        return null;
      return {
        key: JSON.stringify([
          decodeURIComponent(url.username),
          decodeURIComponent(url.password),
          url.hostname,
          url.port || "5432",
        ]),
        database: decodeURIComponent(url.pathname.replace(/^\//, "")),
      };
    } catch {
      return null;
    }
  };
  const raw = parse(row.Raw);
  if (!raw) throw new Error("Unmappable Postgres finding");
  const matches = [];
  for (const match of fixture.content.matchAll(
    /\bpostgres(?:ql)?:\/\/\S+\b/gi,
  )) {
    const candidate = parse(match[0]);
    const line = fixture.content.slice(0, match.index).split("\n").length;
    if (
      candidate?.key === raw.key &&
      (metadata.line == null || metadata.line === line) &&
      (row.ExtraData?.database == null ||
        row.ExtraData.database === candidate.database)
    ) {
      const start = Buffer.byteLength(fixture.content.slice(0, match.index));
      matches.push({
        path: relative,
        start,
        end: start + Buffer.byteLength(match[0]),
      });
    }
  }
  if (matches.length !== 1)
    throw new Error("Ambiguous or unmappable Postgres finding");
  return matches[0];
}

// A credential-pair result reports the access key in Raw and both components
// in RawV2. Preserve both secret components; never infer them from ground truth.
export function normalizeTrufflehogFindings(fixtures, root, row) {
  if (row.DetectorName !== 'AWS') return [normalizeTrufflehog(fixtures, root, row)];
  const pair = /^((?:AKIA|ABIA|ACCA)[A-Z0-9]{16}):([A-Za-z0-9/+]{40})$/.exec(row.RawV2 ?? '');
  if (!pair || row.Raw !== pair[1]) throw new Error('Unsupported AWS composite finding');
  const metadata = row.SourceMetadata?.Data?.Filesystem;
  return [
    locate(fixtures, root, metadata?.file, pair[1], metadata?.line),
    locate(fixtures, root, metadata?.file, pair[2]),
  ];
}

export const scanners = [
  {
    id: "redact-secret",
    name: "redact-secret",
    mode: "Published npm package · default detectors",
    async version() {
      const { VERSION } = await import("@redact-secret/core");
      return VERSION;
    },
    async scan(root, fixtures) {
      const { initialize, scan } = await import("@redact-secret/core");
      await initialize();
      const results = [];
      for (const f of fixtures) {
        const text = await readFile(path.join(root, f.path), "utf8");
        for (const r of scan(text))
          results.push({
            path: f.path,
            start: Buffer.byteLength(text.slice(0, r.start)),
            end: Buffer.byteLength(text.slice(0, r.end)),
          });
      }
      return results;
    },
  },
  {
    id: "gitleaks",
    name: "Gitleaks",
    mode: "Directory scan · default rules",
    async version(root) {
      return versionNumber(await command("gitleaks", ["version"], root));
    },
    async scan(root, fixtures) {
      const output = await command(
        "gitleaks",
        [
          "dir",
          root,
          "--no-banner",
          "--no-color",
          "--exit-code",
          "0",
          "--report-format",
          "json",
          "--report-path",
          "-",
        ],
        root,
      );
      const rows = JSON.parse(output);
      if (!Array.isArray(rows)) throw new Error("Invalid scanner output");
      return rows.map((r) => normalizeGitleaks(fixtures, root, r));
    },
  },
  {
    id: "trufflehog",
    name: "TruffleHog",
    mode: "Filesystem scan · verification disabled",
    async version(root) {
      return versionNumber(await command("trufflehog", ["--version"], root));
    },
    async scan(root, fixtures) {
      const output = await command(
        "trufflehog",
        [
          "filesystem",
          root,
          "--json",
          "--no-verification",
          "--no-update",
          "--results=verified,unknown,unverified",
        ],
        root,
      );
      return output
        .split("\n")
        .filter((l) => l.trim())
        .flatMap((l) => {
          return normalizeTrufflehogFindings(fixtures, root, JSON.parse(l));
        });
    },
  },
];
