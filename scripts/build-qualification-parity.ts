/**
 * Build the old-versus-new qualification comparison report (#607) from the legacy oracle and the new path.
 *
 *   npm run qualification:parity -- --legacy-status results-output/support-status.json --legacy-results public/results \
 *     --view public/results/qualification-v1.json --artifacts <dir> [--public-snapshot <credential-eval-corpus-snapshot.json>] \
 *     [--out docs/generated/qualification-parity] [--strict]
 *
 * Inputs: the legacy support status (`npm run eval:classify`) and per-suite reports (`npm run bench`), the new
 * qualification view and the official RunArtifacts (`npm run qualification:view`), and, to compare the public
 * population fixture by fixture, the evidence snapshot the public artifact was run on (its `identity` must equal the
 * artifact's evidence). Writes `<out>.json` and `<out>.md`; the same inputs write the same bytes (no clock, host or
 * path). Exits 1 under --strict when a difference is unexplained. It compares; it changes no ledger and no status.
 * The comparison logic and its three classes are `benchmarks/qualification/parity.ts`; the method is
 * `docs/specs/qualification-parity.md`.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { detectorsOf, seedCaseId } from '../benchmarks/qualification/adapter.ts';
import { loadProductInputs } from '../benchmarks/qualification/inputs.ts';
import { readRunArtifact, type CaseResult, type Measurement, type RunArtifact } from '../benchmarks/qualification/run-artifact.ts';
import {
  CAUSES, PARITY_SCHEMA, compareFamilies, compareIdentity, compareKnownGaps, compareOutcomes, joinByKeys, renderMarkdown, summarise,
  type CasePair, type CaseSide, type JoinResult, type Joinable, type LegacyFamily, type NextFamily, type Normalised, type ParityReport,
} from '../benchmarks/qualification/parity.ts';

const usage = 'Usage: qualification:parity --legacy-status <file> --legacy-results <dir> --view <file> --artifacts <dir> [--public-snapshot <file>] [--out <prefix>] [--strict]';
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
for (const [i, a] of args.entries()) if (a.startsWith('--') && !['--strict'].includes(a) && !/^--(legacy-status|legacy-results|view|artifacts|public-snapshot|out)$/.test(a)) throw new Error(`${usage}\nUnknown option ${a} at ${i}`);
const need = (name: string) => option(name) ?? (() => { throw new Error(usage); })();
const root = path.resolve(import.meta.dirname, '..');
const resolve = (p: string) => path.resolve(p);
const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'));
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

const PUBLIC = 'public-evidence-snapshot', REGRESSION = 'regression-corpus', POLICY = 'policy-corpus';
const SCANNER = 'redact-secret';

// -- legacy side ---------------------------------------------------------------------------------------------------
const legacyStatus = await readJson(resolve(need('legacy-status')));
const resultsDir = resolve(need('legacy-results'));
const view = await readJson(resolve(need('view')));
const artifactsDir = resolve(need('artifacts'));

const product = await loadProductInputs();
const detectorIds = new Set(product.families);
const taxonomyDetectors = new Map(product.taxonomy.families.map(f => [f.id, f.detectors]));
const categories: { id: string; corpus: string; kind: string }[] = await readJson(path.join(root, 'benchmarks/categories.json'));
const development: string[] = (await readJson(path.join(root, 'corpora/development/manifest.json'))).categories;
const regression: string[] = (await readJson(path.join(root, 'corpora/regression/manifest.json'))).categories;
const inputsManifest = await readJson(path.join(root, 'benchmarks/qualification-inputs.json'));
const policyCategory: string = inputsManifest.populations.find((p: { id: string }) => p.id === POLICY).currentLocation.category;
const populationOfCategory = (id: string) => (regression.includes(id) ? REGRESSION : id === policyCategory ? POLICY : development.includes(id) ? PUBLIC : undefined);

const normaliseLegacy = (row: Record<string, any>): Normalised => {
  if (Array.isArray(row.spanOutcomes)) return { kind: 'positive', spans: row.spanOutcomes };
  if (typeof row.flagged === 'boolean') return { kind: 'control', observed: (row.findings ?? row.actual?.length ?? 0) > 0, flagged: row.flagged, coDetected: Boolean(row.coDetected), twin: Boolean(row.twinOf) };
  return row.tier === 'T0' ? { kind: 'pending' } : { kind: 'not-measured' };
};
const normaliseNext = (c: CaseResult): Normalised => {
  const m: Measurement = c.measurement;
  if (m.type === 'positive') return { kind: 'positive', spans: m.span_outcomes };
  if (m.type === 'control') return { kind: 'control', observed: m.findings > 0, flagged: m.flagged, coDetected: Boolean(m.co_detected), twin: Boolean(c.twin_of) };
  return { kind: m.type };
};

interface LegacyCase extends Joinable { population: string; detectors: string[] }
const suffixOf = (key: string) => key.slice(key.indexOf('--') + 2);
/** Most specific first: bytes, expected ranges and fixture name; then each loosened in turn. */
const contentKeys = (hash: string, expected: unknown, key: string) => [`${hash}|${expected}|${suffixOf(key)}`, `${hash}|${expected}`, `${hash}|${suffixOf(key)}`, hash];
const legacyCases: LegacyCase[] = [];
/** The detector families a legacy row names (its contract and targets). */
const attributed = new Map<string, string[]>();
const fixtureDetectors: Record<string, string[]> = await readJson(path.join(root, 'benchmarks/fixture-detectors.json'));
const legacyCategoriesWithoutReport: string[] = [];
const legacySlugs = new Set<string>();
for (const category of categories) {
  const population = populationOfCategory(category.id);
  if (!population) continue;
  const reportFile = path.join(resultsDir, `${category.id}.json`);
  if (!existsSync(reportFile)) { legacyCategoriesWithoutReport.push(category.id); continue; }
  const report = await readJson(reportFile);
  const corpus = await readJson(path.join(root, category.corpus));
  const fixtures = new Map<string, { content: string; expected: { start: number; end: number }[] }>(corpus.fixtures.map((f: any) => [f.id, f]));
  const rows = new Map<string, Record<string, Normalised>>();
  for (const scanner of report.scanners) {
    if (scanner.status !== 'complete') continue;
    for (const row of scanner.rows) {
      const entry = rows.get(row.id) ?? {}; entry[scanner.id] = normaliseLegacy(row); rows.set(row.id, entry);
      if (scanner.id === SCANNER) attributed.set(`${category.id}--${row.id}`, [...new Set([row.contract, ...(row.targets ?? [])].filter((d: string) => detectorIds.has(d)))] as string[]);
    }
  }
  for (const [id, scanners] of rows) {
    const slug = `${category.id}--${id}`;
    legacySlugs.add(slug);
    const fixture = fixtures.get(id)!;
    const joinKeys = population === PUBLIC ? contentKeys(sha256(fixture.content), JSON.stringify(fixture.expected.map(e => [e.start, e.end])), slug) : [slug];
    legacyCases.push({ key: slug, scanners, joinKeys, population, detectors: [...new Set([...(fixtureDetectors[slug] ?? []), ...(attributed.get(slug) ?? [])])].filter(d => detectorIds.has(d)) });
  }
}

