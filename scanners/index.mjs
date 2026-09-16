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

// Postgres detector 968 exports a normalized Raw URI with a default port
// and no database path. Recover the original whole URI, never an expected
// password range. Contract: TruffleHog v3.97.4 pkg/detectors/postgres/postgres.go.
export function normalizeTrufflehog(fixtures, root, row) {
  const metadata = row.SourceMetadata?.Data?.Filesystem;
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
      return rows.map((r) =>
        locate(fixtures, root, r.File, r.Secret, r.StartLine),
      );
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
        .map((l) => {
          return normalizeTrufflehog(fixtures, root, JSON.parse(l));
        });
    },
  },
];
