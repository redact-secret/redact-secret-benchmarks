// Fixture identity/independence audit and per-family before-state (#377).
//
//   npm run audit:independence -- --out=<file.json>
//     [--published-status=<support-status.json> --published-results=<public/results dir>]
//     [--candidate-status=<support-status.json> --candidate-results=<public/results dir>]
//
// The corpus half is deterministic over the checked-out benchmarks revision (it
// loads cases exactly as eval:classify does). The optional measured half reads a
// published-mode and/or candidate-mode `eval:classify` report and the matching
// `bench` reports; it never runs a scanner itself, so peer pins and mode are the
// caller's to establish (see AGENTS.md "Peer scanner version"). Output carries
// fixture ids, counts and truncated SHA-256 cluster keys only, never content.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveCredentialDomain } from '../benchmarks/evaluation/domains/registry.ts';
import { contracts } from '../benchmarks/lib/assessment.ts';
import {
  auditTwins, duplicateContentClusters, familyIndependence, formatOverlaps, rowFailures, sharedValueClusters,
  summarizeFailures, templateClusters,
} from '../benchmarks/lib/fixture-independence.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const usage = 'Usage: npm run audit:independence -- --out=<file.json> [--published-status=<json> --published-results=<dir>] [--candidate-status=<json> --candidate-results=<dir>]';
const options = {};
for (const arg of process.argv.slice(2)) {
  const m = /^--(out|published-status|published-results|candidate-status|candidate-results)=(.+)$/.exec(arg);
  if (!m || m[1] in options) throw new Error(usage);
  options[m[1]] = path.resolve(m[2]);
}
if (!options.out) throw new Error(usage);

const domain = resolveCredentialDomain('credential');
const cases = await domain.loadCases(domain.createOperators());
const byKey = new Map();
for (const c of cases) {
  const key = `${c.source.category}--${c.source.fixtureId}`;
  const entry = byKey.get(key) ?? { key, category: c.source.category, fixture: c.seed, families: new Set(), benignAxis: undefined };
  for (const t of c.targets) entry.families.add(t);
  if (c.method === 'benign' && c.taxonomy) entry.benignAxis = c.taxonomy;
  byKey.set(key, entry);
}
const fixtures = [...byKey.values()].map(e => ({ ...e, families: [...e.families].sort() })).sort((a, b) => a.key.localeCompare(b.key));
const families = [...domain.assessment.scoredContractIds].sort();

const duplicates = duplicateContentClusters(fixtures);
const values = sharedValueClusters(fixtures);
const templates = templateClusters(fixtures);
const twins = auditTwins(fixtures);
const overlaps = formatOverlaps(fixtures, contracts);
const independence = families.map(f => familyIndependence(f, fixtures, contracts, twins, overlaps, duplicates));