// -- new side ------------------------------------------------------------------------------------------------------
interface NextCase extends Joinable { population: string; detectors: string[]; tier: string; kind: string; twin: boolean }
const nextCases: NextCase[] = [];
const artifacts = new Map<string, RunArtifact>();
const notCompared: ParityReport['notCompared'] = [];
const snapshotFile = option('public-snapshot');
let snapshot: { identity: { corpus_digest: string }; cases: { id: string; content: string; expected: { start: number; end: number }[] }[] } | undefined;
if (snapshotFile) snapshot = await readJson(resolve(snapshotFile));

for (const population of Object.keys(product.policy.populations)) {
  const bytes = await readFile(path.join(artifactsDir, population, 'artifact.json'));
  const { artifact } = readRunArtifact(bytes);
  artifacts.set(population, artifact);
  const hashes = new Map<string, { hash: string; expected: string }>();
  if (population === PUBLIC && snapshot) {
    if (snapshot.identity.corpus_digest !== artifact.manifest.evidence.corpus_digest) throw new Error('The public snapshot is not the corpus the public artifact was run on (corpus_digest differs).');
    for (const c of snapshot.cases) hashes.set(c.id, { hash: sha256(c.content), expected: JSON.stringify(c.expected.map(e => [e.start, e.end])) });
  }
  const perScanner = new Map<string, Record<string, Normalised>>();
  const cases = new Map<string, CaseResult>();
  for (const run of artifact.scanners) for (const c of run.cases) {
    const entry = perScanner.get(c.case_id) ?? {}; entry[run.scanner] = normaliseNext(c); perScanner.set(c.case_id, entry);
    if (run.scanner === SCANNER) cases.set(c.case_id, c);
  }
  for (const [id, scanners] of perScanner) {
    const c = cases.get(id)!;
    const h = hashes.get(id);
    nextCases.push({ key: id, scanners, joinKeys: population === PUBLIC ? (h ? contentKeys(h.hash, h.expected, id) : [`unjoinable:${id}`]) : [id], population, tier: c.tier, kind: c.kind, twin: Boolean(c.twin_of), detectors: detectorsOf(c, detectorIds, taxonomyDetectors) });
  }
}

