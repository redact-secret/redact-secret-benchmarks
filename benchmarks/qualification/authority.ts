/**
 * Which pipeline is the authority for credential qualification (#608).
 *
 * `benchmarks/qualification-authority.json` holds one committed value, `legacy` or `new`. This module is the single reader's
 * vocabulary: the shape the file must have, the readers allowed to name it, and the staleness rules that make `new` refuse a
 * repin, a new official run or a policy change until the new view is authorised again. It reads no file and runs no pipeline;
 * `scripts/check-qualification-authority.mjs` (the `authority:check` gate) and `web/services/authority.ts` (the build-time
 * consumer) hand it parsed data. Pure, no `node:` import, so the Next services can import it.
 *
 * Spec: docs/specs/qualification-cutover.md ("Authority switch and rollback"). Decision:
 * docs/decisions/2026-10-02-switch-credential-qualification-authority-to-the-new-path.md.
 */
export const AUTHORITY_SCHEMA = 'redact-secret/qualification-authority/v1';
export const AUTHORITY_FILE = 'benchmarks/qualification-authority.json';
export type Authority = 'legacy' | 'new';

export interface QualificationAuthority {
  schema: typeof AUTHORITY_SCHEMA;
  authority: Authority;
  legacy: { role: 'authority' | 'oracle'; oracle: { exitCondition: string; decision: string } };
  new: {
    release: string;
    acceptedOn: string;
    acceptedBy: string;
    policyRevision: string;
    semanticDigests: Record<string, string>;
    parityReport: string;
    decision: string;
  };
}

/** The value a missing file means: legacy, which is the state before the switch. */
export const DEFAULT_AUTHORITY: Authority = 'legacy';

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const REVISION = /^rs-policy-\d+:sha256:[0-9a-f]{64}$/;
const DECISION_PATH = /^docs\/decisions\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/;
const REPORT_PATH = /^docs\/generated\/[a-z0-9-]+\.json$/;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** What a reader needs, checked field by field. Equivalent to `schemas/qualification-authority-v1.json` (a test holds the two together). */
export function authorityShapeProblems(value: unknown): string[] {
  if (!object(value)) return ['the file is not an object'];
  const problems: string[] = [];
  const extra = (o: Record<string, unknown>, allowed: string[], at: string) => { for (const key of Object.keys(o)) if (!allowed.includes(key)) problems.push(`${at}: unknown field ${key}`); };
  extra(value, ['schema', 'authority', 'legacy', 'new'], 'file');
  if (value.schema !== AUTHORITY_SCHEMA) problems.push(`schema must be ${AUTHORITY_SCHEMA}`);
  if (value.authority !== 'legacy' && value.authority !== 'new') problems.push('authority must be "legacy" or "new"');
  const legacy = value.legacy;
  if (!object(legacy)) problems.push('legacy is required');
  else {
    extra(legacy, ['role', 'oracle'], 'legacy');
    if (legacy.role !== 'authority' && legacy.role !== 'oracle') problems.push('legacy.role must be "authority" or "oracle"');
    const oracle = legacy.oracle;
    if (!object(oracle)) problems.push('legacy.oracle is required');
    else {
      extra(oracle, ['exitCondition', 'decision'], 'legacy.oracle');
      if (typeof oracle.exitCondition !== 'string' || oracle.exitCondition.length < 20) problems.push('legacy.oracle.exitCondition must state the exit condition');
      if (typeof oracle.decision !== 'string' || !DECISION_PATH.test(oracle.decision)) problems.push('legacy.oracle.decision must be a docs/decisions path');
    }
  }
  const next = value.new;
  if (!object(next)) problems.push('new is required');
  else {
    extra(next, ['release', 'acceptedOn', 'acceptedBy', 'policyRevision', 'semanticDigests', 'parityReport', 'decision'], 'new');
    if (typeof next.release !== 'string' || !/^@[a-z0-9-]+\/[a-z0-9-]+@\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(next.release)) problems.push('new.release must name a published package version');
    if (typeof next.acceptedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(next.acceptedOn)) problems.push('new.acceptedOn must be a date');
    if (typeof next.acceptedBy !== 'string' || !next.acceptedBy) problems.push('new.acceptedBy is required');
    if (typeof next.policyRevision !== 'string' || !REVISION.test(next.policyRevision)) problems.push('new.policyRevision must be rs-policy-<n>:sha256:<hex>');
    const digests = next.semanticDigests;
    if (!object(digests) || Object.keys(digests).length === 0) problems.push('new.semanticDigests must name at least one run');
    else for (const [id, digest] of Object.entries(digests)) if (!/^[a-z0-9-]+(\+methods)?$/.test(id) || typeof digest !== 'string' || !DIGEST.test(digest)) problems.push(`new.semanticDigests.${id} must be sha256:<64 hex>`);
    if (typeof next.parityReport !== 'string' || !REPORT_PATH.test(next.parityReport)) problems.push('new.parityReport must be a docs/generated path');
    if (typeof next.decision !== 'string' || !DECISION_PATH.test(next.decision)) problems.push('new.decision must be a docs/decisions path');
  }
  return problems;
}

