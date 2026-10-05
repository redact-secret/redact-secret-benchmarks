// Unit-safe diagnostics runner (#380). Runs the product — the published npm
// package or an exact candidate build — over the pinned, frozen credential
// corpus, verifies its actual sanitized output, and writes a machine-readable
// report (schemas/unit-diagnostics-v1.json) plus a human Markdown rendering.
// v4 headline groups are unchanged and are carried only as a cross-checked
// reference. See docs/specs/unit-diagnostics.md.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { arch, platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { installCandidate, removeCandidate, piiFindingIdentity } from '../scanners/candidate.mjs';
import { findingFamily, familyMappingVersion } from '../scanners/families.mjs';
import { classifyFixture, validateAssessment, validateContracts } from './lib/assessment.ts';
import { aggregateGroups } from './scoring/lattice.ts';
import { score, validateCorpus } from './scoring/scoring.ts';
import { validateStructures } from './lib/validate-structures.ts';
import {
  UNIT_DIAGNOSTICS_SCHEMA_VERSION, PLACEHOLDER_FORMAT, observeProduct, diagnoseRow, aggregateRows,
  reportProblem, digestOf, rowsDigestOf, isNotable, type DiagnosticFixture, type DiagnosticRow,
} from './lib/unit-diagnostics.ts';
import { renderUnitDiagnostics } from './lib/unit-diagnostics-report.ts';
import type { Category, Fixture, Finding } from './types.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const DOMAIN = 'credentials';
const PII_NOT_MEASURED = 'PII cases use the pii-v1 profile (sensitivity/jurisdiction expectations, PiiCase model) rather than must-redact/must-not-flag spans; they are measured by the PII domain reports and are never merged into credential units.';

function parse(argv: string[]) {
  const options: Record<string, string> = {};
  for (const a of argv) {
    const m = /^--(candidate-package|candidate-node-package|candidate-wasm-package|candidate-source-commit|out|check)=(.+)$/.exec(a);
    if (!m || m[1] in options) throw new Error('Usage: npm run eval:diagnostics -- --out=<path-prefix> [--check=<report.json>] [--candidate-package=<core.tgz> --candidate-node-package=<node.tgz> --candidate-wasm-package=<wasm.tgz> --candidate-source-commit=<40-hex>]');
    options[m[1]] = m[2];
  }
  const candidate = ['candidate-package', 'candidate-node-package', 'candidate-wasm-package', 'candidate-source-commit'].filter(k => k in options);
  if (candidate.length !== 0 && candidate.length !== 4) throw new Error('candidate mode needs all four --candidate-* flags');
  if (candidate.length && !/^[a-f0-9]{40}$/.test(options['candidate-source-commit'])) throw new Error('candidate-source-commit must be a full 40-hex commit');
  if (!options.out && !options.check) throw new Error('--out or --check is required');
  return options;
}

export async function loadPinnedCorpus() {
  validateContracts();
  const pins = JSON.parse(await readFile(path.join(root, 'benchmarks/pin-manifest.json'), 'utf8'));
  const categories: Category[] = JSON.parse(await readFile(path.join(root, 'benchmarks/categories.json'), 'utf8'))
    .filter((c: Category & { calibrationOnly?: boolean }) => !c.calibrationOnly);
  const hashes: Record<string, string> = {};
  const fixtures: (Fixture & { category: string })[] = [];
  for (const category of categories) {
    const source = await readFile(path.join(root, category.corpus), 'utf8');
    hashes[category.id] = sha256(source);
    // Frozen corpus: the bytes must be exactly what benchmarks/pin-manifest.json pins.
    if (pins.corpusHashes?.[category.id] !== hashes[category.id]) throw new Error(`corpus-not-pinned:${category.id}`);
    const corpus = validateCorpus(JSON.parse(source));
    if (corpus.schemaVersion !== 2) throw new Error(`corpus-schema:${category.id}`);
    for (const f of corpus.fixtures) {
      validateAssessment(f);
      if (JSON.stringify(f.assessment) !== JSON.stringify(classifyFixture(category.id, f))) throw new Error(`stale-assessment:${f.id}`);
    }
    validateStructures(corpus.fixtures);
    for (const f of corpus.fixtures) fixtures.push({ ...f, category: category.id });
  }
  const identity = sha256(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('\n'));
  return { fixtures, corpus: { pinned: true as const, pinManifestRevision: pins.revision as string, categories: hashes, identity } };
}

