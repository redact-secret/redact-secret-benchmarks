/**
 * Beta.11 PII protected partition (benchmarks #428, parent #421): the six-family custodian lifecycle.
 *
 * It generalizes the US SSN protected lifecycle (`scripts/run-us-ssn-protected-holdout.mjs`) to every beta.11 family
 * and reuses the generic holdout storage and lifecycle (`holdout/storage.ts`, `holdout/lifecycle.ts`): 0700/0600
 * modes, no symlinks, one-attempt budgets reserved before any protected byte is read, and aggregate-only output.
 *
 * - One custodian input (`pii-b11-protected-input`) holds every family's cases. `seal` validates it, binds its
 *   whole-input hash, seed commitment and the custodian review attestation in a public seal record, and seals each
 *   family as its own corpus with its own one-attempt manifest (one attempt per family per epoch).
 * - A run binds one family to one exact candidate frozen before any byte is read (core source commit, artifact set
 *   including the `_pii` Wasm payloads, selectors, the `pii-context/v2` activation identities, the #428 freeze and
 *   report, and the benchmark revision) and scores it with the #428 public gate logic (`b11ScoreTable`,
 *   `b11ViewGate`) plus the identity seam. It emits only allowlisted per-family counts.
 * - A trust-resolution record binds that aggregate; `buildB11ProtectedDisposition` binds records to the committed #428
 *   report. A family reaches `provisional` only when every public gate (cost included) and the protected gate are
 *   met; this route never emits `stable`. Every other family is recorded unspent or unresolved with a reason code.
 *
 * Nothing here stores or emits an input, a candidate value, a case id or an axis tag outside process memory.
 * This module is not part of the #428 frozen evaluation schema; it only imports it.
 */
import { randomUUID } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hash } from '../../substrate/hash.ts';
import type { Candidate, HoldoutCorpus, ManifestEvaluationIdentity } from '../../../../holdout/types.ts';
import { runHoldout, type HoldoutDomainAdapter, type HoldoutLifecycleCommon } from '../../../../holdout/lifecycle.ts';
import { HoldoutError, privateDirectory, privateRead, readManifest, sealProtectedCorpusValue, serialize,
  type HoldoutStorageAdapter } from '../../../../holdout/storage.ts';
import { B11_EXPECTED_ACTIVATION, B11_FAMILIES, B11_MIN_BENIGN_AXES, B11_MIN_BENIGN_CASES, B11_POPULATION_VIEWS, b11Commitment,
  b11NamedNegative, b11ScoreTable, b11ViewGate, exactSelector, type B11Case, type B11CaseObservation, type B11Family, type B11Lane,
  type B11Range } from './beta11-qualification.ts';
import { PII_ORACLE_PLANS, PII_PRODUCT_IDENTITY_FORMAT, piiIdentityOracle, validatePiiOracleLabel } from './identity-oracle.ts';
import piiV1Profile from '../../../../qualification/pii-v1.json';

// ---------------------------------------------------------------------------------------------------------------
// Constants and per-family minimums (derived from qualification/pii-v1.json and b11ViewGate)
// ---------------------------------------------------------------------------------------------------------------
export const B11P_ISSUE = 'redact-secret/redact-secret-benchmarks#428';
/** The frozen beta.11 candidate the protected run binds (supplied explicitly as --core-commit; never inferred). */
export const B11P_BETA11_CORE_COMMIT = '8b6a5fde52ecb4dfce13f09c7a947062d21483c7';
export const B11P_INPUT_KIND = 'pii-b11-protected-input';
export const B11P_FAMILY_KIND = 'pii-b11-protected-family';
export const B11P_VIEWS = B11_POPULATION_VIEWS;
export const B11P_SURFACES = ['node-addon', 'node-wasm'] as const;
export type B11PSurface = typeof B11P_SURFACES[number];
export const B11P_LANGUAGES = ['en', 'ko'] as const;
export const B11P_CONTEXT_VOCABULARY = 'pii-context/v2';
export const B11P_STATEMENTS = ['syntheticOrReservedValuesOnly', 'noRealPersonData', 'noLiveCredentials', 'independentOfDevelopmentPlans',
  'contextLanguagesEnglishOrKoreanOnly'] as const;
