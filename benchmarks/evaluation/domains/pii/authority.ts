/**
 * Which pipeline is the authority for PII measurement (#666).
 *
 * `benchmarks/pii-authority.json` holds one committed value, `legacy` or `new`, and nothing else decides it. It is independent of
 * the credential qualification authority file: a credential authority setting is not authorisation for PII (the issue says so), so
 * neither file reads, implies or checks the other.
 *
 * - `legacy`: the benchmark-owned scorer and the frozen Beta.11/Beta.13 evidence are the authority. The pii-eval measurement of the four
 *   benchmark populations is validated, published and shown beside it as exploratory evidence; it decides nothing.
 * - `new`: the pii-eval artifacts are the authority. It is allowed only while an owner authorisation is recorded in the file and every
 *   exit criterion holds; a repin, a changed policy or a changed population makes it stale until it is authorised again.
 *
 * The exit criteria are measured, not argued: each `computed` criterion is recomputed from the committed tree by `pii:authority:check`
 * and must equal the recorded state, so a criterion can neither be marked met by hand nor stay unmet after the evidence arrived.
 * `owner` criteria are decisions; the repository never records them on the owner's behalf.
 *
 * Pure, no `node:` import, so the Next services can import it. Spec: docs/specs/pii-authority.md. Decision:
 * docs/decisions/2026-10-05-keep-pii-authority-legacy-with-a-measured-exit-and-a-rehearsed-rollback.md.
 */
export const PII_AUTHORITY_SCHEMA = 'redact-secret/pii-authority/v1';
export const PII_AUTHORITY_FILE = 'benchmarks/pii-authority.json';
export type PiiAuthority = 'legacy' | 'new';
/** The value a missing file means: legacy, the state before any switch. */
export const DEFAULT_PII_AUTHORITY: PiiAuthority = 'legacy';

export type CriterionBasis = 'computed' | 'owner';
export type CriterionState = 'met' | 'unmet';
export interface PiiExitCriterion { id: string; basis: CriterionBasis; statement: string; state: CriterionState; evidence: string }

export interface PiiAuthorisation {
  release: string;
  acceptedOn: string;
  acceptedBy: string;
  decision: string;
  engineCommit: string;
  policyDigest: string;
  populationDigests: Record<string, string>;
}

export interface PiiAuthorityFile {
  schema: typeof PII_AUTHORITY_SCHEMA;
  authority: PiiAuthority;
  independence: string;
  legacy: { role: 'authority' | 'oracle'; source: string; oracle: { exitCondition: string; decision: string; decidedBy: string; reviewOn: string } };
  new: { target: { engine: string; populations: string[]; artifactSchema: string }; authorisation: PiiAuthorisation | null };
  exitCriteria: PiiExitCriterion[];
}

/** Every criterion the exit names, in the order the file lists them, with how it is decided. The file may not omit or add one. */
export const PII_EXIT_CRITERIA: readonly { id: string; basis: CriterionBasis }[] = [
  { id: 'population-dual-run-complete', basis: 'computed' },
  { id: 'linux-engine-replay-equal', basis: 'computed' },
  { id: 'official-mode-measurement', basis: 'computed' },
  { id: 'protected-path-live', basis: 'computed' },
  { id: 'legacy-callers-inventoried', basis: 'computed' },
  { id: 'rollback-rehearsed-for-target', basis: 'computed' },
  { id: 'scorer-basis-decided', basis: 'owner' },
  { id: 'owner-accepted-verdict', basis: 'owner' },
];

