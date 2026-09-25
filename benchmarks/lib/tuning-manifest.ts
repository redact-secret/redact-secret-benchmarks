/**
 * Statistical scorer tuning manifests and protected-holdout isolation (#256,
 * cross-repo parent redact-secret/redact-secret#767).
 *
 * A tuning manifest records how one proposed scoring configuration (feature
 * set, weights, thresholds) was chosen, so the choice can be reproduced and so
 * holdout stays an independent final check instead of becoming part of the
 * optimization. `schemas/tuning-manifest-v1.json` is the structural contract;
 * this module enforces what a JSON Schema cannot:
 *
 * - only development-corpus categories may be tuned on; regression categories,
 *   adversarial packs and anything else are evaluation-only, and one source is
 *   never both;
 * - no protected or public-control holdout manifest's id, corpus hash or seed
 *   hash, and no `holdout/` path, appears anywhere in a manifest;
 * - the scoring identity is the hash of the configuration's component hashes,
 *   so a changed feature set, weight set or threshold set is a new identity,
 *   and evidence keyed to the old identity is stale;
 * - benchmark-generated rows are at most the declared cap (0.5 unless a
 *   reviewed override raises it) overall and in every family;
 * - row counts agree with their family and context strata, and every report
 *   is stratified at least by family and context;
 * - an active manifest's corpus hashes match the current tree.
 *
 * The rules are normative in docs/specs/statistical-tuning.md. Problems name
 * manifest fields and ids only; a manifest carries no fixture content.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import schema from '../../schemas/tuning-manifest-v1.json';
import { canonicalJson } from './adversarial-intake.ts';

export const TUNING_MANIFEST_DIRECTORY = 'tuning/manifests';
export const DEFAULT_GENERATED_SHARE_CAP = 0.5;
export const REQUIRED_STRATA = ['family', 'context'] as const;
export const SCORING_CONTRACT_DECISION = 'decision-freeze-the-shadow-evidence-score-and-confidence-contract';

export interface OriginCounts { generated: number; authored: number }
export interface TuningSource {
  category: string;
  corpusHash: string;
  rows: OriginCounts;
  families: Record<string, OriginCounts>;
  contexts: Record<string, number>;
}
export interface EvaluationSource {
  source: string;
  role: 'regression' | 'development-evaluation' | 'adversarial';
  corpusHash?: string;
}
export interface ScoringComponents {
  contractDecision: string;
  featureSchemaVersion: string;
  featureSetHash: string;
  aggregationContractVersion: string;
  weightSetHash: string;
  thresholdSetHash: string;
}
export interface TuningManifest {
  schemaVersion: 1;
  id: string;
  status: 'active' | 'superseded';
  supersededBy?: string;
  createdAt: string;
  product: { sourceRevision: string; sourceHash: string; lockHash: string; candidateArtifactHash: string };
  benchmark: { commit: string; dirty: false };
  featureDataset: { schemaVersion: number; extractorVersion: string; extractorSourceHash: string; datasetHash: string };
  selection: { method: string; sourceHash: string; seed: string };
  scoring: ScoringComponents & { identity: string };
  corpora: { tuning: TuningSource[]; evaluation: EvaluationSource[] };
  holdoutAccess: 'none';
  generatedShare: { cap: number; override?: { cap: number; reason: string; reviewedBy: string } };
  strata: { dimensions: string[] };
}

/** What the repository says about corpora, holdout and adversarial packs right now. */
export interface RepositoryState {
  developmentCategories: string[];
  regressionCategories: string[];
  /** category id -> SHA-256 of its corpus file, as benchmarks/pin-manifest.json records it. */
  corpusHashes: Record<string, string>;
  /** ids, corpus hashes and seed hashes of every checked-in holdout manifest. */
  holdoutIdentifiers: string[];
  /** ids of accepted, non-sample adversarial packs. */
  adversarialPacks: string[];
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** The scoring identity: SHA-256 over the canonical JSON of the configuration's component fields. */
export function scoringIdentity(scoring: ScoringComponents): string {
  const { contractDecision, featureSchemaVersion, featureSetHash, aggregationContractVersion, weightSetHash, thresholdSetHash } = scoring;
  return sha256(canonicalJson({ contractDecision, featureSchemaVersion, featureSetHash, aggregationContractVersion, weightSetHash, thresholdSetHash }));
}

/** SHA-256 over the whole manifest's canonical JSON: what the product scoring artifact (redact-secret#798) records. */
export function tuningManifestHash(manifest: TuningManifest): string {
  return sha256(canonicalJson(manifest));
}

const ajv = new Ajv({ strict: true, allErrors: true });
const validShape = ajv.compile(schema);

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(item => strings(item, out));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) { out.push(key); strings(item, out); }
  }
  return out;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const total = (c: OriginCounts) => c.generated + c.authored;

