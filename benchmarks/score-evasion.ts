/**
 * Score-evasion and negative-evidence abuse evaluation (#289).
 *
 *   npm run evasion:run -- --product <clean redact-secret checkout> [--runs 2] [--publish evidence/<issue>/score-evasion-aggregate.json]
 *
 * Reshapes reviewed development and regression fixtures with the deterministic
 * operators in benchmarks/lib/score-evasion.ts, runs every variant through the
 * product's maintainer-local shadow evaluation path (redact-secret#771,
 * `cargo run --release --locked -p redact-secret --example shadow_evaluation`)
 * `--runs` times and once through the product CLI's plain scan, and writes:
 *
 * - results-output/score-evasion/ (git-ignored, maintainer-local): the
 *   variants, both raw shadow outputs, the plain scan, per-variant outcomes,
 *   band shifts and the operators that moved a band;
 * - the public aggregate (schemas/score-evasion-aggregate-v1.json), validated
 *   by evasionAggregateProblems and read by the #257 contract's Q4 gates.
 *   `--publish` copies it to a tracked path, only from a clean benchmark tree.
 *
 * stdout carries counts, identities and verdicts only. Protected holdout is
 * never read. Spec: docs/specs/score-evasion.md.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCategoryInputs } from './lib/candidate-features.ts';
import { canonicalJson } from './lib/adversarial-intake.ts';
import {
  DEFAULT_OUTPUT_DIR, EVALUATION_VERSION, PROJECTION_CUT, baseCandidates, bandRank, buildAggregate, buildVariants, evaluateVariant,
  operatorSetHash, parseShadowOutput, resolveLocalOutput, selectBases, type PlainFinding, type ShadowRun, type Variant,
} from './lib/score-evasion.ts';
import { evasionAggregateProblems, evaluatePromotion, loadPromotionContract, metricsFromEvasionAggregate } from './lib/scorer-promotion.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const usage = 'npm run evasion:run -- --product <clean redact-secret checkout> [--runs <n>=2] [--publish <tracked path>/score-evasion-aggregate.json]';
const sha256 = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');

const options: Record<string, string> = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) {
  const key = argv[i], value = argv[i + 1];
  if (!/^--(product|runs|publish)$/.test(key ?? '') || value === undefined || key.slice(2) in options) throw new Error(usage);
  options[key.slice(2)] = value;
}
if (!options.product) throw new Error(usage);
const runs = Number(options.runs ?? 2);
if (!Number.isInteger(runs) || runs < 2) throw new Error('--runs must be an integer of at least 2: instability is detected by comparing runs');
const product = path.resolve(options.product);

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

// Product identity: an exact, clean commit, and the scoring artifact read at that commit.
const sourceRevision = git(product, ['rev-parse', 'HEAD']);
if (git(product, ['status', '--porcelain', '--untracked-files=no'])) throw new Error('The product checkout has tracked changes; evaluate a clean checkout of the exact commit.');
const ARTIFACT = 'docs/contracts/scoring/shadow-scoring-artifact.json';
const artifactBytes = Buffer.from(execFileSync('git', ['show', `${sourceRevision}:${ARTIFACT}`], { cwd: product }));
const artifact = JSON.parse(artifactBytes.toString('utf8'));
/**
 * The shadow path compiles the core's own source (it is not a packaged
 * artifact), so the candidate is identified by the sources it compiles: the
 * SHA-256 of the canonical (path, blob SHA-256) listing of the workspace
 * manifests, the lockfile, and the core and CLI crates at the commit.
 */
function candidateSourceHash(): string {
  const listing = git(product, ['ls-tree', '-r', sourceRevision, '--', 'Cargo.toml', 'Cargo.lock', 'crates/secret-scan-core', 'crates/secret-scan-cli'])
    .split('\n').filter(Boolean).map(line => line.split('\t')[1]).sort();
  return sha256(canonicalJson(listing.map(file => [file, sha256(execFileSync('git', ['show', `${sourceRevision}:${file}`], { cwd: product, maxBuffer: 1 << 28 }))])));
}