const joins: ParityReport['joins'] = {};
const pairs: CasePair[] = [];
let publicJoin: JoinResult | undefined;
for (const population of [PUBLIC, REGRESSION, POLICY]) {
  if (population === PUBLIC && !snapshot) { notCompared.push({ area: 'per-fixture outcomes, public-evidence-snapshot', reason: 'no --public-snapshot was given, so the legacy fixtures cannot be matched to canonical ids (the artifact carries no content). Provide the evidence release asset credential-eval-corpus-snapshot.json.' }); continue; }
  const result = joinByKeys(population, legacyCases.filter(c => c.population === population), nextCases.filter(c => c.population === population));
  if (population === PUBLIC) publicJoin = result;
  pairs.push(...result.pairs);
  joins[population] = { byTier: result.byTier, pairs: result.pairs.length, unmatchedLegacy: result.unmatchedLegacy.length, unmatchedNext: result.unmatchedNext.length, ambiguousLegacy: result.ambiguous.legacy, ambiguousNext: result.ambiguous.next };
}
const outcomes = compareOutcomes(pairs);

// -- families --------------------------------------------------------------------------------------------------------
const legacyFamilies: LegacyFamily[] = legacyStatus.families.map((f: any) => ({
  family: f.family, status: f.status, reasons: f.reasons, evidenceTier: f.evidenceTier ?? null, evidenceBasis: f.evidenceBasis ?? null,
  qualificationProfile: f.qualificationProfile ?? null, taxonomyFamilies: f.taxonomyFamilies, evidence: f.evidence,
  axisIds: f.fixtureProfile?.cells ? { positiveContext: f.fixtureProfile.cells.positiveContextAxisIds, control: f.fixtureProfile.cells.controlAxisIds, confusion: f.fixtureProfile.cells.confusionAxisIds } : undefined,
}));
const nextFamilies: NextFamily[] = view.families.map((f: any) => ({
  family: f.family, taxonomyFamilies: f.taxonomyFamilies.map((t: any) => t.id), evidence: f.evidence,
  axisIds: f.fixtureProfile?.cells ? { positiveContext: f.fixtureProfile.cells.positiveContextAxisIds, control: f.fixtureProfile.cells.controlAxisIds, confusion: f.fixtureProfile.cells.confusionAxisIds } : undefined,
  status: { value: f.status.value, reasons: f.status.reasons, evidenceTier: f.status.evidenceTier ?? null, evidenceBasis: f.status.evidenceBasis ?? null, qualificationProfile: f.status.qualificationProfile ?? null, methodsNotRun: f.status.methodsNotRun },
  populations: f.populations.map((p: any) => {
    const c = p.scanners.find((s: any) => s.scanner === SCANNER)?.counts;
    return { population: p.population, role: p.role, cases: c.cases, pending: c.pending, notMeasured: c.notMeasured, positives: c.positives['must-redact'].cases + c.positives.policy.cases, benign: c.benign.cases, twinPairs: c.twins.pairs };
  }),
}));