/** Every rule violation in one manifest, each naming the field at fault. Empty when valid. */
export function validateTuningManifest(manifest: unknown, repo: RepositoryState): string[] {
  if (!validShape(manifest)) {
    return (validShape.errors ?? []).map(e => `schema: ${e.instancePath || '/'} ${e.message}${e.params && 'missingProperty' in e.params ? ` (${e.params.missingProperty})` : ''}`);
  }
  const m = manifest as unknown as TuningManifest;
  const problems: string[] = [];

  // Holdout isolation: nothing that identifies a holdout corpus, and no holdout path, anywhere.
  const holdout = new Set(repo.holdoutIdentifiers);
  for (const value of new Set(strings(m))) {
    if (holdout.has(value)) problems.push('holdout: the manifest names a holdout manifest id, corpus hash or seed hash; holdout is never a tuning or evaluation input');
    else if (/(^|[\s/'"])holdout\//.test(value)) problems.push('holdout: the manifest references a holdout path; holdout inputs are never a tuning or evaluation input');
  }

  // Corpus roles.
  const development = new Set(repo.developmentCategories);
  const regression = new Set(repo.regressionCategories);
  const tuned = new Set<string>();
  for (const source of m.corpora.tuning) {
    if (tuned.has(source.category)) problems.push(`corpora.tuning: ${source.category} is listed twice`);
    tuned.add(source.category);
    if (regression.has(source.category)) problems.push(`corpora.tuning: ${source.category} is a regression category, which is evaluation-only`);
    else if (!development.has(source.category)) problems.push(`corpora.tuning: ${source.category} is not a development-corpus category`);
  }
  const evaluated = new Set<string>();
  for (const source of m.corpora.evaluation) {
    if (evaluated.has(source.source)) problems.push(`corpora.evaluation: ${source.source} is listed twice`);
    evaluated.add(source.source);
    if (tuned.has(source.source)) problems.push(`corpora.evaluation: ${source.source} is also a tuning source; a source is either tuned on or evaluated against, never both`);
    if (source.role === 'adversarial') {
      const id = source.source.startsWith('adversarial:') ? source.source.slice('adversarial:'.length) : null;
      if (!id || !repo.adversarialPacks.includes(id)) problems.push(`corpora.evaluation: ${source.source} is not an accepted adversarial pack`);
    } else if (source.source.startsWith('adversarial:')) {
      problems.push(`corpora.evaluation: ${source.source} must have role adversarial`);
    } else if (source.role === 'regression' && !regression.has(source.source)) {
      problems.push(`corpora.evaluation: ${source.source} is not a regression category`);
    } else if (source.role === 'development-evaluation' && !development.has(source.source)) {
      problems.push(`corpora.evaluation: ${source.source} is not a development-corpus category`);
    }
    if (source.role !== 'adversarial' && !source.corpusHash) problems.push(`corpora.evaluation: ${source.source} needs its corpusHash`);
  }

  // Scoring identity binds the configuration.
  if (m.scoring.identity !== scoringIdentity(m.scoring)) {
    problems.push('scoring.identity: does not match the component hashes; a changed feature, weight or threshold set is a new identity');
  }

  // Strata are declared and consistent, so an aggregate cannot hide a per-stratum regression.
  for (const dimension of REQUIRED_STRATA) {
    if (!m.strata.dimensions.includes(dimension)) problems.push(`strata.dimensions: must include ${dimension}`);
  }
  for (const source of m.corpora.tuning) {
    const rows = total(source.rows);
    if (sum(Object.values(source.families).map(total)) !== rows) problems.push(`corpora.tuning: ${source.category} family counts do not sum to its rows`);
    for (const origin of ['generated', 'authored'] as const) {
      if (sum(Object.values(source.families).map(c => c[origin])) !== source.rows[origin]) problems.push(`corpora.tuning: ${source.category} ${origin} family counts do not sum to its ${origin} rows`);
    }
    if (sum(Object.values(source.contexts)) !== rows) problems.push(`corpora.tuning: ${source.category} context counts do not sum to its rows`);
    if (rows === 0) problems.push(`corpora.tuning: ${source.category} contributes no rows`);
  }

  // Benchmark-generated rows cannot silently dominate the tuning distribution.
  const cap = m.generatedShare.override?.cap ?? m.generatedShare.cap;
  const share = (c: OriginCounts) => (total(c) === 0 ? 0 : c.generated / total(c));
  const overall: OriginCounts = { generated: sum(m.corpora.tuning.map(s => s.rows.generated)), authored: sum(m.corpora.tuning.map(s => s.rows.authored)) };
  if (share(overall) > cap) problems.push(`generatedShare: ${overall.generated}/${total(overall)} tuning rows are benchmark-generated, above the cap ${cap}`);
  const byFamily = new Map<string, OriginCounts>();
  for (const source of m.corpora.tuning) {
    for (const [family, counts] of Object.entries(source.families)) {
      const current = byFamily.get(family) ?? { generated: 0, authored: 0 };
      byFamily.set(family, { generated: current.generated + counts.generated, authored: current.authored + counts.authored });
    }
  }
  for (const [family, counts] of [...byFamily].sort(([a], [b]) => a.localeCompare(b))) {
    if (share(counts) > cap) problems.push(`generatedShare: family ${family} has ${counts.generated}/${total(counts)} benchmark-generated tuning rows, above the cap ${cap}`);
  }

  // Lifecycle.
  if (m.status === 'superseded' && !m.supersededBy) problems.push('supersededBy: a superseded manifest names its successor');
  if (m.status === 'active' && m.supersededBy) problems.push('supersededBy: an active manifest is not superseded');
  if (m.status === 'active') {
    const hashes = [
      ...m.corpora.tuning.map(s => [s.category, s.corpusHash] as const),
      ...m.corpora.evaluation.filter(s => s.corpusHash).map(s => [s.source, s.corpusHash!] as const),
    ];
    for (const [category, hash] of hashes) {
      if (repo.corpusHashes[category] !== undefined && repo.corpusHashes[category] !== hash) {
        problems.push(`corpora: ${category} corpus changed since this active manifest was recorded; re-tune under a new manifest or mark this one superseded`);
      }
    }
  }
  return problems;
}

/** Problems across a set of manifests: ids are unique, file names match ids, successors exist. */
export function manifestSetProblems(manifests: { file: string; manifest: TuningManifest }[]): string[] {
  const problems: string[] = [];
  const ids = new Set(manifests.map(m => m.manifest.id));
  const seen = new Set<string>();
  for (const { file, manifest } of manifests) {
    if (file !== `${manifest.id}.json`) problems.push(`${file}: file name must be ${manifest.id}.json`);
    if (seen.has(manifest.id)) problems.push(`${file}: duplicate manifest id ${manifest.id}`);
    seen.add(manifest.id);
    if (manifest.supersededBy && !ids.has(manifest.supersededBy)) problems.push(`${file}: supersededBy ${manifest.supersededBy} is not a checked-in manifest`);
  }
  return problems;
}

/**
 * Evidence produced under a tuning manifest (calibration, qualification, a
 * holdout run) is current only while all three identities it recorded still
 * match: the manifest itself, the scoring identity and the frozen candidate.
 * Anything else is stale and must be regenerated, never carried over.
 */
export function evidenceStaleness(
  evidence: { tuningManifestHash: string; scoringIdentity: string; candidateArtifactHash: string },
  manifest: TuningManifest,
): string[] {
  const reasons: string[] = [];
  if (evidence.tuningManifestHash !== tuningManifestHash(manifest)) reasons.push('tuning manifest changed');
  if (evidence.scoringIdentity !== manifest.scoring.identity) reasons.push('scoring identity changed');
  if (evidence.candidateArtifactHash !== manifest.product.candidateArtifactHash) reasons.push('candidate artifact changed');
  if (manifest.status !== 'active') reasons.push('tuning manifest superseded');
  return reasons;
}

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

/** Reads the current repository state the rules are checked against. */
export function loadRepositoryState(root: string): RepositoryState {
  const development = readJson(join(root, 'corpora/development/manifest.json'));
  const regression = readJson(join(root, 'corpora/regression/manifest.json'));
  const pins = readJson(join(root, 'benchmarks/pin-manifest.json'));
  const holdoutIdentifiers: string[] = [];
  const holdoutDirectory = join(root, 'holdout');
  for (const name of readdirSync(holdoutDirectory).filter(n => n.endsWith('.json')).sort()) {
    const manifest = readJson(join(holdoutDirectory, name));
    for (const key of ['id', 'corpusHash', 'seedHash']) if (typeof manifest[key] === 'string') holdoutIdentifiers.push(manifest[key]);
  }
  const adversarialPacks: string[] = [];
  const packsDirectory = join(root, 'adversarial/packs');
  if (existsSync(packsDirectory)) {
    for (const entry of readdirSync(packsDirectory, { withFileTypes: true }).filter(e => e.isDirectory())) {
      const intake = join(packsDirectory, entry.name, 'intake.json');
      if (!existsSync(intake)) continue;
      const record = readJson(intake);
      if (record.status === 'accepted' && !record.sample) adversarialPacks.push(record.id);
    }
  }
  return {
    developmentCategories: development.categories,
    regressionCategories: regression.categories,
    corpusHashes: pins.corpusHashes,
    holdoutIdentifiers,
    adversarialPacks: adversarialPacks.sort(),
  };
}

/** Reads every checked-in tuning manifest. */
export function loadTuningManifests(root: string): { file: string; manifest: TuningManifest }[] {
  const directory = join(root, TUNING_MANIFEST_DIRECTORY);
  if (!existsSync(directory)) return [];
  return readdirSync(directory).filter(n => n.endsWith('.json')).sort()
    .map(file => ({ file, manifest: readJson(join(directory, file)) }));
}
