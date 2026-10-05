/**
 * The candidate diff and the saved-baseline comparison, read from validated RunArtifacts (#657).
 *
 * The legacy candidate diff (`npm run eval:candidate` -> `public/results/candidate-evidence-v1.json`, compared with `baselines/<version>.json`) re-runs the legacy
 * engine. This consumer replaces its question, "what does an unpublished product build change against the saved release", with artifacts only:
 *
 *  - the candidate side is the `candidate-run-<population>` artifacts of a product candidate replay (`official-runs.yml` input `candidate`, #698), accepted only
 *    when every one is exploratory and internal, its run record names the registered candidate (id, commit, the exact tarball sha256 set of
 *    `benchmarks/product-candidates.json`), its receipt names the same tarball digests, its bytes hash to the record and its repeat runs agreed;
 *  - the saved baseline is the control the adoption record binds by archive digest (the published build on the same engine, evidence and configuration), never a
 *    legacy `baselines/<version>.json` (those are keyed by legacy slugs and stay with the oracle);
 *  - both sides are bound to each other: engine, protocol, configuration hash, evidence identity, every peer's identity and every peer's per-case results are equal,
 *    so the product build is the only difference. The case universe must be equal too: a cohort change is not a candidate effect.
 *
 * Output is a projection, never evidence: `publication: internal`, an allowlist (case id, family, kind, tier, a measurement label and counts; no spans, no bytes,
 * no finding text), never a recorded run, never public. It reads the per-case measurement as recorded and re-scores nothing; "fixed" and "worse" use the same
 * definitions as `scripts/candidate-replay-report.ts` (a pass is every span EXACT, or a control that is not flagged), so the two readings can be compared.
 * Spec: docs/specs/product-candidate-replay.md.
 */
import type { CaseResult, Measurement, RunArtifact, ScannerIdentity } from './run-artifact.ts';

export const CANDIDATE_DIFF_SCHEMA = 'redact-secret/candidate-diff-from-artifacts/v1';
export const PLAIN_POPULATIONS = ['public-evidence-snapshot', 'regression-corpus', 'policy-corpus'] as const;
export const METHODS_KEY = 'public-evidence-snapshot/methods';
export const PRODUCT = 'redact-secret';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const SHA = /^[0-9a-f]{40}$/;