// What the matched cases show the legacy floor counts hold beyond the new ones, per family and cause, over the floors population.
const adjustmentsByFamily: Record<string, Record<string, Record<string, number>>> = {};
{
  const add = (family: string, cause: string, field: string, amount: number) => {
    const fields = ((adjustmentsByFamily[family] ??= {})[cause] ??= {});
    fields[field] = (fields[field] ?? 0) + amount;
  };
  const kindOf = (c: NextCase) => (c.scanners[SCANNER]?.kind === 'control' ? ((c.scanners[SCANNER] as { twin: boolean }).twin ? 'twin' : 'benign') : c.scanners[SCANNER]?.kind === 'positive' ? 'positive' : 'pending');
  const nextByKey = new Map(nextCases.filter(c => c.population === PUBLIC).map(c => [c.key, c]));
  const legacyByKey = new Map(legacyCases.filter(c => c.population === PUBLIC).map(c => [c.key, c]));
  for (const pair of pairs.filter(p => p.population === PUBLIC)) {
    const l = legacyByKey.get(pair.legacy.key)!, n = nextByKey.get(pair.next.key)!;
    const kind = kindOf(n);
    if (kind === 'pending') {
      // Legacy drops T0 twins (benchmarks/lib/lattice.ts), so a pending twin was never a legacy fixture to book.
      if (n.twin) continue;
      for (const d of l.detectors) { add(d, 'pending-not-scored', 'totalFixtures', 1); add(d, 'pending-not-scored', n.kind === 'must-not-flag' ? 'benignCases' : 'positiveCases', 1); }
      continue;
    }
    for (const d of new Set([...l.detectors, ...n.detectors])) {
      const delta = Number(l.detectors.includes(d)) - Number(n.detectors.includes(d));
      if (!delta) continue;
      if (kind === 'twin') { add(d, 'twin-scope-vocabulary', 'totalFixtures', delta); add(d, 'twin-scope-vocabulary', 'twinPairs', delta); }
      else { add(d, 'fixture-attribution', 'totalFixtures', delta); add(d, 'fixture-attribution', kind === 'benign' ? 'benignCases' : 'positiveCases', delta); }
    }
  }
  for (const key of publicJoin?.unmatchedNext ?? []) {
    const n = nextByKey.get(key)!, kind = kindOf(n);
    if (kind === 'pending') continue;
    for (const d of n.detectors) {
      add(d, 'canonical-evidence-membership', 'totalFixtures', -1);
      add(d, 'canonical-evidence-membership', kind === 'twin' ? 'twinPairs' : kind === 'benign' ? 'benignCases' : 'positiveCases', -1);
    }
  }
}
// The differential review occurrences of the methods run, per family, with how many canonical ids the review ledger holds.
const reviewByFamily: Record<string, { occurrences: number; inLedger: number; byPeer: Record<string, number> }> = {};
const methodsFile = path.join(artifactsDir, PUBLIC, 'methods/artifact.json');
if (existsSync(methodsFile)) {
  const methods = readRunArtifact(await readFile(methodsFile)).artifact;
  const detectorsOfSeed = new Map(nextCases.filter(c => c.population === PUBLIC).map(c => [c.key, c.detectors]));
  for (const q of methods.review_queue ?? []) {
    if (q.method !== 'differential') continue;
    for (const d of detectorsOfSeed.get(seedCaseId(q.case_id, 'differential')) ?? []) {
      const row = (reviewByFamily[d] ??= { occurrences: 0, inLedger: 0, byPeer: {} });
      row.occurrences++; if (product.ledger.entries[q.id]) row.inLedger++;
      const peer = String(q.peer ?? 'unknown'); row.byPeer[peer] = (row.byPeer[peer] ?? 0) + 1;
    }
  }
}
const families = compareFamilies(legacyFamilies, nextFamilies, { floorsPopulation: PUBLIC, adjustmentsByFamily, axisOverlay: Boolean(view.policy.axisOverlay), reviewByFamily });

// -- identity ----------------------------------------------------------------------------------------------------------
const nextVersions: Record<string, string | null> = {};
for (const population of view.populations) for (const s of population.artifact.scanners) {
  if (s.id in nextVersions && nextVersions[s.id] !== s.version) nextVersions[s.id] = `${nextVersions[s.id]} / ${s.version}`; else nextVersions[s.id] = s.version;
}
const legacyRun = await readJson(path.join(resultsDir, 'run.json'));
const identity = compareIdentity(legacyRun.scannerVersions, nextVersions);