/** What the freshness check compares the authorisation with. Every part is read by the caller from the committed tree. */
export interface AuthorityContext {
  /** `loadPolicyRevision().revision`: the stamp of the benchmark-owned inputs as they are now. */
  policyRevision: string;
  /** The recorded canonical runs of `benchmarks/official-runs.json`: id (`<population>[+methods]@<platform>`), canonical flag and semantic digest. */
  runs: { id: string; canonical: boolean; semanticDigest: string }[];
  /** The committed parity report, parsed, or `undefined` when it is absent. */
  parity?: { identities?: { new?: { policyRevision?: string; populations?: { population: string; run: string; semanticDigest: string; methodsRun?: { run: string; semanticDigest: string } }[] } }; summary?: { unexplained?: number } };
  /** The front matter `status` of the decision the authorisation cites, or `undefined` when the file is absent. */
  decisionStatus?: string;
}

/** Why an authorisation of the new path is stale or unfounded; empty when `authority` is `new` and every part holds. Nothing is asked of `legacy`. */
export function authorityFreshnessProblems(file: QualificationAuthority, context: AuthorityContext): string[] {
  if (file.authority !== 'new') return [];
  const problems: string[] = [];
  const next = file.new;
  if (next.policyRevision !== context.policyRevision) problems.push(`the product policy is ${context.policyRevision}, the authorisation names ${next.policyRevision}: the policy inputs changed since the switch`);
  const canonical = new Map(context.runs.filter(r => r.canonical).map(r => [r.id.replace(/@[a-z0-9-]+$/, ''), r.semanticDigest]));
  for (const [id, digest] of Object.entries(next.semanticDigests)) {
    const recorded = canonical.get(id);
    if (!recorded) problems.push(`the authorisation names a run of ${id} but benchmarks/official-runs.json records no canonical run of it`);
    else if (recorded !== digest) problems.push(`the canonical run of ${id} has semantic digest ${recorded}, the authorisation names ${digest}: a new official run needs a new authorisation`);
  }
  for (const id of canonical.keys()) if (!(id in next.semanticDigests)) problems.push(`the canonical run of ${id} is recorded but not covered by the authorisation`);
  const parity = context.parity;
  if (!parity) problems.push(`${next.parityReport} is absent: the authorisation cites a parity report that does not exist`);
  else {
    if (parity.summary?.unexplained !== 0) problems.push(`${next.parityReport} reports ${parity.summary?.unexplained ?? 'no number of'} unexplained differences; the authorisation needs 0`);
    const built = parity.identities?.new;
    if (built?.policyRevision !== next.policyRevision) problems.push(`${next.parityReport} compared the policy ${built?.policyRevision ?? '(none)'}, not the authorised one: regenerate it with npm run qualification:parity`);
    const compared = new Map((built?.populations ?? []).flatMap(p => [[p.population, p.semanticDigest] as const, ...(p.methodsRun ? [[p.methodsRun.run.replace(/@[a-z0-9-]+$/, ''), p.methodsRun.semanticDigest] as const] : [])]));
    for (const [id, digest] of Object.entries(next.semanticDigests)) if (compared.get(id) !== digest) problems.push(`${next.parityReport} compared another run of ${id} than the authorised one`);
  }
  if (context.decisionStatus === undefined) problems.push(`${next.decision} does not exist`);
  else if (context.decisionStatus !== 'accepted') problems.push(`${next.decision} is ${context.decisionStatus}, not accepted`);
  return problems;
}

/**
 * Files that may name `benchmarks/qualification-authority.json`, as the reader or as the thing that checks or documents it. A path
 * outside this list that names the file is a new reader, and a reader is a decision: add it here and to the spec in the same change.
 * Prefix entries end in `/`.
 */
export const AUTHORITY_READERS: readonly { path: string; why: string }[] = [
  { path: 'benchmarks/qualification/authority.ts', why: 'the shape and freshness rules' },
  { path: 'scripts/check-qualification-authority.mjs', why: 'the authority:check gate' },
  { path: 'web/services/authority.ts', why: 'the only reader in the Next app; every page asks it, never the file' },
  { path: 'schemas/qualification-authority-v1.json', why: 'the JSON schema of the file' },
  { path: 'tests/qualification-authority.test.mjs', why: 'the validator tests' },
  { path: 'web/tests/unit/', why: 'the service, bridge and page tests choose the pipeline by a committed-shaped file in an overlay root' },
  { path: 'web/scripts/', why: 'the post-build checks read the committed value, independently of the services, to know which recount applies' },
  { path: 'package.json', why: 'the authority:check script' },
  { path: '.github/workflows/validate.yml', why: 'runs authority:check' },
  { path: 'docs/', why: 'the spec, the decision, the rehearsal record and indexes' },
  { path: 'AGENTS.md', why: 'agent instructions' },
  { path: 'web/CONVENTIONS.md', why: 'the web rules' },
];

/** Paths (repository-relative, `/`-separated) that name the file and are not an allowed reader. */
export function unlistedReaders(namers: string[]): string[] {
  const allowed = (p: string) => p === AUTHORITY_FILE || AUTHORITY_READERS.some(r => (r.path.endsWith('/') ? p.startsWith(r.path) : p === r.path));
  return namers.filter(p => !allowed(p));
}