const benchmarkCommit = git(root, ['rev-parse', 'HEAD']);
const benchmarkDirty = git(root, ['status', '--porcelain']) !== '';

const outputDir = resolveLocalOutput(root, DEFAULT_OUTPUT_DIR, path.resolve, path.sep);
mkdirSync(outputDir, { recursive: true, mode: 0o700 });
const writeLocal = (name: string, content: string) => writeFileSync(path.join(outputDir, name), content, { mode: 0o600 });

function shadow(inputs: { id: string; text: string }[]): { stdout: string; run: ShadowRun } {
  const stdout = execFileSync('cargo', ['run', '--quiet', '--release', '--locked', '-p', 'redact-secret', '--example', 'shadow_evaluation', '--'], {
    cwd: product, input: inputs.map(i => JSON.stringify(i)).join('\n') + '\n', encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const run = parseShadowOutput(stdout);
  if (run.header.artifactRevision !== artifact.artifact.revision || run.header.modelFingerprint !== artifact.modelFingerprint) throw new Error('The shadow evaluation header does not match the scoring artifact at the product commit.');
  return { stdout, run };
}

/** Plain product scan: the product CLI's safe JSON report over one file per variant. */
function plainScan(variants: Variant[]): Map<string, { findings: PlainFinding[] } | { failure: string }> {
  const scratch = mkdtempSync(path.join(tmpdir(), 'score-evasion-plain-'));
  const out = new Map<string, { findings: PlainFinding[] } | { failure: string }>();
  try {
    const files = variants.map((v, i) => { const file = path.join(scratch, `${i}.txt`); writeFileSync(file, v.text, { mode: 0o600 }); return file; });
    for (let start = 0; start < files.length; start += 250) {
      const chunk = files.slice(start, start + 250);
      let stdout: string;
      try {
        stdout = execFileSync('cargo', ['run', '--quiet', '--release', '--locked', '-p', 'redact-secret-cli', '--', '--json', '--', ...chunk], { cwd: product, encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (error) {
        const e = error as { status?: number; stdout?: string };
        if (e.status !== 1 || !e.stdout) throw new Error(`plain product scan failed with status ${e.status}`);
        stdout = e.stdout; // status 1: findings exist
      }
      const report = JSON.parse(stdout);
      for (const s of report.sources) out.set(variants[Number(path.basename(s.source, '.txt'))].id, { findings: s.findings.map((f: PlainFinding) => ({ start: f.start, end: f.end, detector: f.detector, type: f.type, confidence: f.confidence, action: f.action })) });
      for (const f of report.failures) out.set(variants[Number(path.basename(f.source, '.txt'))].id, { failure: f.code });
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  return out;
}

// 1. Bases: reviewed development and regression fixtures only.
const candidates = baseCandidates(loadCategoryInputs(root));
const baseRun = shadow(candidates.map(c => ({ id: c.id, text: c.content }))).run;
const bases = selectBases(candidates, baseRun.byInput);

// 2. Variants, the shadow path `runs` times, and one plain scan.
const variants = buildVariants(bases);
const ids = new Set<string>();
for (const v of variants) { if (ids.has(v.id)) throw new Error(`duplicate variant id ${v.id}`); ids.add(v.id); }
const inputs = variants.map(v => ({ id: v.id, text: v.text }));
writeLocal('inputs.jsonl', inputs.map(i => JSON.stringify(i)).join('\n') + '\n');
const shadowRuns: ShadowRun[] = [];
for (let i = 1; i <= runs; i++) { const { stdout, run } = shadow(inputs); writeLocal(`shadow-run-${i}.jsonl`, stdout); shadowRuns.push(run); }
const plain = plainScan(variants);
writeLocal('plain-scan.json', JSON.stringify(Object.fromEntries(plain), null, 1) + '\n');

// 3. Outcomes and the aggregate.
const outcomes = variants.map(v => evaluateVariant(v, shadowRuns, plain.get(v.id)));
const header = shadowRuns[0].header;
if (header.modelFingerprint !== artifact.modelFingerprint) throw new Error('model fingerprint mismatch');
const identity = {
  sourceRevision,
  candidateArtifactHash: candidateSourceHash(),
  scoringArtifactRevision: header.artifactRevision,
  modelFingerprint: header.modelFingerprint,
  scoringArtifactSha256: sha256(artifactBytes),
  tuningManifestHash: artifact.tuningManifest?.hash ?? null,
  scoringIdentity: artifact.calibration?.scoring?.identity ?? null,
};
const sourceHash = sha256(canonicalJson(['benchmarks/lib/score-evasion.ts', 'benchmarks/score-evasion.ts'].map(f => [f, sha256(readFileSync(path.join(root, f)))])));
const opHash = operatorSetHash(bases, sourceHash);
const aggregate = buildAggregate(outcomes, identity, benchmarkCommit, opHash);
const problems = evasionAggregateProblems(aggregate);
const contract = loadPromotionContract(root);
const promotion = evaluatePromotion(contract, { metrics: metricsFromEvasionAggregate(aggregate as never, contract) });
const q4 = promotion.questions.find(q => q.id === 'Q4')!;
writeLocal('score-evasion-aggregate.json', JSON.stringify(aggregate, null, 2) + '\n');

// 4. Maintainer-local detail: band shifts and which operators moved a band. Never published.
const baseBand = new Map(bases.map(b => [b.id, b.band]));
const variantById = new Map(variants.map(v => [v.id, v]));
const shifts: Record<string, Record<string, number>> = {};
const moved: { variant: string; from: string | null; to: string | null; legacyFlagged: boolean; candidateFlagged: boolean }[] = [];
for (const o of outcomes) {
  const v = variantById.get(o.id)!;
  if (o.status !== 'resolved' || v.expectation !== 'must-redact' || v.baseAuthority !== 'statistical') continue;
  const from = baseBand.get(v.baseId) ?? null, to = o.covering?.authority === 'statistical' ? o.covering.band : o.covering ? `deterministic:${o.covering.band}` : null;
  const kind = to === null ? 'lost' : to.startsWith('deterministic') ? 'deterministic' : bandRank(to) < bandRank(from ?? 'none') ? 'down' : bandRank(to) > bandRank(from ?? 'none') ? 'up' : 'same';
  (shifts[o.attackClass] ??= { down: 0, same: 0, up: 0, lost: 0, deterministic: 0 })[kind]++;
  if (kind === 'down' || (!o.candidateFlagged && o.legacyFlagged)) moved.push({ variant: o.id, from, to, legacyFlagged: o.legacyFlagged, candidateFlagged: o.candidateFlagged });
}
const periodicControls = outcomes.filter(o => o.status === 'resolved' && o.attackClass === 'periodic-body' && o.expectation === 'control');
const periodicBands: Record<string, number> = {};
for (const o of periodicControls) { const k = o.covering ? `${o.covering.authority}:${o.covering.band}` : 'no-finding'; periodicBands[k] = (periodicBands[k] ?? 0) + 1; }
const violations = outcomes.filter(o => o.invariantViolations.length).map(o => ({ variant: o.id, violations: o.invariantViolations }));
// The same variants under the product's narrowest reading of a promotion (only band `none` drops a finding, reason `band-none`).
const noneCut = buildAggregate(variants.map(v => evaluateVariant(v, shadowRuns, plain.get(v.id), 'low')), identity, benchmarkCommit, opHash);
// Boundary sweeps: per base, the band along the boundary-discontinuity steps; a jump of two or more bands between adjacent steps is a sharp discontinuity.
const sweeps: Record<string, { operator: string; band: string | null; score: number | null }[]> = {};
for (const o of outcomes) {
  if (o.attackClass !== 'boundary-discontinuity' || o.status !== 'resolved') continue;
  const v = variantById.get(o.id)!;
  if (v.expectation !== 'must-redact' || v.baseAuthority !== 'statistical') continue;
  (sweeps[v.baseId] ??= []).push({ operator: v.operator, band: o.covering?.band ?? null, score: o.covering?.score ?? null });
}
const sharpJumps = Object.values(sweeps).reduce((n, steps) => n + steps.slice(1).filter((s, i) => Math.abs(bandRank(s.band ?? 'none') - bandRank(steps[i].band ?? 'none')) >= 2).length, 0);
writeLocal('detail.json', JSON.stringify({
  visibility: 'maintainer-local', evaluationVersion: EVALUATION_VERSION, projectionCut: PROJECTION_CUT,
  benchmark: { commit: benchmarkCommit, dirty: benchmarkDirty }, identity, operatorSetHash: opHash,
  bases: bases.map(b => ({ id: b.id, expectation: b.expectation, authority: b.authority, specificity: b.specificity, band: b.band })),
  bandShifts: shifts, periodicControlBands: periodicBands, movedVariants: moved, invariantViolations: violations,
  noneCutProjection: { totals: noneCut.totals, attackClasses: noneCut.attackClasses }, boundarySweeps: sweeps, sharpJumps, outcomes,
  q4,
}, null, 1) + '\n');

// 5. Report: counts, identities and verdicts only.
const t = aggregate.totals;
console.log([
  `Score-evasion evaluation (${EVALUATION_VERSION}, shadow mode, candidate projection at band >= ${PROJECTION_CUT}); holdout read: none`,
  `  product ${sourceRevision}, artifact revision ${identity.scoringArtifactRevision}, model ${identity.modelFingerprint.slice(0, 16)}...`,
  `  benchmark ${benchmarkCommit}${benchmarkDirty ? ' (dirty: not citable)' : ''}; operator set ${opHash.slice(0, 16)}...`,
  `  bases ${bases.length}, variants ${t.variants} (unresolved ${t.unresolved}, unstable ${t.unstable}, controls ${t.controls})`,
  `  detection preserved: shadow ${t.detectionPreserved} / legacy ${t.legacyDetectionPreserved}; leaked only under shadow ${t.leakedOnlyUnderCandidate}`,
  `  false alarms: shadow ${t.falseAlarms} / legacy ${t.legacyFalseAlarms}; negative evidence ${t.negativeEvidenceApplied} (on partial match ${t.negativeEvidenceOnPartialMatch})`,
  `  invariants: ${Object.entries(aggregate.invariants).map(([k, v]) => `${k}=${v}`).join(', ')}`,
  `  aggregate problems: ${problems.length ? problems.join('; ') : 'none'}`,
  `  Q4 (informational for beta.9): ${q4.verdict}${q4.gates.filter(g => g.verdict !== 'pass').map(g => `\n    ${g.id}: ${g.verdict}`).join('')}`,
  `  maintainer-local detail: ${path.relative(root, outputDir)}/ (never publish it)`,
].join('\n'));

if (violations.length) { console.error(`${violations.length} variant(s) violate a product invariant; see ${path.relative(root, outputDir)}/detail.json. Do not publish a recipe.`); process.exitCode = 1; }
if (problems.length) process.exitCode = 1;
if (options.publish) {
  const target = path.resolve(root, options.publish);
  if (path.basename(target) !== 'score-evasion-aggregate.json' || target.startsWith(path.resolve(root, 'results-output') + path.sep)) throw new Error('--publish writes only a tracked score-evasion-aggregate.json');
  if (benchmarkDirty) throw new Error('--publish needs a clean benchmark tree: the aggregate binds benchmark.commit with dirty: false');
  if (problems.length || violations.length) throw new Error('--publish refused: the aggregate has problems or an invariant was violated');
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(aggregate, null, 2) + '\n');
  console.log(`  published aggregate: ${path.relative(root, target)}`);
}