// -- known gaps -----------------------------------------------------------------------------------------------------------
const knownGaps = await readJson(path.join(root, 'benchmarks/known-gaps.json'));
const categoryIds = categories.map(c => c.id).sort((a, b) => b.length - a.length);
const populationOfSlug = (slug: string) => { const id = categoryIds.find(c => slug.startsWith(`${c}--`)); return id ? populationOfCategory(id) : undefined; };
const gaps = compareKnownGaps(
  knownGaps.issues.map((i: any) => ({ id: i.id, number: i.number, status: i.status, kind: i.kind, fixtures: i.fixtures ?? [] })),
  view.knownGaps,
  { populationOf: populationOfSlug, inLegacyRun: slug => legacySlugs.has(slug), sharedIdPopulations: [REGRESSION, POLICY] },
);

// -- what could not be compared ----------------------------------------------------------------------------------------------
for (const id of legacyCategoriesWithoutReport) notCompared.push({ area: `per-fixture outcomes, category ${id}`, reason: 'the legacy bench writes no report for it (calibration-only), so there is no legacy outcome.' });
// Which recorded run each compared artifact is. A comparison against a non-canonical run says so; darwin and linux runs are never mixed.
const registry = await readJson(path.join(root, 'benchmarks/official-runs.json'));
const hasMethodsRun = view.populations.some((p: any) => p.methodsArtifact);
const recorded = (artifact: { semanticDigest: string }, population: string, kind: 'plain' | 'methods') =>
  registry.runs.find((r: any) => r.population === population && (r.kind === 'methods') === (kind === 'methods') && r.artifact.semanticDigest === artifact.semanticDigest);
const basis = view.populations.flatMap((p: any) => [
  { population: p.population, run: recorded(p.artifact, p.population, 'plain') },
  ...(p.methodsArtifact ? [{ population: `${p.population} methods run`, run: recorded(p.methodsArtifact, p.population, 'methods') }] : []),
]);
const unrecorded = basis.filter((b: any) => !b.run).map((b: any) => b.population);
const nonCanonical = basis.filter((b: any) => b.run && !b.run.canonical).map((b: any) => b.run.id);
if (unrecorded.length) notCompared.push({ area: 'artifact identity', reason: `the artifact of ${unrecorded.join(', ')} is not a run recorded in benchmarks/official-runs.json (its semantic digest matches no recorded run), so its provenance is not established.` });
if (nonCanonical.length) notCompared.push({ area: 'canonical run', reason: `the artifacts compared include non-canonical runs (${nonCanonical.join(', ')}). The canonical measurement is the linux-x64 CI run; rerun this report against its artifacts.` });
if (hasMethodsRun) notCompared.push({ area: 'review ledger decisions', reason: 'the methods run has a review queue, keyed by canonical occurrence ids; the review ledger is keyed by legacy ids, so no ledger decision is applied to it (review-occurrence-identity). The per-family counts of occurrences and of how many canonical ids the ledger holds are in the status attribution. The legacy mutation review entries (the legacy queue held mutation variants that need review, the new queue holds differential occurrences only) are not compared.' });
else notCompared.push({ area: 'review queue and review ledger', reason: 'the view has no methods run, so the new path has no review queue to join with the ledger; the legacy ids also need the re-key (legacy-id-rekey). The methods-dependent evidence fields are compared as "not measured".' });
notCompared.push({ area: 'candidate-regression inputs and protected holdout', reason: 'internal populations, not part of a public qualification view (docs/specs/qualification-inputs.md).' });
notCompared.push({ area: 'Next page data', reason: 'the report, family and fixture pages of the Next app still read the legacy files; the new qualification pages (/evaluation/qualification/) read the view this report compares. Compare them by page-level numbers: distribution and per-family status above are the numbers those pages display.' });