async function measured(mode) {
  const statusFile = options[`${mode}-status`], resultsDir = options[`${mode}-results`];
  if (!statusFile && !resultsDir) return null;
  if (!statusFile || !resultsDir) throw new Error(`${mode}: pass both --${mode}-status and --${mode}-results`);
  const status = JSON.parse(await readFile(statusFile, 'utf8'));
  const failures = [];
  const spans = new Map();
  let run = null;
  for (const name of (await readdir(resultsDir)).filter(n => n.endsWith('.json')).sort()) {
    const report = JSON.parse(await readFile(path.join(resultsDir, name), 'utf8'));
    if (name === 'run.json') { run = report; continue; }
    const product = report.scanners?.find(s => s.id === 'redact-secret');
    if (!product?.rows) continue;
    for (const row of product.rows) {
      const audit = byKey.get(`${report.category}--${row.id}`);
      failures.push(...rowFailures(report.category, row, audit ? { ...audit, families: [...audit.families] } : undefined));
      if (row.tier === 'T0' || row.kind === 'must-not-flag') continue;
      for (const family of audit ? [...audit.families] : row.contract ? [row.contract] : []) {
        const s = spans.get(family) ?? { spans: 0, leaked: 0, collateralBytes: 0 };
        s.spans += (row.spanOutcomes ?? []).length;
        s.leaked += (row.spanOutcomes ?? []).filter(o => o === 'PARTIAL' || o === 'MISS').length;
        s.collateralBytes += row.collateralBytes ?? 0;
        spans.set(family, s);
      }
    }
  }
  const byFamily = Object.fromEntries(status.families.map(r => [r.family, {
    status: r.status, tier: r.evidenceTier, basis: r.evidenceBasis, profile: r.qualificationProfile,
    cells: r.fixtureProfile?.cells && Object.fromEntries(Object.entries(r.fixtureProfile.cells).filter(([k]) => !k.endsWith('Ids'))),
    target: r.fixtureProfile?.target ?? null, debt: r.fixtureProfile?.debt ?? [],
    twinPairs: r.evidence.twinPairs, twinFailures: r.evidence.twinFailures, benignFalseAlarms: r.evidence.benignFalseAlarms,
    metamorphicCriticalFailures: r.evidence.metamorphicCriticalFailures, mutationUnresolvedCritical: r.evidence.mutationUnresolvedCritical,
    differentialUnresolvedContractDisagreements: r.evidence.differentialUnresolvedContractDisagreements,
    supportedContexts: r.evidence.supportedContexts, empiricalMode: r.evidence.empiricalMode, supportsBareValues: r.evidence.supportsBareValues,
    unprobeable: Boolean(r.unprobeable), reasons: r.reasons.length,
    benchSpans: spans.get(r.family) ?? { spans: 0, leaked: 0, collateralBytes: 0 },
  }]));
  return {
    identity: {
      mode, revision: status.revision, dirty: status.dirty, product: status.product ?? null, publishedPackage: status.publishedPackage ?? null,
      fixtureIndex: status.fixtureIndex, taxonomyDigest: status.taxonomyDigest, scannerObservations: status.scannerObservations,
      benchRunId: run?.runId ?? null, benchScannerVersions: run?.scannerVersions ?? null, benchCandidate: run?.candidate ?? null,
    },
    distribution: status.families.reduce((d, r) => ({ ...d, [r.status]: (d[r.status] ?? 0) + 1 }), {}),
    families: byFamily,
    failures: summarizeFailures(failures),
  };
}

const knownGaps = JSON.parse(await readFile(path.join(root, 'benchmarks/known-gaps.json'), 'utf8'));
const gapsByFamily = {};
for (const gap of knownGaps.issues) {
  const fams = new Set((gap.fixtures ?? []).flatMap(k => byKey.get(k) ? [...byKey.get(k).families] : []));
  for (const f of fams) (gapsByFamily[f] ??= []).push({ id: gap.id, kind: gap.kind, status: gap.status });
}

let revision = 'unknown', dirty = null;
try {
  revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
} catch {}
const fixtureIndex = JSON.parse(await readFile(path.join(root, 'benchmarks/fixture-index.json'), 'utf8'));
const report = {
  schema: 'fixture-independence-audit-v1',
  benchmark: { revision, dirty, fixtureIndex: fixtureIndex.identity },
  corpus: {
    fixtures: fixtures.length,
    families: families.length,
    duplicateContentClusters: duplicates,
    sharedValueClusters: values,
    templateClusters: templates.map(c => ({ ...c, members: c.members.length > 12 ? [...c.members.slice(0, 12), `…+${c.members.length - 12}`] : c.members, size: c.members.length })),
    twinAudit: { pairs: twins.length, flagged: twins.filter(t => t.flags.length) },
    formatOverlaps: overlaps,
  },
  families: independence,
  knownGaps: gapsByFamily,
  published: await measured('published'),
  candidate: await measured('candidate'),
};
await writeFile(options.out, JSON.stringify(report, null, 2) + '\n');
console.log(`Audited ${fixtures.length} fixtures across ${families.length} families: ${duplicates.length} duplicate-content clusters, ${values.length} shared-value clusters, ${templates.length} template clusters, ${report.corpus.twinAudit.flagged.length}/${twins.length} twins flagged, ${overlaps.length} benign/twin format overlaps.`);
console.log(`Report: ${path.relative(process.cwd(), options.out)}`);