const DECISION_PATH = /^docs\/decisions\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/;
const HEX64 = /^[0-9a-f]{64}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** What a reader needs, checked field by field. Equivalent to `schemas/pii-authority-v1.json` (a test holds the two together). */
export function piiAuthorityShapeProblems(value: unknown): string[] {
  if (!object(value)) return ['the file is not an object'];
  const problems: string[] = [];
  const extra = (o: Record<string, unknown>, allowed: string[], at: string) => { for (const key of Object.keys(o)) if (!allowed.includes(key)) problems.push(`${at}: unknown field ${key}`); };
  extra(value, ['schema', 'authority', 'independence', 'legacy', 'new', 'exitCriteria'], 'file');
  if (value.schema !== PII_AUTHORITY_SCHEMA) problems.push(`schema must be ${PII_AUTHORITY_SCHEMA}`);
  if (value.authority !== 'legacy' && value.authority !== 'new') problems.push('authority must be "legacy" or "new"');
  if (typeof value.independence !== 'string' || !/credential/i.test(value.independence)) problems.push('independence must state that a credential authority setting is not authorisation for PII');
  const legacy = value.legacy;
  if (!object(legacy)) problems.push('legacy is required');
  else {
    extra(legacy, ['role', 'source', 'oracle'], 'legacy');
    if (legacy.role !== 'authority' && legacy.role !== 'oracle') problems.push('legacy.role must be "authority" or "oracle"');
    if (typeof legacy.source !== 'string' || legacy.source.length < 20) problems.push('legacy.source must say what the legacy authority is');
    const oracle = legacy.oracle;
    if (!object(oracle)) problems.push('legacy.oracle is required');
    else {
      extra(oracle, ['exitCondition', 'decision', 'decidedBy', 'reviewOn'], 'legacy.oracle');
      if (typeof oracle.exitCondition !== 'string' || oracle.exitCondition.length < 40) problems.push('legacy.oracle.exitCondition must state the exit condition');
      if (typeof oracle.decision !== 'string' || !DECISION_PATH.test(oracle.decision)) problems.push('legacy.oracle.decision must be a docs/decisions path');
      if (typeof oracle.decidedBy !== 'string' || !oracle.decidedBy) problems.push('legacy.oracle.decidedBy must name who decides the exit');
      if (typeof oracle.reviewOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(oracle.reviewOn)) problems.push('legacy.oracle.reviewOn must be a date');
    }
  }
  const next = value.new;
  if (!object(next)) problems.push('new is required');
  else {
    extra(next, ['target', 'authorisation'], 'new');
    const target = next.target;
    if (!object(target)) problems.push('new.target is required');
    else {
      extra(target, ['engine', 'populations', 'artifactSchema'], 'new.target');
      if (typeof target.engine !== 'string' || !/^redact-secret\/pii-eval@[0-9a-f]{40}$/.test(target.engine)) problems.push('new.target.engine must be redact-secret/pii-eval@<commit>');
      if (!Array.isArray(target.populations) || target.populations.length === 0 || target.populations.some(p => typeof p !== 'string' || !/^[a-z0-9-]+$/.test(p))) problems.push('new.target.populations must name the populations');
      if (typeof target.artifactSchema !== 'string' || !/^\d+\.\d+$/.test(target.artifactSchema)) problems.push('new.target.artifactSchema must be a schema version');
    }
    const auth = next.authorisation;
    if (auth !== null) {
      if (!object(auth)) problems.push('new.authorisation must be null or an authorisation');
      else {
        extra(auth, ['release', 'acceptedOn', 'acceptedBy', 'decision', 'engineCommit', 'policyDigest', 'populationDigests'], 'new.authorisation');
        if (typeof auth.release !== 'string' || !auth.release) problems.push('new.authorisation.release must name the frozen release or candidate');
        if (typeof auth.acceptedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(auth.acceptedOn)) problems.push('new.authorisation.acceptedOn must be a date');
        if (typeof auth.acceptedBy !== 'string' || !auth.acceptedBy) problems.push('new.authorisation.acceptedBy is required');
        if (typeof auth.decision !== 'string' || !DECISION_PATH.test(auth.decision)) problems.push('new.authorisation.decision must be a docs/decisions path');
        if (typeof auth.engineCommit !== 'string' || !HEX40.test(auth.engineCommit)) problems.push('new.authorisation.engineCommit must be a commit');
        if (typeof auth.policyDigest !== 'string' || !HEX64.test(auth.policyDigest)) problems.push('new.authorisation.policyDigest must be a sha256');
        const digests = auth.populationDigests;
        if (!object(digests) || Object.keys(digests).length === 0 || Object.values(digests).some(d => typeof d !== 'string' || !HEX64.test(d))) problems.push('new.authorisation.populationDigests must name a sha256 per population');
      }
    }
  }
  const criteria = value.exitCriteria;
  if (!Array.isArray(criteria)) problems.push('exitCriteria is required');
  else {
    if (JSON.stringify(criteria.map(c => (object(c) ? c.id : null))) !== JSON.stringify(PII_EXIT_CRITERIA.map(c => c.id))) problems.push(`exitCriteria must be exactly: ${PII_EXIT_CRITERIA.map(c => c.id).join(', ')}`);
    for (const criterion of criteria) {
      if (!object(criterion)) { problems.push('a criterion is not an object'); continue; }
      extra(criterion, ['id', 'basis', 'statement', 'state', 'evidence'], `criterion ${String(criterion.id)}`);
      const known = PII_EXIT_CRITERIA.find(c => c.id === criterion.id);
      if (known && criterion.basis !== known.basis) problems.push(`criterion ${known.id} is ${known.basis}, not ${String(criterion.basis)}`);
      if (criterion.state !== 'met' && criterion.state !== 'unmet') problems.push(`criterion ${String(criterion.id)} state must be met or unmet`);
      if (typeof criterion.statement !== 'string' || criterion.statement.length < 20) problems.push(`criterion ${String(criterion.id)} must state what must be true`);
      if (typeof criterion.evidence !== 'string' || !criterion.evidence) problems.push(`criterion ${String(criterion.id)} must say where its evidence is`);
    }
  }
  return problems;
}

/** What the freshness check compares the authorisation with. Every part is read by the caller from the committed tree. */
export interface PiiAuthorityContext {
  /** Computed state of each `computed` criterion. */
  computed: Record<string, CriterionState>;
  /** sha256 of `qualification/pii-v1.json`, the product policy the measurement is judged under. */
  policyDigest: string;
  engineCommit: string;
  /** Semantic digest of each pinned benchmark population artifact, by view. */
  populationDigests: Record<string, string>;
  /** Front matter `status` of the decision the authorisation cites, or `undefined` when absent. */
  decisionStatus: string | undefined;
}