// -- recommendations --------------------------------------------------------------------------------------------------------------
const cf = families.counterfactual;
const heldSummary = Object.entries(families.heldBy).map(([causes, n]) => `${n} by ${causes}`).join('; ') || 'none';
const review = Object.values(reviewByFamily);
const peerTotals: Record<string, number> = {};
for (const r of review) for (const [peer, n] of Object.entries(r.byPeer)) peerTotals[peer] = (peerTotals[peer] ?? 0) + n;
const recommendations = [
  `Status: the legacy path reads ${cf.legacyStable} stable families and the new path ${cf.nextStable}. Held back (legacy-stable families the new path does not read stable): ${heldSummary}. Not applied: nothing here changes a status.`,
  hasMethodsRun
    ? `Review ledger: every differential occurrence of the methods run is keyed by a canonical id and the ledger is keyed by legacy ids (${review.reduce((a, r) => a + r.inLedger, 0)} of ${review.reduce((a, r) => a + r.occurrences, 0)} family-attributed occurrences are in the ledger; per peer ${JSON.stringify(peerTotals)}). Two decisions are needed: re-key the ledger decisions to the canonical occurrence ids of the pinned peers, and decide whether the differential gate reads the peers the legacy run scanned (gitleaks, trufflehog) or every pinned peer (flare-redact and openredaction add occurrences no one has reviewed). Not applied: both change which disagreements a status depends on.`
    : 'Methods: the view has no methods run. A methods run of the floors population (docs/specs/official-runs.md, "The methods run") is needed before the metamorphic, mutation and differential gates are measured.',
  'Policy corpus: the T3 route floors read the 19-case policy corpus alone. Whether the floors, the corpus or the route change is a product policy decision. Not applied.',
  'Twin scope: confirm with credential-eval how a twin control is scoped (case family against the finding family) before the new path decides twin discrimination; every differing control in this report is a twin whose finding is present on both sides.',
  'Re-key: resolve the legacy-id re-key (qualification-inputs.json populations[0].rekey) with the evidence release id map, then apply the legacy review-ledger decisions and disputed properties to canonical ids, so the ledger joins are measured instead of listed.',
];

const identities: Record<string, unknown> = {
  legacy: {
    package: `${legacyStatus.publishedPackage.packageName}@${legacyStatus.publishedPackage.version}`,
    fixtureIndex: legacyStatus.fixtureIndex.digest, fixtureCount: legacyStatus.fixtureIndex.fixtureCount, taxonomyDigest: legacyStatus.taxonomyDigest,
    scanners: legacyRun.scannerVersions, caseCount: legacyStatus.caseCount, familyCount: legacyStatus.familyCount, distribution: legacyStatus.distribution,
  },
  new: {
    publication: view.publication, policyRevision: view.policy.revision, adapter: view.adapter, scanners: nextVersions, distribution: view.distribution, stableDistribution: view.stableDistribution,
    populations: view.populations.map((p: any) => ({ run: recorded(p.artifact, p.population, 'plain')?.id ?? 'not recorded', population: p.population, role: p.role, runClass: p.runClass, semanticDigest: p.artifact.semanticDigest, configHash: p.artifact.configHash, evidenceTag: p.artifact.evidence.release?.tag, methods: p.artifact.methods, caseCount: p.artifact.caseCount,
      ...(p.methodsArtifact ? { methodsRun: { run: recorded(p.methodsArtifact, p.population, 'methods')?.id ?? 'not recorded', semanticDigest: p.methodsArtifact.semanticDigest, configHash: p.methodsArtifact.configHash, methods: p.methodsArtifact.methods, caseCount: p.methodsArtifact.caseCount } } : {}) })),
    axisOverlay: view.policy.axisOverlay ?? null,
  },
};

const sections = { identity: identity, membership: families.membership, status: families.status, evidence: families.evidence, outcomes: outcomes.section, knownGaps: gaps };
const report: ParityReport = {
  schema: PARITY_SCHEMA, identities, causes: CAUSES, sections, statusRows: families.statusRows, counterfactual: cf, heldBy: families.heldBy, outcomeGroups: outcomes.groups, joins, notCompared,
  summary: summarise(sections), recommendations,
};

const prefix = resolve(option('out') ?? 'docs/generated/qualification-parity');
await mkdir(path.dirname(prefix), { recursive: true });
await writeFile(`${prefix}.json`, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(`${prefix}.md`, renderMarkdown(report));
const s = report.summary;
console.log(`Compared ${s.compared}: ${s.equal} equal, ${s.explained} expected-structural, ${s.unexplained} unexplained. Status counterfactual ${JSON.stringify(cf)}; held back ${JSON.stringify(families.heldBy)}`);
console.log(`Wrote ${path.relative(process.cwd(), prefix)}.json and .md`);
if (flag('strict') && s.unexplained > 0) { console.error(`${s.unexplained} unexplained difference(s)`); process.exit(1); }