export interface RunRecord {
  schema: string; population: string; platform: string; runClass: string; publication: string;
  engine: { name: string; version: string; revision?: string; protocol: string };
  evidence: unknown; configHash: string;
  artifact: { digest: string; semanticDigest: string };
  determinism?: { runs: number; semanticDigestsEqual: boolean };
  productCandidate?: { id: string; commit: string; version: string; published: boolean; packages: { name: string; sha256: string }[]; receipt?: string };
}
export interface Receipt {
  schema: string; candidate: string; commit: string; version: string; platform: string; runClass: string; publication: string;
  packages: { name: string; version: string; tarballSha256: string; files: { path: string; sha256: string }[] }[];
}
export interface RegisteredCandidate {
  id: string; product: { commit: string; version: string; published: boolean };
  platform: string; runClass: string; publication: string;
  packages: { name: string; sha256: string; platform: string | null }[];
}
/** One side's evidence for one run: the record, the digests of the bytes actually read, and (plain populations only) the parsed artifact. */
export interface Side {
  key: string; record: RunRecord; artifactDigest: string; semanticDigest: string | null; receipt?: Receipt; artifact?: RunArtifact;
}
export interface DiffInput {
  candidate: RegisteredCandidate;
  /** The saved baseline: the control the adoption record binds, by archive digest. */
  control: { archive: { release: string; sha256: string }; product: { version: string }; sides: Side[] };
  candidateSides: Side[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const identityOf = (s: ScannerIdentity) => ({ id: s.id, version: s.version, mode: s.mode, adapter: s.adapter, configuration_hash: s.configuration_hash });

/** What a case measured, as one label that carries no bytes. */
export const outcomeLabel = (m: Measurement | undefined): string => {
  if (!m) return 'absent';
  if (m.type === 'positive') return m.span_outcomes.length ? m.span_outcomes.join('/') : 'no-spans';
  if (m.type === 'control') return m.flagged ? 'flagged' : 'clear';
  return m.type;
};
/** true: passes, false: fails, null: outside every denominator (pending, not measured). */
export const passes = (m: Measurement | undefined): boolean | null => {
  if (!m) return null;
  if (m.type === 'positive') return m.span_outcomes.length > 0 && m.span_outcomes.every(o => o === 'EXACT');
  if (m.type === 'control') return !m.flagged;
  return null;
};
const bytesOf = (m: Measurement | undefined) => ({
  leaked: m?.type === 'positive' ? m.leaked_bytes : 0, collateral: m?.type === 'positive' ? m.collateral_bytes : 0, findings: m?.type === 'control' ? m.findings : 0,
});
/** Worse by the recorded measurement only: a pass that fails now, more leaked or collateral bytes, a control now flagged or with more findings. */
export const isWorse = (a: Measurement | undefined, b: Measurement | undefined): boolean => {
  const pa = passes(a), pb = passes(b), x = bytesOf(a), y = bytesOf(b);
  if (pa === true && pb === false) return true;
  if (pa === false && pb === false) return y.leaked > x.leaked || y.collateral > x.collateral || y.findings > x.findings;
  if (pa === true && pb === true) return y.collateral > x.collateral;
  return false;
};

const productRun = (artifact: RunArtifact) => artifact.scanners.find(s => s.scanner === PRODUCT);

/** Every reason the candidate artifacts must not be used against this baseline (empty: they are exactly what the registry and the control say). Pure; reads no file. */
export function candidateDiffProblems(input: DiffInput): string[] {
  const problems: string[] = [];
  const { candidate, control, candidateSides } = input;
  if (candidate.product.published !== false) problems.push(`candidate ${candidate.id} is published: a published build is a pin, not a candidate`);
  if (candidate.runClass !== 'exploratory' || candidate.publication !== 'internal') problems.push(`candidate ${candidate.id} is registered as ${candidate.runClass}/${candidate.publication}: an unpublished build is exploratory and internal`);
  if (!SHA.test(candidate.product.commit)) problems.push('the registered commit is not a full 40-character commit');
  if (!DIGEST.test(control.archive.sha256) || !control.archive.release) problems.push('the baseline is not bound to an archive release and sha256');
  const registered = candidate.packages.filter(p => p.platform === null || p.platform === candidate.platform);
  if (!registered.length || registered.some(p => !DIGEST.test(p.sha256))) problems.push('the registered tarball digests are missing or malformed');

  const keys = [...PLAIN_POPULATIONS, METHODS_KEY];
  for (const key of keys) {
    const c = candidateSides.find(s => s.key === key), b = control.sides.find(s => s.key === key);
    if (!c) problems.push(`${key}: no candidate artifact`);
    if (!b) problems.push(`${key}: the baseline holds no artifact`);
    if (!c) continue;
    const at = `${key} (candidate)`;
    const r = c.record;
    // 1. The class: a candidate run is never an accepted run and never public.
    if (r.runClass !== 'exploratory' || r.publication !== 'internal') problems.push(`${at}: run record is ${r.runClass}/${r.publication}, a candidate run is exploratory/internal`);
    if (c.artifact && (c.artifact.manifest.run_class !== 'exploratory' || c.artifact.manifest.publication !== 'internal')) problems.push(`${at}: the artifact says ${c.artifact.manifest.run_class}/${c.artifact.manifest.publication}, a candidate run is exploratory/internal`);
    if (r.platform !== candidate.platform) problems.push(`${at}: measured on ${r.platform}, the candidate is registered for ${candidate.platform}`);
    // 2. The bytes are the recorded bytes.
    if (r.artifact?.digest !== c.artifactDigest) problems.push(`${at}: the artifact bytes hash to ${c.artifactDigest}, the run record says ${r.artifact?.digest}`);
    if (c.semanticDigest !== null && r.artifact?.semanticDigest !== c.semanticDigest) problems.push(`${at}: the semantic digest is ${c.semanticDigest}, the run record says ${r.artifact?.semanticDigest}`);
    if (r.determinism?.semanticDigestsEqual !== true) problems.push(`${at}: the repeat runs did not agree`);
    // 3. The exact registered build.
    const pc = r.productCandidate;
    if (!pc) problems.push(`${at}: the run record names no product candidate`);
    else {
      if (pc.id !== candidate.id) problems.push(`${at}: the run measured candidate ${pc.id}, not ${candidate.id}`);
      if (pc.commit !== candidate.product.commit) problems.push(`${at}: the run measured commit ${pc.commit}, the registry holds ${candidate.product.commit}`);
      if (pc.published !== false) problems.push(`${at}: the run record calls the build published`);
      problems.push(...tarballProblems(at, pc.packages.map(p => ({ name: p.name, sha256: p.sha256 })), registered));
    }
    const receipt = c.receipt;
    if (!receipt) problems.push(`${at}: no product-candidate-receipt.json`);
    else {
      if (receipt.schema !== 'redact-secret/product-candidate-receipt/v1') problems.push(`${at}: receipt schema ${receipt.schema}`);
      if (receipt.candidate !== candidate.id || receipt.commit !== candidate.product.commit) problems.push(`${at}: the receipt is for ${receipt.candidate}@${receipt.commit}`);
      if (receipt.runClass !== 'exploratory' || receipt.publication !== 'internal') problems.push(`${at}: the receipt is ${receipt.runClass}/${receipt.publication}`);
      problems.push(...tarballProblems(`${at} receipt`, receipt.packages.map(p => ({ name: p.name, sha256: p.tarballSha256 })), registered));
      for (const p of receipt.packages) if (!p.files?.length) problems.push(`${at}: receipt package ${p.name} lists no installed file`);
    }
    // 4. The baseline is not a candidate run, and the two sides differ in the product build only.
    if (!b) continue;
    const base = `${key} (baseline)`;
    if (b.record.productCandidate || b.receipt) problems.push(`${base}: a candidate run cannot be the baseline`);
    if (b.artifact?.manifest.scanners.some(s => s.build === 'candidate')) problems.push(`${base}: a scanner in the baseline is a candidate build`);
    if (!same(b.record.evidence, r.evidence)) problems.push(`${key}: the evidence identity differs between the baseline and the candidate`);
    if (b.record.configHash !== r.configHash) problems.push(`${key}: the configuration hash differs`);
    if (b.record.engine?.version !== r.engine?.version || b.record.engine?.protocol !== r.engine?.protocol || b.record.engine?.revision !== r.engine?.revision) problems.push(`${key}: the engine differs between the baseline and the candidate`);
    if (b.record.platform !== r.platform) problems.push(`${key}: the platforms differ (${b.record.platform} against ${r.platform})`);
    if (b.record.determinism?.semanticDigestsEqual !== true) problems.push(`${base}: the repeat runs did not agree`);
    if (b.record.artifact?.digest !== b.artifactDigest) problems.push(`${base}: the artifact bytes hash to ${b.artifactDigest}, the run record says ${b.record.artifact?.digest}`);
    if (!c.artifact || !b.artifact) continue;
    const ma = b.artifact.manifest, mb = c.artifact.manifest;
    if (ma.engine.version !== mb.engine.version || ma.protocol_version !== mb.protocol_version || ma.config_hash !== mb.config_hash || !same(ma.evidence, mb.evidence)) problems.push(`${key}: the artifact manifests differ in engine, protocol, configuration or evidence`);
    const ids = (m: typeof ma) => m.scanners.map(s => s.id).sort();
    if (!same(ids(ma), ids(mb))) problems.push(`${key}: the scanner rosters differ`);
    for (const sa of ma.scanners) {
      const sb = mb.scanners.find(s => s.id === sa.id);
      if (!sb) continue;
      if (sa.id === PRODUCT) {
        if (sa.version !== control.product.version) problems.push(`${base}: the baseline product is ${sa.version}, the control is ${control.product.version}`);
        if (sb.version !== candidate.product.version) problems.push(`${at}: the candidate artifact reports product ${sb.version}, the registry holds ${candidate.product.version}`);
        if (sa.configuration_hash !== sb.configuration_hash || !same(sa.adapter, sb.adapter)) problems.push(`${key}: the product's configuration or adapter differs`);
      } else if (!same(identityOf(sa), identityOf(sb))) problems.push(`${key}: peer ${sa.id} differs in identity`);
    }
    // The case universe, and the peers, are equal; only the product's cases may differ.
    const pa = productRun(b.artifact), pb = productRun(c.artifact);
    if (!pa || !pb) { problems.push(`${key}: no ${PRODUCT} scanner run`); continue; }
    if (pa.status !== 'complete' || pb.status !== 'complete') problems.push(`${key}: the product run is not complete`);
    if (!c.artifact.scanners.every(s => s.status === 'complete')) problems.push(`${at}: a scanner is not complete`);
    if (!same(pa.cases.map(x => x.case_id).sort(), pb.cases.map(x => x.case_id).sort())) problems.push(`${key}: the product's case universe differs between the baseline and the candidate`);
    for (const peer of b.artifact.scanners) {
      if (peer.scanner === PRODUCT) continue;
      const other = c.artifact.scanners.find(s => s.scanner === peer.scanner);
      const index = new Map((other?.cases ?? []).map(x => [x.case_id, x]));
      const differing = peer.cases.filter(x => !same({ a: x.actual, m: x.measurement }, { a: index.get(x.case_id)?.actual, m: index.get(x.case_id)?.measurement })).length;
      if (!other || other.cases.length !== peer.cases.length || differing) problems.push(`${key}: peer ${peer.scanner} measured differently (${differing} case(s)): the product build is not the only difference`);
    }
  }
  const extra = candidateSides.map(s => s.key).filter(k => !keys.includes(k));
  if (extra.length) problems.push(`unexpected candidate artifact(s): ${extra.join(', ')}`);
  return [...new Set(problems)];
}

/** The tarball set must be the registered one exactly: same names, same digests, nothing missing or extra. */
function tarballProblems(at: string, named: { name: string; sha256: string }[], registered: { name: string; sha256: string }[]): string[] {
  const out: string[] = [];
  const byName = new Map(named.map(p => [p.name, p.sha256]));
  if (byName.size !== named.length) out.push(`${at}: a package is repeated`);
  for (const p of registered) {
    const seen = byName.get(p.name);
    if (seen === undefined) out.push(`${at}: ${p.name} is not listed`);
    else if (seen !== p.sha256) out.push(`${at}: ${p.name} tarball is ${seen}, the registry pins ${p.sha256}`);
  }
  for (const name of byName.keys()) if (!registered.some(p => p.name === name)) out.push(`${at}: ${name} is not a registered package of this candidate`);
  return out;
}

export interface PopulationDiff {
  population: string; cases: number; fixed: number; regressed: number; changed: number; unchanged: number; stillFailing: number;
  semanticDigest: { baseline: string; candidate: string };
  families: { family: string; cases: number; passBaseline: number; passCandidate: number }[];
  differing: { case_id: string; direction: 'fixed' | 'regressed' | 'changed'; family: string | null; kind: string; tier: string; baseline: string; candidate: string }[];
}
export interface CandidateDiff {
  schema: typeof CANDIDATE_DIFF_SCHEMA;
  /** Always `internal`: a candidate diff is a projection of an exploratory run, never public and never a recorded run. */
  publication: 'internal';
  runClass: 'exploratory';
  candidate: { id: string; commit: string; version: string; tarballs: { name: string; sha256: string }[] };
  baseline: { archive: { release: string; sha256: string }; productVersion: string };
  methods: { baselineSemanticDigest: string | null; candidateSemanticDigest: string | null; note: string };
  worsened: boolean;
  populations: PopulationDiff[];
}

/** The diff, or a refusal listing every reason. The candidate and the baseline are only read; nothing is re-scored. */
export function buildCandidateDiff(input: DiffInput): CandidateDiff {
  const problems = candidateDiffProblems(input);
  if (problems.length) throw new Error(`Refusing the candidate diff: ${problems.join('; ')}`);
  const populations: PopulationDiff[] = [];
  for (const key of PLAIN_POPULATIONS) {
    const b = input.control.sides.find(s => s.key === key)!, c = input.candidateSides.find(s => s.key === key)!;
    const pa = productRun(b.artifact!)!, pb = productRun(c.artifact!)!;
    const after = new Map<string, CaseResult>(pb.cases.map(x => [x.case_id, x]));
    const out: PopulationDiff = { population: key, cases: pa.cases.length, fixed: 0, regressed: 0, changed: 0, unchanged: 0, stillFailing: 0, semanticDigest: { baseline: b.semanticDigest!, candidate: c.semanticDigest! }, families: [], differing: [] };
    const families = new Map<string, { cases: number; passBaseline: number; passCandidate: number }>();
    for (const x of pa.cases) {
      const y = after.get(x.case_id)!;
      const family = families.get(x.family ?? '(no-family)') ?? { cases: 0, passBaseline: 0, passCandidate: 0 };
      family.cases++;
      if (passes(x.measurement) === true) family.passBaseline++;
      if (passes(y.measurement) === true) family.passCandidate++;
      families.set(x.family ?? '(no-family)', family);
      if (passes(y.measurement) === false) out.stillFailing++;
      if (same({ a: x.actual, m: x.measurement }, { a: y.actual, m: y.measurement })) { out.unchanged++; continue; }
      const direction = passes(x.measurement) === false && passes(y.measurement) === true ? 'fixed' : isWorse(x.measurement, y.measurement) ? 'regressed' : 'changed';
      out[direction]++;
      out.differing.push({ case_id: x.case_id, direction, family: x.family ?? null, kind: x.kind, tier: x.tier, baseline: outcomeLabel(x.measurement), candidate: outcomeLabel(y.measurement) });
    }
    out.differing.sort((p, q) => (p.case_id < q.case_id ? -1 : 1));
    out.families = [...families].sort(([p], [q]) => (p < q ? -1 : 1)).map(([family, v]) => ({ family, ...v }));
    populations.push(out);
  }
  const mb = input.control.sides.find(s => s.key === METHODS_KEY), mc = input.candidateSides.find(s => s.key === METHODS_KEY);
  const registered = input.candidate.packages.filter(p => p.platform === null || p.platform === input.candidate.platform);
  return {
    schema: CANDIDATE_DIFF_SCHEMA, publication: 'internal', runClass: 'exploratory',
    candidate: { id: input.candidate.id, commit: input.candidate.product.commit, version: input.candidate.product.version, tarballs: registered.map(p => ({ name: p.name, sha256: p.sha256 })) },
    baseline: { archive: input.control.archive, productVersion: input.control.product.version },
    methods: {
      baselineSemanticDigest: mb?.record.artifact.semanticDigest ?? null, candidateSemanticDigest: mc?.record.artifact.semanticDigest ?? null,
      note: 'The methods run is bound by its run record and byte digest only; its assertions and review occurrences are compared by scripts/candidate-replay-report.ts (candidate-effect.json).',
    },
    worsened: populations.some(p => p.regressed > 0),
    populations,
  };
}

/** Every reason a candidate diff must not be written or read as one (empty: it is what it says). Pure. */
export function candidateDiffArtifactProblems(diff: CandidateDiff): string[] {
  const problems: string[] = [];
  if (diff?.schema !== CANDIDATE_DIFF_SCHEMA) return [`not a ${CANDIDATE_DIFF_SCHEMA} artifact`];
  if (diff.publication !== 'internal' || diff.runClass !== 'exploratory') problems.push('a candidate diff is exploratory and internal; it is never public and never a recorded run');
  for (const p of diff.populations ?? []) {
    if (p.fixed + p.regressed + p.changed + p.unchanged !== p.cases) problems.push(`${p.population}: the counts do not add up to the cases`);
    if (p.differing.length !== p.fixed + p.regressed + p.changed) problems.push(`${p.population}: the differing rows do not match the counts`);
    if (p.families.reduce((n, f) => n + f.cases, 0) !== p.cases) problems.push(`${p.population}: the family cases do not add up to the cases`);
  }
  if (diff.worsened !== (diff.populations ?? []).some(p => p.regressed > 0)) problems.push('worsened does not follow from the regressed counts');
  return problems;
}

/**
 * The installed files a receipt lists, against the files the registered tarball actually holds (`installed`: the digest of every file extracted from the tarball whose
 * sha256 equals the registry's). Equal sets and digests mean the run measured those bytes, not merely a build with the same version string.
 */
export function receiptFilesProblems(receipt: Receipt, installed: { name: string; tarballSha256: string; files: { path: string; sha256: string }[] }[]): string[] {
  const problems: string[] = [];
  for (const p of receipt.packages) {
    const actual = installed.find(i => i.name === p.name);
    if (!actual) { problems.push(`${p.name}: no registered tarball was checked`); continue; }
    if (actual.tarballSha256 !== p.tarballSha256) problems.push(`${p.name}: the receipt names tarball ${p.tarballSha256}, the checked tarball is ${actual.tarballSha256}`);
    const listed = new Map(p.files.map(f => [f.path, f.sha256]));
    for (const f of actual.files) if (listed.get(f.path) !== f.sha256) problems.push(`${p.name}: ${f.path} ${listed.has(f.path) ? 'differs from' : 'is absent from'} the receipt`);
    for (const path of listed.keys()) if (!actual.files.some(f => f.path === path)) problems.push(`${p.name}: the receipt lists ${path}, the tarball does not hold it`);
  }
  return problems;
}