const toDiagnostic = (f: Fixture & { category: string }): DiagnosticFixture => ({
  category: f.category, id: f.id, kind: f.assessment!.kind as DiagnosticFixture['kind'], tier: f.assessment!.tier as DiagnosticFixture['tier'],
  ...(f.assessment!.contract ? { contract: f.assessment!.contract } : {}), ...(f.twinOf ? { twinOf: f.twinOf } : {}),
  expected: f.expected.map(({ start, end, role, envelope }) => ({ start, end, role, ...(envelope ? { envelope: { start: envelope.start, end: envelope.end } } : {}) })),
});

const familyOf = (finding: { detector: string; type: string }) =>
  (finding.detector === 'pii-domain' && piiFindingIdentity(finding.type)) || findingFamily('redact-secret', finding.detector, finding.type);

/** v4 groups for exactly the completed rows, from the unchanged v4 scorer. Authoritative; diagnostics must agree with it. */
function v4Reference(fixtures: (Fixture & { category: string })[], observations: Map<string, ReturnType<typeof observeProduct>>) {
  const out: Record<string, Record<string, unknown>> = {};
  for (const category of [...new Set(fixtures.map(f => f.category))]) {
    const complete = fixtures.filter(f => f.category === category && observations.get(`${category}/${f.id}`)!.status === 'complete');
    const findings: Finding[] = complete.flatMap(f => {
      const o = observations.get(`${category}/${f.id}`)!;
      return o.status === 'complete' ? o.findings.map(x => ({ path: f.path, start: x.start, end: x.end, ...(x.family ? { family: x.family } : {}), action: x.action })) : [];
    });
    const groups = aggregateGroups(score(complete, findings).rows as never) as Record<string, any>;
    for (const [key, g] of Object.entries(groups)) {
      if (key === 'pending/T0') continue;
      const total = (out[key] ??= key.startsWith('must-not-flag/') ? { files: 0, flaggedFiles: 0 } : { files: 0, spans: 0, leakedSpans: 0, leakedBytes: 0, secretBytes: 0, collateralBytes: 0 }) as Record<string, number>;
      for (const k of Object.keys(total)) total[k] += g[k];
    }
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** Diagnostics must reproduce v4's own counts per kind/tier; a disagreement means one of them is wrong. */
function crossCheckV4(segments: Record<string, any>, reference: Record<string, any>) {
  const bySum: Record<string, Record<string, number>> = {};
  for (const s of Object.values<any>(segments)) {
    const key = `${s.stratum.kind}/${s.stratum.tier}`;
    const t = (bySum[key] ??= {});
    if (s.unit === 'file') for (const k of ['files', 'flaggedFiles']) t[k] = (t[k] ?? 0) + s.v4[k];
    else for (const k of ['spans', 'leakedSpans', 'leakedBytes', 'secretBytes', 'collateralBytes']) t[k] = (t[k] ?? 0) + s.v4[k];
  }
  for (const [key, ref] of Object.entries<any>(reference)) {
    const mine = bySum[key] ?? {};
    const fields = key.startsWith('must-not-flag/') ? ['files', 'flaggedFiles'] : ['spans', 'leakedSpans', 'leakedBytes', 'secretBytes', 'collateralBytes'];
    for (const k of fields) if (mine[k] !== ref[k]) throw new Error(`v4-cross-check:${key}:${k}:${mine[k]}!=${ref[k]}`);
  }
}

export async function measure(options: Record<string, string>) {
  const { fixtures, corpus } = await loadPinnedCorpus();
  const candidate = options['candidate-package'];
  const installation = candidate ? await installCandidate({
    core: path.resolve(options['candidate-package']), node: path.resolve(options['candidate-node-package']), wasm: path.resolve(options['candidate-wasm-package']),
  }) : undefined;
  try {
    const entry = installation ? pathToFileURL(path.join(installation.root, 'node_modules/@redact-secret/core/dist/index.js')).href : '@redact-secret/core';
    const api = await import(entry);
    await api.initialize();
    const packageJson = installation ? { name: installation.packageName, version: installation.declaredVersion }
      : JSON.parse(await readFile(path.join(root, 'node_modules/@redact-secret/core/package.json'), 'utf8'));
    const product = {
      package: packageJson.name as string, version: api.VERSION as string, declaredVersion: packageJson.version as string,
      ...(installation ? { candidate: {
        sourceCommit: options['candidate-source-commit'],
        artifactSha256: {
          core: sha256(await readFile(options['candidate-package'])),
          node: sha256(await readFile(options['candidate-node-package'])),
          wasm: sha256(await readFile(options['candidate-wasm-package'])),
        },
      } } : { lockHash: sha256(await readFile(path.join(root, 'package-lock.json'))) }),
    };
    const observations = new Map<string, ReturnType<typeof observeProduct>>();
    const rows: DiagnosticRow[] = [];
    const diagnostic = fixtures.map(toDiagnostic);
    for (const [index, f] of fixtures.entries()) {
      const secrets = f.expected.filter(e => e.role === 'secret');
      const o = f.assessment!.tier === 'T0' ? { status: 'complete' as const, findings: [], outputVerified: true as const, outputBytes: 0, plaintextInOutput: [] } : observeProduct(api, f.content, secrets, familyOf);
      observations.set(`${f.category}/${f.id}`, o);
      rows.push(diagnoseRow(diagnostic[index], o, DOMAIN));
    }
    const { segments, pending } = aggregateRows(rows);
    const reference = v4Reference(fixtures, observations);
    crossCheckV4(segments, reference);
    let revision = 'unknown', dirty: boolean | null = null;
    try {
      revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
      dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
    } catch {}
    const report: Record<string, unknown> = {
      schemaVersion: UNIT_DIAGNOSTICS_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      mode: installation ? 'candidate' : 'published',
      product,
      corpus,
      configuration: {
        api: 'scanAndRedact (replayed twice) cross-checked against redact(input, scan(input))',
        policy: 'built-in', detectors: 'default', pii: 'not-activated', placeholderFormat: PLACEHOLDER_FORMAT, familyMappingVersion,
        offsets: 'UTF-16 product offsets converted to UTF-8 byte offsets',
      },
      domains: { credentials: { status: 'measured' }, pii: { status: 'not-measured', reason: PII_NOT_MEASURED } },
      units: {
        'secret-span': 'must-redact and policy rows: one unit per authored secret span',
        file: 'must-not-flag rows: one unit per control file',
      },
      segments, pending, v4Reference: reference,
      rowCount: rows.length,
      rowsDigest: rowsDigestOf(rows),
      notableRows: rows.filter(isNotable),
      provenance: { benchmarkRevision: revision, dirty },
      runtime: { node: process.version, platform: platform(), arch: arch() },
    };
    report.digest = digestOf(report);
    const problem = reportProblem(report, rows);
    if (problem) throw new Error(`invalid-report:${problem}`);
    return { report, rows };
  } finally {
    await removeCandidate(installation);
  }
}

/** Compact but line-oriented: one line per top-level scalar block, per segment and per notable row, so diffs stay readable. */
export function serialize(report: Record<string, unknown>) {
  const block = (value: unknown) => {
    if (Array.isArray(value)) return value.length ? `[\n${value.map(v => `  ${JSON.stringify(v)}`).join(',\n')}\n ]` : '[]';
    if (value && typeof value === 'object' && Object.keys(value).length > 3)
      return `{\n${Object.entries(value).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n }`;
    return JSON.stringify(value);
  };
  const text = `{\n${Object.entries(report).map(([k, v]) => ` ${JSON.stringify(k)}: ${block(v)}`).join(',\n')}\n}\n`;
  if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(report)) throw new Error('serialization-not-faithful');
  return text;
}

async function main() {
  const options = parse(process.argv.slice(2));
  const { report, rows } = await measure(options);
  if (options.check) {
    // Reproducibility: the same product over the same pinned corpus must yield the same digest.
    const committed = JSON.parse(await readFile(options.check, 'utf8'));
    const problem = reportProblem(committed, await readFile(options.check.replace(/\.json$/, '.rows.json'), 'utf8').then(JSON.parse, () => undefined));
    if (problem) throw new Error(`committed-report-invalid:${problem}`);
    if (committed.corpus.identity !== (report.corpus as { identity: string }).identity) {
      console.error(`Stale: ${options.check} was measured over corpus ${committed.corpus.identity.slice(0, 12)}; pinned corpus is now ${(report.corpus as { identity: string }).identity.slice(0, 12)}. Regenerate it.`);
      process.exitCode = 1; return;
    }
    if (committed.digest !== report.digest) { console.error(`Not reproducible: ${options.check} digest ${committed.digest} != rerun ${report.digest}`); process.exitCode = 1; return; }
    console.log(`Reproduced ${options.check} (${report.digest})`);
    if (!options.out) return;
  }
  const out = path.resolve(options.out);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(`${out}.json`, serialize(report));
  // The full per-row sidecar: recomputes every segment (reportProblem(report, rows)). Kept beside the run, not committed.
  await writeFile(`${out}.rows.json`, `${JSON.stringify(rows)}\n`);
  await writeFile(`${out}.md`, renderUnitDiagnostics(report as never));
  console.log(`${report.mode} ${(report.product as { version: string }).version}: wrote ${out}.json and ${out}.md (digest ${report.digest})`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(`Unit diagnostics failed: ${error instanceof Error ? error.message : 'unknown'}`); process.exitCode = 1; });
}