/** Recorded criterion states that disagree with what the tree computes. Applies under either value: a stale record is wrong either way. */
export function criteriaDriftProblems(file: PiiAuthorityFile, computed: Record<string, CriterionState>): string[] {
  const problems: string[] = [];
  for (const criterion of file.exitCriteria) {
    if (criterion.basis !== 'computed') continue;
    const actual = computed[criterion.id];
    if (actual === undefined) problems.push(`criterion ${criterion.id} cannot be computed`);
    else if (actual !== criterion.state) problems.push(`criterion ${criterion.id} is recorded ${criterion.state} but the tree computes ${actual}: update the record in a reviewed commit`);
  }
  return problems;
}

/** Why an authorisation of the new path is missing, stale or unfounded; empty when `authority` is `new` and every part holds. Nothing is asked of `legacy`. */
export function piiAuthorityFreshnessProblems(file: PiiAuthorityFile, context: PiiAuthorityContext): string[] {
  if (file.authority !== 'new') return [];
  const auth = file.new.authorisation;
  if (!auth) return ['authority is new but no owner authorisation is recorded: a credential authority setting is not authorisation for PII, and the repository records no acceptance on the owner\'s behalf'];
  const problems: string[] = [];
  for (const criterion of file.exitCriteria) {
    const state = criterion.basis === 'computed' ? context.computed[criterion.id] : criterion.state;
    if (state !== 'met') problems.push(`exit criterion ${criterion.id} is not met`);
  }
  if (auth.engineCommit !== context.engineCommit) problems.push(`the pinned engine is ${context.engineCommit}, the authorisation names ${auth.engineCommit}: a repin needs a new authorisation`);
  if (`redact-secret/pii-eval@${auth.engineCommit}` !== file.new.target.engine) problems.push('the authorisation names another engine than new.target');
  if (auth.policyDigest !== context.policyDigest) problems.push('the product policy (qualification/pii-v1.json) changed since the authorisation');
  for (const view of file.new.target.populations) {
    if (auth.populationDigests[view] === undefined) problems.push(`the authorisation does not cover population ${view}`);
    else if (auth.populationDigests[view] !== context.populationDigests[view]) problems.push(`population ${view} has semantic digest ${context.populationDigests[view] ?? '(none)'}, the authorisation names ${auth.populationDigests[view]}`);
  }
  if (context.decisionStatus === undefined) problems.push(`${auth.decision} does not exist`);
  else if (context.decisionStatus !== 'accepted') problems.push(`${auth.decision} is ${context.decisionStatus}, not accepted`);
  return problems;
}

/** Files that may name `benchmarks/pii-authority.json`. A path outside this list that names the file is a new reader, and a reader is a decision. Prefix entries end in `/`. */
export const PII_AUTHORITY_READERS: readonly { path: string; why: string }[] = [
  { path: 'benchmarks/evaluation/domains/pii/authority.ts', why: 'the shape, drift and freshness rules' },
  { path: 'scripts/check-pii-authority.mjs', why: 'the pii:authority:check gate' },
  { path: 'scripts/pii-legacy-inventory.mjs', why: 'the removal prerequisites quote the file by name' },
  { path: 'scripts/rehearse-pii-authority-rollback.mjs', why: 'changes the one value in the working tree and puts it back' },
  { path: 'web/services/pii-authority.ts', why: 'the only reader in the Next app; the PII evaluation asks it, never the file' },
  { path: 'schemas/pii-authority-v1.json', why: 'the JSON schema of the file' },
  { path: 'tests/pii-authority.test.mjs', why: 'the validator tests' },
  { path: 'tests/pii-ci-lanes.test.mjs', why: 'the CI plan treats the file as PII migration data, not a legacy input' },
  { path: 'web/tests/unit/', why: 'the service and page tests choose the authority by a committed-shaped file in an overlay root' },
  { path: 'package.json', why: 'the pii:authority:check script' },
  { path: 'scripts/ci-plan.mjs', why: 'the changed-path map lists the file as PII migration data' },
  { path: '.github/workflows/validate.yml', why: 'runs pii:authority:check' },
  { path: 'docs/', why: 'the spec, the decision, the rehearsal record and indexes' },
  { path: 'AGENTS.md', why: 'agent instructions' },
  { path: 'web/CONVENTIONS.md', why: 'the web rules' },
];

/** Paths (repository-relative, `/`-separated) that name the file and are not an allowed reader. */
export function unlistedPiiAuthorityReaders(namers: string[]): string[] {
  const allowed = (p: string) => p === PII_AUTHORITY_FILE || PII_AUTHORITY_READERS.some(r => (r.path.endsWith('/') ? p.startsWith(r.path) : p === r.path));
  return namers.filter(p => !allowed(p));
}