/** Distinct from the SSN arrival holdout identity, so neither runner can spend the other's budget on a wrong corpus. */
export const b11ProtectedEvaluation: ManifestEvaluationIdentity = Object.freeze({ schemaVersion: 1, domain: 'pii',
  evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-b11-protected-v1' });
const MAX_TEXT_BYTES = 8192;
const MIN_DENOMINATOR = piiV1Profile.mechanics.minDenominator;
/** Families whose contract names an authority-reserved control, so `non-sensitive` is authorable (#423 oracle rule). */
export const B11P_RESERVED_CONTROL_FAMILIES: readonly B11Family[] = ['pii:global:network-address', 'pii:global:email',
  'pii:global:payment-card', 'pii:global:phone'];

/** Selectors a protected case may run under: the exact family, its closure, and (for global families) the US closure. */
export function b11ProtectedSelectors(family: B11Family): string[] {
  return family === 'pii:us:ssn' ? [exactSelector(family), 'pii:us'] : [exactSelector(family), 'pii:global', 'pii:us'];
}
/** The selection under which a jurisdictional family must stay silent (wrong-jurisdiction metrics). */
export const b11ProtectedForeignSelectors = (family: B11Family): string[] | null => family === 'pii:us:ssn' ? ['pii:global'] : null;
const activationKey = (selectors: string[]) => selectors.length === 0 ? 'off' : selectors.length === 1 ? selectors[0] : null;

/**
 * Per view (each case belongs to exactly one view). Every required `pii-v1` metric must be measured, never
 * `not-applicable` or `insufficient-denominator`: a denominator needs `minDenominator` (4) cases.
 */
export function b11ProtectedMinimums(family: B11Family) {
  const nonSensitive = B11P_RESERVED_CONTROL_FAMILIES.includes(family) ? MIN_DENOMINATOR : 0;
  return {
    sensitive: MIN_DENOMINATOR, benign: B11_MIN_BENIGN_CASES, benignAxes: B11_MIN_BENIGN_AXES, nonSensitive,
    nonSensitiveRule: nonSensitive ? `at least ${MIN_DENOMINATOR}` : `0, or at least ${MIN_DENOMINATOR}`,
    twinPairs: MIN_DENOMINATOR, stressBenignDominant: true,
    casesPerView: MIN_DENOMINATOR + B11_MIN_BENIGN_CASES, casesPerFamily: 2 * (MIN_DENOMINATOR + B11_MIN_BENIGN_CASES),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Custodian input
// ---------------------------------------------------------------------------------------------------------------
export interface B11ProtectedCase {
  id: string; family: B11Family; selector: string; view: typeof B11P_VIEWS[number]; axis: string; twinOf: string | null;
  language: typeof B11P_LANGUAGES[number]; text: string; candidate: B11Range | null;
  identity: 'valid' | 'invalid' | 'not-established'; identityBasis: string[];
  sensitivity: 'sensitive' | 'non-sensitive' | 'not-established'; sensitivityBasis: string[]; action: 'redact' | 'none';
}
export interface B11ProtectedAttestation {
  custodian: string; reviewer: string; reviewedAt: string; statements: Record<typeof B11P_STATEMENTS[number], true>;
}
export interface B11ProtectedInput {
  schemaVersion: 1; kind: typeof B11P_INPUT_KIND; seed: string; attestation: B11ProtectedAttestation; cases: B11ProtectedCase[];
}
export interface B11ProtectedFamilyCorpus extends HoldoutCorpus<B11ProtectedCase> {
  schemaVersion: 1; kind: typeof B11P_FAMILY_KIND; family: B11Family; inputCommitment: string; attestation: B11ProtectedAttestation;
}

const CASE_KEYS = ['id', 'family', 'selector', 'view', 'axis', 'twinOf', 'language', 'text', 'candidate', 'identity', 'identityBasis',
  'sensitivity', 'sensitivityBasis', 'action'];
const exact = (value: unknown, keys: string[]) => !!value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const hangul = /[ᄀ-ᇿ㄰-㆏가-힯]/u;
/** Codes and 1-based case positions only; never a value, id or text. */
const reject = (code: string, index?: number): never => { throw new HoldoutError(`invalid-input:${code}${index === undefined ? '' : `#${index + 1}`}`); };
const isName = (value: unknown) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 80 && !/[\n\r\t]/.test(value);

function validateAttestation(value: unknown): B11ProtectedAttestation {
  if (!exact(value, ['custodian', 'reviewer', 'reviewedAt', 'statements'])) reject('attestation-shape');
  const attestation = value as B11ProtectedAttestation;
  if (!isName(attestation.custodian) || attestation.custodian.startsWith('<')) reject('attestation-custodian');
  if (!isName(attestation.reviewer) || attestation.reviewer.startsWith('<')) reject('attestation-reviewer');
  if (typeof attestation.reviewedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(attestation.reviewedAt) ||
      !Number.isFinite(Date.parse(attestation.reviewedAt))) reject('attestation-reviewed-at');
  if (!exact(attestation.statements, [...B11P_STATEMENTS]) || B11P_STATEMENTS.some(key => attestation.statements[key] !== true))
    reject('attestation-statements');
  return attestation;
}

function validateCase(value: unknown, index: number): B11ProtectedCase {
  if (!exact(value, CASE_KEYS)) reject('case-shape', index);
  const row = value as B11ProtectedCase;
  if (typeof row.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(row.id)) reject('case-id', index);
  if (!(B11_FAMILIES as readonly string[]).includes(row.family)) reject('family', index);
  if (!b11ProtectedSelectors(row.family).includes(row.selector)) reject('selector', index);
  if (!(B11P_VIEWS as readonly string[]).includes(row.view)) reject('view', index);
  if (typeof row.axis !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(row.axis)) reject('axis', index);
  if (row.twinOf !== null && (typeof row.twinOf !== 'string' || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(row.twinOf))) reject('twin-of', index);
  if (typeof row.text !== 'string' || !row.text.length || Buffer.byteLength(row.text, 'utf8') > MAX_TEXT_BYTES ||
      Buffer.from(row.text, 'utf8').toString('utf8') !== row.text || row.text.includes('\u0000')) reject('text', index);
  if (!(B11P_LANGUAGES as readonly string[]).includes(row.language) || (hangul.test(row.text) ? 'ko' : 'en') !== row.language)
    reject('language', index);
  if (row.candidate !== null && (!exact(row.candidate, ['start', 'end']) || !Number.isInteger(row.candidate.start) ||
      !Number.isInteger(row.candidate.end))) reject('candidate-shape', index);
  const oracleFamily = piiIdentityOracle.families.find(entry => entry.family === row.family)!;
  try {
    validatePiiOracleLabel({ caseId: row.id, candidate: row.candidate, identity: row.identity, identityBasis: row.identityBasis,
      sensitivity: row.sensitivity, sensitivityBasis: row.sensitivityBasis }, oracleFamily.referenceValidator, row.text);
  } catch { reject('oracle-label', index); }
  if (row.candidate && row.candidate.end > Buffer.byteLength(row.text, 'utf8')) reject('candidate-range', index);
  if (row.action !== (row.sensitivity === 'sensitive' ? 'redact' : 'none')) reject('action', index);
  return row;
}

type ViewCounts = { cases: number; sensitive: number; nonSensitive: number; notEstablished: number; benignAxes: number; twinPairs: number };
/** Authored counts per family and view (what the dry run prints). */
export function b11ProtectedCounts(cases: B11ProtectedCase[]) {
  const families: Partial<Record<B11Family, Record<string, ViewCounts>>> = {};
  for (const family of B11_FAMILIES) {
    const own = cases.filter(row => row.family === family);
    if (!own.length) continue;
    families[family] = Object.fromEntries(B11P_VIEWS.map(view => {
      const members = own.filter(row => row.view === view), benign = members.filter(row => row.sensitivity !== 'sensitive');
      return [view, { cases: members.length, sensitive: members.length - benign.length,
        nonSensitive: benign.filter(row => row.sensitivity === 'non-sensitive').length,
        notEstablished: benign.filter(row => row.sensitivity === 'not-established').length,
        benignAxes: new Set(benign.map(row => row.axis)).size, twinPairs: members.filter(row => row.twinOf !== null).length }];
    }));
  }
  return families;
}

function validateCases(value: unknown, only?: B11Family): B11ProtectedCase[] {
  if (!Array.isArray(value) || !value.length) reject('cases');
  const cases = (value as unknown[]).map(validateCase);
  if (only && cases.some(row => row.family !== only)) reject('family-scope');
  const byId = new Map<string, number>();
  cases.forEach((row, index) => { if (byId.has(row.id)) reject('duplicate-id', index); byId.set(row.id, index); });
  const twinTargets = new Set<string>();
  cases.forEach((row, index) => {
    if (row.twinOf === null) return;
    const target = byId.has(row.twinOf) ? cases[byId.get(row.twinOf)!] : null;
    if (!target || target === row) reject('twin-target', index);
    if (target!.family !== row.family || target!.view !== row.view) reject('twin-scope', index);
    if ((target!.sensitivity === 'sensitive') === (row.sensitivity === 'sensitive')) reject('twin-contrast', index);
    if (target!.twinOf === row.id || twinTargets.has(row.twinOf)) reject('twin-reuse', index);
    twinTargets.add(row.twinOf);
  });
  for (const [family, views] of Object.entries(b11ProtectedCounts(cases)) as Array<[B11Family, Record<string, ViewCounts>]>) {
    const minimum = b11ProtectedMinimums(family);
    for (const [view, count] of Object.entries(views)) {
      const at = `${family}:${view}`;
      if (count.sensitive < minimum.sensitive) reject(`minimum:${at}:sensitive<${minimum.sensitive}`);
      if (count.nonSensitive + count.notEstablished < minimum.benign) reject(`minimum:${at}:benign<${minimum.benign}`);
      if (count.benignAxes < minimum.benignAxes) reject(`minimum:${at}:benign-axes<${minimum.benignAxes}`);
      if (count.nonSensitive < minimum.nonSensitive || (count.nonSensitive > 0 && count.nonSensitive < MIN_DENOMINATOR))
        reject(`minimum:${at}:non-sensitive(${minimum.nonSensitiveRule})`);
      if (count.twinPairs < minimum.twinPairs) reject(`minimum:${at}:twin-pairs<${minimum.twinPairs}`);
      if (view === 'benign-heavy-stress' && count.nonSensitive + count.notEstablished <= count.sensitive)
        reject(`minimum:${at}:not-benign-dominant`);
    }
  }
  return cases;
}

/** Structural validation of the whole custodian input. Throws `invalid-input:<code>[#<position>]` only. */
export function validateB11ProtectedInput(value: unknown): B11ProtectedInput {
  if (!exact(value, ['schemaVersion', 'kind', 'seed', 'attestation', 'cases'])) reject('input-shape');
  const input = value as B11ProtectedInput;
  if (input.schemaVersion !== 1 || input.kind !== B11P_INPUT_KIND) reject('input-kind');
  if (typeof input.seed !== 'string' || input.seed.length < 32 || input.seed.length > 256 || input.seed.startsWith('<')) reject('seed');
  validateAttestation(input.attestation);
  validateCases(input.cases);
  return input;
}

export function validateB11ProtectedFamilyCorpus(value: unknown): B11ProtectedFamilyCorpus {
  if (!exact(value, ['schemaVersion', 'kind', 'family', 'seed', 'inputCommitment', 'attestation', 'fixtures'])) reject('corpus-shape');
  const corpus = value as B11ProtectedFamilyCorpus;
  if (corpus.schemaVersion !== 1 || corpus.kind !== B11P_FAMILY_KIND || !(B11_FAMILIES as readonly string[]).includes(corpus.family) ||
      typeof corpus.seed !== 'string' || !corpus.seed || !digest(corpus.inputCommitment)) reject('corpus-shape');
  validateAttestation(corpus.attestation);
  validateCases(corpus.fixtures, corpus.family);
  return corpus;
}

export const b11ProtectedStorage: HoldoutStorageAdapter<B11ProtectedFamilyCorpus> = Object.freeze({
  evaluation: b11ProtectedEvaluation, validateCorpus: validateB11ProtectedFamilyCorpus, serializeCorpus: serialize,
});
const familySlug = (family: string) => family.split(':').slice(1).join('-');
const familySeed = (seed: string, family: string) => `${seed}:${family}`;

// ---------------------------------------------------------------------------------------------------------------
// Seal
// ---------------------------------------------------------------------------------------------------------------
export interface B11ProtectedSeal {
  schemaVersion: 1; reportType: 'pii-b11-protected-seal'; supportClaims: false; issue: string; sealId: string;
  inputCommitment: string; seedCommitment: string; review: { declaration: 'reviewed' } & Omit<B11ProtectedAttestation, 'statements'> &
    { statements: string[] }; evaluation: ManifestEvaluationIdentity;
  families: Array<{ family: B11Family; manifest: string; manifestCommitment: string; corpusHash: string; seedHash: string; maxRuns: 1 }>;
  absentFamilies: B11Family[]; artifactCommitment: string;
}

export function validateB11ProtectedSeal(value: unknown): B11ProtectedSeal {
  const seal = value as B11ProtectedSeal;
  if (!exact(seal, ['schemaVersion', 'reportType', 'supportClaims', 'issue', 'sealId', 'inputCommitment', 'seedCommitment', 'review',
      'evaluation', 'families', 'absentFamilies', 'artifactCommitment']) || seal.schemaVersion !== 1 || seal.reportType !== 'pii-b11-protected-seal' ||
      seal.supportClaims !== false || seal.issue !== B11P_ISSUE || !/^[a-f0-9]{12}$/.test(seal.sealId) || !digest(seal.inputCommitment) ||
      !digest(seal.seedCommitment) || !exact(seal.review, ['declaration', 'custodian', 'reviewer', 'reviewedAt', 'statements']) ||
      seal.review.declaration !== 'reviewed' || JSON.stringify(seal.review.statements) !== JSON.stringify(B11P_STATEMENTS) ||
      JSON.stringify(seal.evaluation) !== JSON.stringify(b11ProtectedEvaluation) || !Array.isArray(seal.families) || !seal.families.length ||
      seal.families.some(row => !exact(row, ['family', 'manifest', 'manifestCommitment', 'corpusHash', 'seedHash', 'maxRuns']) ||
        !(B11_FAMILIES as readonly string[]).includes(row.family) || row.manifest !== `pii-b11-${seal.sealId}-${familySlug(row.family)}.json` ||
        ![row.manifestCommitment, row.corpusHash, row.seedHash].every(digest) || row.maxRuns !== 1) ||
      new Set(seal.families.map(row => row.family)).size !== seal.families.length ||
      JSON.stringify([...seal.families.map(row => row.family), ...seal.absentFamilies].sort()) !== JSON.stringify([...B11_FAMILIES].sort()) ||
      seal.artifactCommitment !== b11Commitment({ ...seal, artifactCommitment: undefined }))
    throw new HoldoutError('invalid-seal-record');
  return seal;
}

/** Read and validate a private custodian input: the directory must be 0700 and the file 0600, neither a symlink. */
export async function readB11ProtectedInput(inputFile: string) {
  try {
    await privateDirectory(path.dirname(path.resolve(inputFile)));
    const text = await privateRead(inputFile);
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new HoldoutError('invalid-input:json'); }
    return validateB11ProtectedInput(parsed);
  } catch (error) {
    if (error instanceof HoldoutError) throw error;
    throw new HoldoutError('unsafe-or-unreadable-input');
  }
}

/**
 * Seal every family present in the input as its own one-attempt corpus. Manifests and the seal record are written
 * next to each other in `holdoutDirectory` (metadata only, eligible for Git); corpus bytes go to its `generated/`.
 */
export async function sealB11ProtectedInput({ inputFile, holdoutDirectory, review }: { inputFile: string; holdoutDirectory: string; review: string }) {
  if (review !== 'reviewed') throw new HoldoutError('review-declaration-required');
  const input = await readB11ProtectedInput(inputFile);
  const inputCommitment = hash(serialize(input));
  const sealId = randomUUID().replace(/-/g, '').slice(0, 12);
  const present = B11_FAMILIES.filter(family => input.cases.some(row => row.family === family));
  const families: B11ProtectedSeal['families'] = [];
  for (const family of present) {
    const corpus: B11ProtectedFamilyCorpus = { schemaVersion: 1, kind: B11P_FAMILY_KIND, family, seed: familySeed(input.seed, family),
      inputCommitment, attestation: input.attestation, fixtures: input.cases.filter(row => row.family === family) };
    const manifest = `pii-b11-${sealId}-${familySlug(family)}.json`;
    const sealed = await sealProtectedCorpusValue(path.join(holdoutDirectory, manifest), corpus, review, b11ProtectedStorage);
    families.push({ family, manifest, manifestCommitment: hash(serialize(sealed)), corpusHash: sealed.corpusHash, seedHash: sealed.seedHash, maxRuns: 1 });
  }
  const { statements: _statements, ...who } = input.attestation;
  const record: B11ProtectedSeal = { schemaVersion: 1, reportType: 'pii-b11-protected-seal', supportClaims: false, issue: B11P_ISSUE, sealId,
    inputCommitment, seedCommitment: hash(input.seed), review: { declaration: 'reviewed', ...who, statements: [...B11P_STATEMENTS] },
    evaluation: { ...b11ProtectedEvaluation }, families, absentFamilies: B11_FAMILIES.filter(family => !present.includes(family)),
    artifactCommitment: '' };
  record.artifactCommitment = b11Commitment({ ...record, artifactCommitment: undefined });
  const sealFile = path.join(holdoutDirectory, `pii-b11-${sealId}-seal.json`);
  await writeFile(sealFile, serialize(validateB11ProtectedSeal(record)), { mode: 0o644, flag: 'wx' });
  return { sealFile, record };
}

// ---------------------------------------------------------------------------------------------------------------
// Candidate freeze (before any protected byte is read)
// ---------------------------------------------------------------------------------------------------------------
export type B11ProtectedPlan = {
  adapter: 'pii-b11-protected-v1'; family: B11Family; coreCommit: string; freezeCommitment: string; reportCommitment: string;
  epochCommitment: string; sealCommitment: string; manifestCommitment: string; benchmarkRevision: string; lockfileSha256: string;
  artifacts: { core: string; node: string; wasm: string }; wasmPayloads: Array<{ file: string; role: string; sha256: string }>;
  identityExampleSha256: string; selectors: string[]; foreignSelectors: string[] | null; surfaces: string[];
  activation: Record<string, string>; contextVocabulary: string;
};

/** Report gate statuses for one family, the protected partition excluded. */
export function b11ProtectedPublicGates(report: any, family: string) {
  const row = report?.families?.find((item: any) => item.family === family);
  if (!row) throw new HoldoutError('report-family-missing');
  const gates = (row.gates as Array<{ id: string; status: string }>).filter(gate => gate.id !== 'protected-partition');
  return { met: gates.filter(gate => gate.status === 'met').map(gate => gate.id), notMet: gates.filter(gate => gate.status === 'not-met').map(gate => gate.id),
    unresolved: gates.filter(gate => !['met', 'not-met'].includes(gate.status)).map(gate => gate.id),
    epochCommitment: row.protected?.epochCommitment as string };
}

/** Verify a #428 report is bound to its freeze and re-hashes to its own commitment. */
export function assertB11ReportBinding(freeze: any, report: any) {
  if (!freeze || freeze.freezeCommitment !== b11Commitment({ ...freeze, freezeCommitment: undefined })) throw new HoldoutError('freeze-commitment-mismatch');
  if (!report || report.artifactCommitment !== b11Commitment({ ...report, artifactCommitment: undefined }) ||
      report.freeze?.freezeCommitment !== freeze.freezeCommitment || report.candidate?.sourceCommit !== freeze.candidate.sourceCommit)
    throw new HoldoutError('report-not-bound-to-freeze');
}

/**
 * Freeze the exact candidate for one family. `measured` is what the runner hashed on disk; every value must equal the
 * #428 freeze, and at least one `_pii` Wasm payload must be present (redact-secret#937). Throws a code on any drift.
 */
export function b11ProtectedCandidatePlan(options: { coreCommit: string; family: B11Family; freeze: any; report: any; seal: B11ProtectedSeal;
  benchmarkRevision: string; lockfileSha256: string;
  measured: { artifacts: { core: string; node: string; wasm: string }; wasmPayloads: Array<{ file: string; sha256: string }>; identityExampleSha256: string } }) {
  const { coreCommit, family, freeze, report, seal, measured } = options;
  if (!/^[0-9a-f]{40}$/.test(coreCommit) || freeze?.candidate?.sourceCommit !== coreCommit) throw new HoldoutError('core-commit-mismatch');
  assertB11ReportBinding(freeze, report);
  validateB11ProtectedSeal(seal);
  const entry = seal.families.find(row => row.family === family);
  if (!entry) throw new HoldoutError('family-not-sealed');
  for (const role of ['core', 'node', 'wasm'] as const)
    if (measured.artifacts[role] !== freeze.candidate.artifacts?.[role]?.sha256) throw new HoldoutError('candidate-artifact-mismatch');
  const frozenPayloads = (freeze.candidate.wasmPayloads as Array<{ file: string; role: string; sha256: string }>).map(({ file, role, sha256 }) => ({ file, role, sha256 }));
  if (!frozenPayloads.some(row => row.role === 'pii')) throw new HoldoutError('pii-wasm-payload-missing');
  const seen = [...measured.wasmPayloads].sort((a, b) => a.file.localeCompare(b.file)).map(({ file, sha256 }) => `${file}:${sha256}`);
  if (JSON.stringify(seen) !== JSON.stringify([...frozenPayloads].sort((a, b) => a.file.localeCompare(b.file)).map(row => `${row.file}:${row.sha256}`)))
    throw new HoldoutError('wasm-payload-mismatch');
  if (measured.identityExampleSha256 !== freeze.candidate.identityExample?.binarySha256) throw new HoldoutError('identity-example-mismatch');
  if (!/^[0-9a-f]{40}$/.test(options.benchmarkRevision) || !digest(options.lockfileSha256)) throw new HoldoutError('invalid-plan');
  const gates = b11ProtectedPublicGates(report, family);
  if (!digest(gates.epochCommitment)) throw new HoldoutError('epoch-missing');
  const selectors = b11ProtectedSelectors(family), foreignSelectors = b11ProtectedForeignSelectors(family);
  const keys = [...selectors, ...(foreignSelectors ?? []), 'off'];
  const configuration: B11ProtectedPlan = {
    adapter: 'pii-b11-protected-v1', family, coreCommit, freezeCommitment: freeze.freezeCommitment, reportCommitment: report.artifactCommitment,
    epochCommitment: gates.epochCommitment, sealCommitment: seal.artifactCommitment, manifestCommitment: entry.manifestCommitment,
    benchmarkRevision: options.benchmarkRevision, lockfileSha256: options.lockfileSha256, artifacts: { ...measured.artifacts },
    wasmPayloads: frozenPayloads, identityExampleSha256: measured.identityExampleSha256, selectors, foreignSelectors,
    surfaces: [...B11P_SURFACES], activation: Object.fromEntries(keys.map(key => [key, B11_EXPECTED_ACTIVATION[key]])),
    contextVocabulary: B11P_CONTEXT_VOCABULARY,
  };
  const candidate: Candidate = { sourceHash: hash(coreCommit), lockHash: options.lockfileSha256,
    candidateArtifactHash: b11Commitment({ artifacts: configuration.artifacts, wasmPayloads: configuration.wasmPayloads,
      identityExampleSha256: configuration.identityExampleSha256, benchmarkRevision: configuration.benchmarkRevision }) };
  return { candidate, configuration };
}

// ---------------------------------------------------------------------------------------------------------------
// Scanner contract and scoring
// ---------------------------------------------------------------------------------------------------------------
export interface B11ProtectedObservation { activationIdentity: string | null; artifact: string | null; cases: B11CaseObservation[] }
export interface B11ProtectedSeamOutput {
  header: { format: string; family: string; vocabulary: string; activationIdentity: string };
  observations: Array<{ id: string; family: string; identity: 'established' | 'unmatched'; sensitivity: string }>;
}
/** The runner supplies these; all case material stays in process memory. */
export interface B11ProtectedScanner {
  id: string; mode: string; configuration: B11ProtectedPlan; capabilities: { ranges: true; classification: true };
  version(directory: string): Promise<string>;
  observe(request: { surface: B11PSurface; selectors: string[]; cases: Array<{ id: string; text: string; ranges: B11Range[] }> }): Promise<B11ProtectedObservation>;
  seam(request: { family: B11Family; cases: Array<{ id: string; text: string; candidate: B11Range | null }> }): Promise<B11ProtectedSeamOutput>;
}

type Counts = Record<string, number>;
interface ViewAggregate {
  cases: number; sensitive: { cases: number; detected: number; rangeMismatch: number; actionMismatch: number; missed: number; leakedAfterRedaction: number };
  nonSensitive: { cases: number; falseAlarm: number }; notEstablished: { cases: number; falseAlarm: number };
  benignAxisCount: number; twinPairs: number; collateralFindings: number; outsideModifiedCases: number; scanRedactDisagreements: number;
  credentialFindingCases: number; metrics: Array<{ id: string; numerator: number; denominator: number; status: string }>;
}
export const B11P_GATES = ['activation-v2', 'pii-off-invariance', 'cross-surface-determinism', 'diagnostic-population', 'benign-heavy-population',
  'population-mass-resolved', 'identity-only-classification', 'source-artifact-equivalence', 'candidate-stable'] as const;
type GateRow = { id: typeof B11P_GATES[number]; status: 'met' | 'not-met' | 'not-measured'; reasons: string[] };
interface Evaluated {
  startedAt: string; finishedAt: string; status: 'complete' | 'incomplete'; family: B11Family; caseCount: number; plan: B11ProtectedPlan;
  configurationHash: string; views: Record<string, ViewAggregate> | null; identity: Counts | null; surfaces: Counts | null; gates: GateRow[];
}
export interface B11ProtectedAggregate {
  schemaVersion: 1; reportType: 'pii-b11-protected-aggregate'; supportClaims: false; domain: 'pii'; evaluationProfile: 'pii-v1';
  domainAccountingVersion: 'pii-b11-protected-v1'; family: B11Family; runId: string; planHash: string; startedAt: string; finishedAt: string;
  status: 'complete' | 'incomplete'; methodology: 'frozen-candidate-canonical-cases-aggregate-only'; independence: 'public-control' | 'custodian-declared';
  corpus: { id: string; revision: number; purpose: string; corpusHash: string; seedHash: string; lifecycle: 'sealed-at-execution' };
  candidate: Candidate; binding: { coreCommit: string; freezeCommitment: string; reportCommitment: string; epochCommitment: string;
    sealCommitment: string; manifestCommitment: string; benchmarkRevision: string; configurationHash: string };
  caseCount: number; views: Record<string, ViewAggregate> | null; identity: Counts | null; surfaces: Counts | null;
  gates: GateRow[]; protectedGate: 'met' | 'not-met';
}

const toB11Case = (row: B11ProtectedCase): B11Case => ({ id: row.id, source: 'population-plan', views: [row.view], language: row.language,
  input: row.text, identity: row.identity, sensitivity: row.sensitivity, candidate: row.candidate, target: row.candidate,
  expectedFinding: row.sensitivity === 'sensitive', axis: row.axis, twinOf: row.twinOf, scored: true, lineSensitive: [], revision: null });

function assertObservation(observation: B11ProtectedObservation, ids: string[]) {
  if (!observation || !Array.isArray(observation.cases) || JSON.stringify(observation.cases.map(row => row.id)) !== JSON.stringify(ids))
    throw new HoldoutError('observation-not-one-to-one');
}

function viewAggregate(view: ReturnType<typeof b11ScoreTable>['views'][number]): ViewAggregate {
  return { cases: view.cases, sensitive: { ...view.sensitive }, nonSensitive: { ...view.nonSensitive }, notEstablished: { ...view.notEstablished },
    benignAxisCount: view.benignAxes.length, twinPairs: view.twinPairs, collateralFindings: view.collateralFindings,
    outsideModifiedCases: view.outsideModifiedCases, scanRedactDisagreements: view.scanRedactDisagreements,
    credentialFindingCases: view.credentialFindingCases,
    metrics: view.metrics.map(row => ({ id: row.id, numerator: row.numerator, denominator: row.denominator, status: row.status })) };
}

async function scoreFamily(corpus: B11ProtectedFamilyCorpus, scanner: B11ProtectedScanner, plan: B11ProtectedPlan) {
  const family = corpus.family, rows = corpus.fixtures.map(toB11Case), ids = rows.map(row => row.id);
  const request = (subset: B11ProtectedCase[]) => subset.map(row => ({ id: row.id, text: row.text, ranges: row.candidate ? [row.candidate] : [] }));
  const lanes: Array<{ surface: B11PSurface; selectors: string[]; observation: B11ProtectedObservation }> = [];
  const observe = async (surface: B11PSurface, selectors: string[], subset: B11ProtectedCase[]) => {
    const observation = await scanner.observe({ surface, selectors, cases: request(subset) });
    assertObservation(observation, subset.map(row => row.id));
    lanes.push({ surface, selectors, observation });
    return observation;
  };
  const perSurface: Record<string, { caseLane: B11Lane; exact: B11ProtectedObservation; foreign: B11ProtectedObservation | null; off: B11ProtectedObservation }> = {};
  for (const surface of B11P_SURFACES) {
    const byCase = new Map<string, B11CaseObservation>();
    for (const selector of plan.selectors) {
      const subset = corpus.fixtures.filter(row => row.selector === selector);
      if (!subset.length) continue;
      (await observe(surface, [selector], subset)).cases.forEach(row => byCase.set(row.id, row));
    }
    // The exact-family lane over every case: the seam's source/artifact equivalence is defined on it.
    const exactObservation = await observe(surface, [exactSelector(family)], corpus.fixtures);
    const foreign = plan.foreignSelectors ? await observe(surface, plan.foreignSelectors, corpus.fixtures) : null;
    const off = await observe(surface, [], corpus.fixtures);
    perSurface[surface] = { caseLane: { lane: surface, selection: 'union', activationIdentity: null, artifact: null,
      cases: ids.map(id => byCase.get(id)!) }, exact: exactObservation, foreign, off };
  }
  // Activation: every observed selection reports the frozen pii-context/v2 identity for its single selector (or off).
  const activationProblems = lanes.filter(row => {
    const key = activationKey(row.selectors), expected = key ? plan.activation[key] : undefined;
    return !expected || expected !== B11_EXPECTED_ACTIVATION[key!] || row.observation.activationIdentity !== expected;
  }).length;
  const signature = (row: B11CaseObservation) => JSON.stringify(row.family);
  const pairKey = (row: { selectors: string[] }) => row.selectors.join('+');
  const crossSurface = lanes.filter(row => row.surface === 'node-addon').reduce((sum, addon) => {
    const wasm = lanes.find(row => row.surface === 'node-wasm' && pairKey(row) === pairKey(addon) &&
      JSON.stringify(row.observation.cases.map(item => item.id)) === JSON.stringify(addon.observation.cases.map(item => item.id)));
    if (!wasm) return sum + addon.observation.cases.length;
    return sum + addon.observation.cases.filter((row, index) => signature(row) !== signature(wasm.observation.cases[index])).length;
  }, 0);
  const piiOff = B11P_SURFACES.reduce((sum, surface) => sum + perSurface[surface].off.cases.filter(row => row.family.length || row.otherPii.length).length, 0);
  const foreignLane = (surface: B11PSurface): B11Lane | null => perSurface[surface].foreign ? { lane: surface, selection: 'foreign',
    activationIdentity: perSurface[surface].foreign!.activationIdentity, artifact: null, cases: perSurface[surface].foreign!.cases } : null;
  const score = b11ScoreTable(family, rows, perSurface['node-addon'].caseLane, foreignLane('node-addon'));
  const view = (id: string) => score.views.find(row => row.view === id)!;
  const diagnostic = b11ViewGate(view('diagnostic-balanced')), stress = b11ViewGate(view('benign-heavy-stress'));
  const unscored = B11P_VIEWS.reduce((sum, id) => sum + view(id).unscoredCases, 0);
  // Identity seam (redact-secret#910) on every protected case, with the #428 reconciliation rules.
  const seam = await scanner.seam({ family, cases: corpus.fixtures.map(row => ({ id: row.id, text: row.text, candidate: row.candidate })) });
  if (!seam?.header || seam.header.format !== PII_PRODUCT_IDENTITY_FORMAT || seam.header.family !== family ||
      seam.header.vocabulary !== B11P_CONTEXT_VOCABULARY || typeof seam.header.activationIdentity !== 'string' ||
      !seam.header.activationIdentity.endsWith(`;vocabulary=${B11P_CONTEXT_VOCABULARY}`) ||
      JSON.stringify(seam.observations?.map(row => row.id)) !== JSON.stringify(ids) ||
      seam.observations.some(row => row.family !== family || !['established', 'unmatched'].includes(row.identity)))
    throw new HoldoutError('seam-not-bound');
  const found = perSurface['node-addon'].caseLane.cases.map(row => row.family.length > 0);
  const identity = { eligible: 0, correct: 0, identityOnlyCompared: 0, identityMissed: 0, identityOverAccepted: 0, sensitivityMismatch: 0,
    equivalenceDisagreements: 0 };
  rows.forEach((row, index) => {
    for (const surface of B11P_SURFACES)
      if ((seam.observations[index].sensitivity === 'sensitive') !== (perSurface[surface].exact.cases[index].family.length > 0)) identity.equivalenceDisagreements++;
    if (row.sensitivity === 'sensitive' || found[index]) return;
    identity.eligible++;
    const seen = seam.observations[index];
    if (row.identity === 'valid' && seen.identity !== 'established') identity.identityMissed++;
    else if (row.identity !== 'valid' && seen.identity === 'established') identity.identityOverAccepted++;
    else if (row.identity === 'valid' && seen.sensitivity !== row.sensitivity) {
      if (row.sensitivity === 'not-established' && seen.sensitivity === 'non-sensitive' && b11NamedNegative(family, row.input)) identity.identityOnlyCompared++;
      else identity.sensitivityMismatch++;
    } else identity.correct++;
  });
  const gate = (id: GateRow['id'], met: boolean, reasons: string[] = []): GateRow => ({ id, status: met ? 'met' : 'not-met', reasons: met ? [] : reasons });
  const gates: GateRow[] = [
    gate('activation-v2', activationProblems === 0, [`activation-problems:${activationProblems}`]),
    gate('pii-off-invariance', piiOff === 0, [`pii-off-finding-cases:${piiOff}`]),
    gate('cross-surface-determinism', crossSurface === 0, [`addon-wasm-disagreements:${crossSurface}`]),
    gate('diagnostic-population', diagnostic.status === 'met', diagnostic.reasons),
    gate('benign-heavy-population', stress.status === 'met', stress.reasons),
    gate('population-mass-resolved', unscored === 0, [`unscored-cases:${unscored}`]),
    gate('identity-only-classification', identity.identityMissed + identity.identityOverAccepted + identity.sensitivityMismatch === 0,
      [`identity-failures:${identity.identityMissed + identity.identityOverAccepted + identity.sensitivityMismatch}`]),
    gate('source-artifact-equivalence', identity.equivalenceDisagreements === 0, [`seam-artifact-disagreements:${identity.equivalenceDisagreements}`]),
  ];
  return { views: Object.fromEntries(B11P_VIEWS.map(id => [id, viewAggregate(view(id))])), identity,
    surfaces: { observedSelections: lanes.length, activationProblems, crossSurfaceDisagreements: crossSurface, piiOffFindingCases: piiOff }, gates };
}

// ---------------------------------------------------------------------------------------------------------------
// Aggregate validation (allowlist; rejects any case-level field)
// ---------------------------------------------------------------------------------------------------------------
const nonNegative = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
const METRIC_IDS = Object.keys(piiV1Profile.metrics);
export function validateB11ProtectedAggregate(report: B11ProtectedAggregate) {
  const text = JSON.stringify(report);
  const validView = (row: ViewAggregate) => exact(row, ['cases', 'sensitive', 'nonSensitive', 'notEstablished', 'benignAxisCount', 'twinPairs',
      'collateralFindings', 'outsideModifiedCases', 'scanRedactDisagreements', 'credentialFindingCases', 'metrics']) &&
    exact(row.sensitive, ['cases', 'detected', 'rangeMismatch', 'actionMismatch', 'missed', 'leakedAfterRedaction']) &&
    Object.values(row.sensitive).every(nonNegative) && exact(row.nonSensitive, ['cases', 'falseAlarm']) && Object.values(row.nonSensitive).every(nonNegative) &&
    exact(row.notEstablished, ['cases', 'falseAlarm']) && Object.values(row.notEstablished).every(nonNegative) &&
    [row.cases, row.benignAxisCount, row.twinPairs, row.collateralFindings, row.outsideModifiedCases, row.scanRedactDisagreements, row.credentialFindingCases].every(nonNegative) &&
    Array.isArray(row.metrics) && row.metrics.every(metric => exact(metric, ['id', 'numerator', 'denominator', 'status']) && METRIC_IDS.includes(metric.id) &&
      nonNegative(metric.numerator) && nonNegative(metric.denominator) && ['met', 'not-met', 'not-applicable', 'insufficient-denominator'].includes(metric.status));
  const complete = report?.status === 'complete';
  if (!exact(report, ['schemaVersion', 'reportType', 'supportClaims', 'domain', 'evaluationProfile', 'domainAccountingVersion', 'family', 'runId',
      'planHash', 'startedAt', 'finishedAt', 'status', 'methodology', 'independence', 'corpus', 'candidate', 'binding', 'caseCount', 'views',
      'identity', 'surfaces', 'gates', 'protectedGate']) || report.schemaVersion !== 1 || report.reportType !== 'pii-b11-protected-aggregate' ||
      report.supportClaims !== false || report.domain !== 'pii' || report.evaluationProfile !== 'pii-v1' ||
      report.domainAccountingVersion !== 'pii-b11-protected-v1' || !(B11_FAMILIES as readonly string[]).includes(report.family) ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(report.runId) || !digest(report.planHash) ||
      !Number.isFinite(Date.parse(report.startedAt)) || !Number.isFinite(Date.parse(report.finishedAt)) ||
      report.methodology !== 'frozen-candidate-canonical-cases-aggregate-only' || !['public-control', 'custodian-declared'].includes(report.independence) ||
      !exact(report.corpus, ['id', 'revision', 'purpose', 'corpusHash', 'seedHash', 'lifecycle']) || !digest(report.corpus.corpusHash) ||
      !digest(report.corpus.seedHash) || report.corpus.lifecycle !== 'sealed-at-execution' ||
      !exact(report.candidate, ['sourceHash', 'lockHash', 'candidateArtifactHash']) || !Object.values(report.candidate).every(digest) ||
      !exact(report.binding, ['coreCommit', 'freezeCommitment', 'reportCommitment', 'epochCommitment', 'sealCommitment', 'manifestCommitment',
        'benchmarkRevision', 'configurationHash']) || !/^[0-9a-f]{40}$/.test(report.binding.coreCommit) ||
      ![report.binding.freezeCommitment, report.binding.reportCommitment, report.binding.epochCommitment, report.binding.sealCommitment,
        report.binding.manifestCommitment, report.binding.configurationHash].every(digest) || !nonNegative(report.caseCount) ||
      !['complete', 'incomplete'].includes(report.status) || !['met', 'not-met'].includes(report.protectedGate) ||
      !Array.isArray(report.gates) || JSON.stringify(report.gates.map(row => row.id)) !== JSON.stringify(B11P_GATES) ||
      report.gates.some(row => !exact(row, ['id', 'status', 'reasons']) || !['met', 'not-met', 'not-measured'].includes(row.status) ||
        !Array.isArray(row.reasons) || row.reasons.some(reason => typeof reason !== 'string' || !/^[a-z0-9-]+(:[a-z0-9-]+)?(:?[<>]?\d+)?$/.test(reason))) ||
      (complete && (!report.views || !exact(report.views, [...B11P_VIEWS]) || !Object.values(report.views).every(validView) ||
        !exact(report.identity, ['eligible', 'correct', 'identityOnlyCompared', 'identityMissed', 'identityOverAccepted', 'sensitivityMismatch',
          'equivalenceDisagreements']) || !Object.values(report.identity!).every(nonNegative) ||
        !exact(report.surfaces, ['observedSelections', 'activationProblems', 'crossSurfaceDisagreements', 'piiOffFindingCases']) ||
        !Object.values(report.surfaces!).every(nonNegative))) ||
      (!complete && (report.views !== null || report.identity !== null || report.surfaces !== null)) ||
      (report.protectedGate === 'met') !== (complete && report.gates.every(row => row.status === 'met')) ||
      /"(text|input|content|seed|caseId|ids|axis|twinOf|selector|selectors|language|fixtures|start|end|candidateRange|observations)":/.test(text))
    throw new HoldoutError('invalid-protected-aggregate');
  return report;
}

// ---------------------------------------------------------------------------------------------------------------
// Public-control corpus: obviously fake, public seed, reserved example domain only. Never a support claim.
// ---------------------------------------------------------------------------------------------------------------
export function b11ProtectedPublicControl(seed: string): B11ProtectedFamilyCorpus {
  const family: B11Family = 'pii:global:email';
  const fixtures: B11ProtectedCase[] = B11P_VIEWS.flatMap((view, v) => Array.from({ length: 10 }, (_, index): B11ProtectedCase => {
    const id = `public-control-${v}-${index}`, address = `control${v}${index}@example.invalid`;
    const prefix = `PUBLIC CONTROL ${v}.${index} slot=`;
    const range = { start: Buffer.byteLength(prefix), end: Buffer.byteLength(prefix + address) };
    const base = { id, family, selector: exactSelector(family), view, language: 'en' as const, twinOf: null };
    if (index < 4) return { ...base, axis: 'control-slot', text: prefix + address, candidate: range, identity: 'valid', identityBasis: ['contract-grammar'],
      sensitivity: 'sensitive', sensitivityBasis: ['contract-context-rule'], action: 'redact' };
    if (index < 8) return { ...base, axis: index < 6 ? 'control-reserved-a' : 'control-reserved-b', twinOf: `public-control-${v}-${index - 4}`,
      text: prefix + address, candidate: range, identity: 'valid', identityBasis: ['contract-grammar'], sensitivity: 'non-sensitive',
      sensitivityBasis: ['authority-reserved-value'], action: 'none' };
    return { ...base, axis: 'control-prose', text: `PUBLIC CONTROL ${v}.${index}: prose without any address.`, candidate: null,
      identity: 'not-established', identityBasis: [], sensitivity: 'not-established', sensitivityBasis: [], action: 'none' };
  }));
  const attestation: B11ProtectedAttestation = { custodian: 'public-control', reviewer: 'public-control-review', reviewedAt: '2026-09-28T00:00:00Z',
    statements: Object.fromEntries(B11P_STATEMENTS.map(key => [key, true])) as B11ProtectedAttestation['statements'] };
  return validateB11ProtectedFamilyCorpus({ schemaVersion: 1, kind: B11P_FAMILY_KIND, family, seed, inputCommitment: hash(`public-control:${seed}`),
    attestation, fixtures });
}

// ---------------------------------------------------------------------------------------------------------------
// Holdout domain adapter (reuses holdout/lifecycle.ts unchanged)
// ---------------------------------------------------------------------------------------------------------------
export const b11ProtectedDomain: HoldoutDomainAdapter<B11ProtectedScanner, B11ProtectedFamilyCorpus, Evaluated, B11ProtectedAggregate> = {
  identity: { domain: b11ProtectedEvaluation.domain, evaluationProfile: b11ProtectedEvaluation.evaluationProfile,
    domainAccountingVersion: b11ProtectedEvaluation.domainAccountingVersion },
  holdoutMethod: { id: 'pii-b11-protected', version: 1 }, reportContract: { id: 'pii-b11-protected-aggregate', version: 1 },
  publicConformanceCorpus: b11ProtectedPublicControl,
  validateCorpus: validateB11ProtectedFamilyCorpus, serializeCorpus: serialize,
  resolveManifestEvaluation(manifest) {
    if (!manifest.evaluation) throw new HoldoutError('manifest-evaluation-missing');
    return manifest.evaluation;
  },
  async evaluate({ corpus, scanners, toolPlan, candidate, verifyCandidate }) {
    const startedAt = new Date().toISOString();
    if (scanners.length !== 1 || toolPlan.length !== 1) throw new HoldoutError('invalid-plan');
    const plan = toolPlan[0].configuration as unknown as B11ProtectedPlan;
    if (plan.adapter !== 'pii-b11-protected-v1' || plan.family !== corpus.family) throw new HoldoutError('family-mismatch');
    let scored: Awaited<ReturnType<typeof scoreFamily>> | null = null;
    try { scored = await scoreFamily(corpus, scanners[0], plan); } catch { scored = null; }
    let stable = false;
    try { stable = hash(await verifyCandidate()) === hash(candidate); } catch { stable = false; }
    const complete = scored !== null && stable;
    const gates: GateRow[] = [...(scored?.gates ?? B11P_GATES.slice(0, -1).map(id => ({ id, status: 'not-measured' as const, reasons: [] }))),
      { id: 'candidate-stable', status: stable ? 'met' : 'not-met', reasons: stable ? [] : ['candidate-changed-during-run'] }];
    return { startedAt, finishedAt: new Date().toISOString(), status: complete ? 'complete' : 'incomplete', family: corpus.family,
      caseCount: corpus.fixtures.length, plan, configurationHash: toolPlan[0].configurationHash,
      views: complete ? scored!.views : null, identity: complete ? scored!.identity : null, surfaces: complete ? scored!.surfaces : null,
      gates: complete ? gates : gates.map(row => row.id === 'candidate-stable' ? row : { ...row, status: 'not-measured' as const, reasons: [] }) };
  },
  buildReport(common: HoldoutLifecycleCommon, evaluated: Evaluated): B11ProtectedAggregate {
    const { runId, planHash, independence, manifest, candidate } = common, plan = evaluated.plan;
    return { schemaVersion: 1, reportType: 'pii-b11-protected-aggregate', supportClaims: false, domain: 'pii', evaluationProfile: 'pii-v1',
      domainAccountingVersion: 'pii-b11-protected-v1', family: evaluated.family, runId, planHash, startedAt: evaluated.startedAt,
      finishedAt: evaluated.finishedAt, status: evaluated.status, methodology: 'frozen-candidate-canonical-cases-aggregate-only', independence,
      corpus: { id: manifest.id, revision: manifest.revision, purpose: manifest.purpose, corpusHash: manifest.corpusHash, seedHash: manifest.seedHash,
        lifecycle: 'sealed-at-execution' }, candidate,
      binding: { coreCommit: plan.coreCommit, freezeCommitment: plan.freezeCommitment, reportCommitment: plan.reportCommitment,
        epochCommitment: plan.epochCommitment, sealCommitment: plan.sealCommitment, manifestCommitment: plan.manifestCommitment,
        benchmarkRevision: plan.benchmarkRevision, configurationHash: evaluated.configurationHash },
      caseCount: evaluated.caseCount, views: evaluated.views, identity: evaluated.identity, surfaces: evaluated.surfaces, gates: evaluated.gates,
      protectedGate: evaluated.status === 'complete' && evaluated.gates.every(row => row.status === 'met') ? 'met' : 'not-met' };
  },
  validateReport: validateB11ProtectedAggregate,
};

/** Run one sealed family through the generic lifecycle. The seal record names the manifest; its commitment must match. */
export async function runB11ProtectedFamily({ sealFile, family, scanner, candidate, verifyCandidate, runId }: { sealFile: string; family: B11Family;
  scanner: B11ProtectedScanner; candidate: Candidate; verifyCandidate: () => Promise<Candidate>; runId?: string }) {
  let seal: B11ProtectedSeal;
  try { seal = validateB11ProtectedSeal(JSON.parse(await privateOrPublicRead(sealFile))); }
  catch (error) { throw error instanceof HoldoutError ? error : new HoldoutError('invalid-seal-record'); }
  const entry = seal.families.find(row => row.family === family);
  if (!entry) throw new HoldoutError('family-not-sealed');
  const manifestFile = path.join(path.dirname(path.resolve(sealFile)), entry.manifest);
  const manifest = await readManifest(manifestFile);
  if (hash(serialize(manifest)) !== entry.manifestCommitment || manifest.corpusHash !== entry.corpusHash) throw new HoldoutError('seal-manifest-mismatch');
  if (scanner.configuration.family !== family || scanner.configuration.sealCommitment !== seal.artifactCommitment ||
      scanner.configuration.manifestCommitment !== entry.manifestCommitment) throw new HoldoutError('invalid-plan');
  return runHoldout({ manifestFile, scanners: [scanner], candidate, verifyCandidate, domain: b11ProtectedDomain, ...(runId ? { runId } : {}) });
}
async function privateOrPublicRead(file: string) {
  if (!(await lstat(file)).isFile()) throw new HoldoutError('invalid-seal-record');
  return readFile(file, 'utf8');
}

// ---------------------------------------------------------------------------------------------------------------
// Trust resolution and the protected disposition
// ---------------------------------------------------------------------------------------------------------------
export interface B11ProtectedTrust {
  schemaVersion: 1; reportType: 'pii-b11-protected-trust-resolution'; supportClaims: false; family: B11Family; coreCommit: string;
  aggregateCommitment: string; runId: string; corpusHash: string; sealCommitment: string; freezeCommitment: string; epochCommitment: string;
  attempts: 1; aggregateStatus: 'complete' | 'incomplete'; protectedGate: 'met' | 'not-met'; decision: 'accepted' | 'rejected';
  custodian: string; reviewer: string; reviewedAt: string; artifactCommitment: string;
}
const TRUST_KEYS = ['schemaVersion', 'reportType', 'supportClaims', 'family', 'coreCommit', 'aggregateCommitment', 'runId', 'corpusHash',
  'sealCommitment', 'freezeCommitment', 'epochCommitment', 'attempts', 'aggregateStatus', 'protectedGate', 'decision', 'custodian', 'reviewer',
  'reviewedAt', 'artifactCommitment'];

/** `accepted`: the custodian and reviewer trust this single attempt as the family's protected result (pass or fail). */
export function buildB11ProtectedTrust({ aggregate, decision, custodian, reviewer, reviewedAt }: { aggregate: B11ProtectedAggregate;
  decision: 'accepted' | 'rejected'; custodian: string; reviewer: string; reviewedAt: string }) {
  validateB11ProtectedAggregate(aggregate);
  if (aggregate.independence !== 'custodian-declared' || aggregate.corpus.purpose !== 'protected') throw new HoldoutError('public-control-cannot-resolve');
  const trust: B11ProtectedTrust = { schemaVersion: 1, reportType: 'pii-b11-protected-trust-resolution', supportClaims: false, family: aggregate.family,
    coreCommit: aggregate.binding.coreCommit, aggregateCommitment: b11Commitment(aggregate), runId: aggregate.runId, corpusHash: aggregate.corpus.corpusHash,
    sealCommitment: aggregate.binding.sealCommitment, freezeCommitment: aggregate.binding.freezeCommitment, epochCommitment: aggregate.binding.epochCommitment,
    attempts: 1, aggregateStatus: aggregate.status, protectedGate: aggregate.protectedGate, decision, custodian, reviewer, reviewedAt, artifactCommitment: '' };
  trust.artifactCommitment = b11Commitment({ ...trust, artifactCommitment: undefined });
  return validateB11ProtectedTrust(trust, aggregate);
}

export function validateB11ProtectedTrust(trust: B11ProtectedTrust, aggregate: B11ProtectedAggregate) {
  validateB11ProtectedAggregate(aggregate);
  if (!exact(trust, TRUST_KEYS) || trust.schemaVersion !== 1 || trust.reportType !== 'pii-b11-protected-trust-resolution' || trust.supportClaims !== false ||
      trust.family !== aggregate.family || trust.coreCommit !== aggregate.binding.coreCommit || trust.aggregateCommitment !== b11Commitment(aggregate) ||
      trust.runId !== aggregate.runId || trust.corpusHash !== aggregate.corpus.corpusHash || trust.sealCommitment !== aggregate.binding.sealCommitment ||
      trust.freezeCommitment !== aggregate.binding.freezeCommitment || trust.epochCommitment !== aggregate.binding.epochCommitment ||
      trust.attempts !== 1 || trust.aggregateStatus !== aggregate.status || trust.protectedGate !== aggregate.protectedGate ||
      !['accepted', 'rejected'].includes(trust.decision) || !isName(trust.custodian) || !isName(trust.reviewer) ||
      typeof trust.reviewedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(trust.reviewedAt) || !Number.isFinite(Date.parse(trust.reviewedAt)) ||
      aggregate.independence !== 'custodian-declared' || aggregate.corpus.purpose !== 'protected' ||
      trust.artifactCommitment !== b11Commitment({ ...trust, artifactCommitment: undefined }))
    throw new HoldoutError('invalid-protected-trust-resolution');
  return trust;
}

export type B11ProtectedState = 'met' | 'not-met' | 'unresolved' | 'unspent';
/**
 * Bind protected runs to the committed #428 report and disposition. `provisional` requires every public gate (cost
 * included) and the protected gate to be `met`; `stable` is never produced on this route.
 */
export function buildB11ProtectedDisposition({ report, disposition, seal, runs }: { report: any; disposition: any; seal: B11ProtectedSeal | null;
  runs: Array<{ aggregate: B11ProtectedAggregate; trust: B11ProtectedTrust }> }) {
  if (!report || report.artifactCommitment !== b11Commitment({ ...report, artifactCommitment: undefined })) throw new HoldoutError('report-commitment-mismatch');
  if (!disposition || disposition.reportCommitment !== report.artifactCommitment ||
      disposition.artifactCommitment !== b11Commitment({ ...disposition, artifactCommitment: undefined })) throw new HoldoutError('disposition-not-bound-to-report');
  if (seal) validateB11ProtectedSeal(seal);
  const sourceCommit = report.candidate.sourceCommit as string, freezeCommitment = report.freeze.freezeCommitment as string;
  if (new Set(runs.map(row => row.aggregate.family)).size !== runs.length) throw new HoldoutError('duplicate-protected-run');
  const families = B11_FAMILIES.map(family => {
    const gates = b11ProtectedPublicGates(report, family);
    const sealed = seal?.families.find(row => row.family === family) ?? null;
    const run = runs.find(row => row.aggregate.family === family) ?? null;
    let state: B11ProtectedState = 'unspent', reason: string;
    if (run) {
      validateB11ProtectedTrust(run.trust, run.aggregate);
      const binding = run.aggregate.binding;
      if (!sealed || binding.sealCommitment !== seal!.artifactCommitment || run.aggregate.corpus.corpusHash !== sealed.corpusHash ||
          binding.manifestCommitment !== sealed.manifestCommitment || binding.coreCommit !== sourceCommit ||
          binding.freezeCommitment !== freezeCommitment || binding.epochCommitment !== gates.epochCommitment)
        throw new HoldoutError('protected-run-not-bound');
      if (run.trust.decision === 'rejected' || run.aggregate.status !== 'complete') { state = 'unresolved';
        reason = run.trust.decision === 'rejected' ? 'trust-rejected' : 'run-incomplete'; }
      else { state = run.aggregate.protectedGate; reason = state === 'met' ? 'protected-gates-met' :
        `protected-gates-not-met:${run.aggregate.gates.filter(row => row.status !== 'met').map(row => row.id).join(',')}`; }
    } else if (gates.notMet.length) reason = `public-gates-failed:${gates.notMet.join(',')}`;
    else if (!sealed) reason = 'no-sealed-corpus';
    else reason = gates.unresolved.length ? `not-run:public-gates-unresolved:${gates.unresolved.join(',')}` : 'not-run:eligible';
    const status = !gates.notMet.length && !gates.unresolved.length && state === 'met' ? 'provisional' as const : 'pending' as const;
    return { family, status, publicGates: { met: gates.met.length, notMet: gates.notMet, unresolved: gates.unresolved },
      protected: { state, reason, runs: `${run ? 1 : 0}/1`, epochCommitment: gates.epochCommitment, sealed: !!sealed,
        ...(run ? { aggregateCommitment: run.trust.aggregateCommitment, trustCommitment: run.trust.artifactCommitment } : {}) } };
  });
  if (families.some(row => (row.status as string) === 'stable')) throw new HoldoutError('stable-not-reachable');
  const record = { schemaVersion: 1, reportType: 'pii-beta11-protected-disposition', supportClaims: false, issue: B11P_ISSUE,
    productIssue: 'redact-secret/redact-secret#901', route: 'pii-b11-protected-v1', maximumStatus: 'provisional',
    candidate: { sourceCommit }, freezeCommitment, reportCommitment: report.artifactCommitment, dispositionCommitment: disposition.artifactCommitment,
    sealCommitment: seal?.artifactCommitment ?? null,
    domainSeparation: 'PII counts only; no credential count is merged and no combined credential+PII score exists.',
    distribution: { pending: families.filter(row => row.status === 'pending').length, provisional: families.filter(row => row.status === 'provisional').length, stable: 0 },
    families, artifactCommitment: '' };
  record.artifactCommitment = b11Commitment({ ...record, artifactCommitment: undefined });
  return record;
}

export const b11ProtectedFamilySlug = familySlug;
export const b11ProtectedFindingType = (family: B11Family) => PII_ORACLE_PLANS[family].findingType;
