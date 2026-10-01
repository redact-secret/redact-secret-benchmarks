/**
 * The Redact Secret qualification view for the credential pages (#606): what the RunArtifact adapter derived
 * (`npm run qualification:view`, #605) from the official credential-eval runs of each population and the product-owned
 * qualification inputs. The Next app receives this file already derived and never runs credential-eval or the adapter.
 *
 * `public/results/qualification-v1.json` is generated and never committed. A build without it shows "Not measured"
 * with the commands that produce it (the normal state in CI). A file that is present is checked before any page may
 * show a number from it, and one that fails is refused with its reason, never shown in part:
 *
 *  - incompatible: not JSON, another schema tag, or a shape this reader does not know;
 *  - stale: built from other inputs than the ones this checkout pins. Each population's evidence identity and the
 *    engine version must equal `benchmarks/official-runs.json`, and the digest of every benchmark-owned policy file
 *    the view names must equal the file as it is now (the same canonical-JSON digest the adapter stamped).
 *
 * Nothing here derives a count, rate or status: the adapter did, and the service returns what it wrote.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonical, sha256Digest } from '../../benchmarks/qualification/canonical';
import { QUALIFICATION_COMMANDS, QUALIFICATION_FILE, QUALIFICATION_SCHEMA } from '../lib/qualification';
import { once, readJson, REPO_ROOT } from './repo';

export { QUALIFICATION_COMMANDS, QUALIFICATION_FILE, QUALIFICATION_SCHEMA };

export type SupportStatusWord = 'stable' | 'provisional' | 'pending' | 'unsupported';
export type Outcome = 'EXACT' | 'COVERED' | 'OVERBROAD' | 'PARTIAL' | 'MISS';

export interface PositiveCounts { cases: number; spans: number; outcomes: Record<Outcome, number>; leakedSpans: number; leakedBytes: number; collateralBytes: number }
export interface ScannerCounts {
  cases: number; pending: number; notMeasured: number;
  positives: { 'must-redact': PositiveCounts; policy: PositiveCounts };
  benign: { cases: number; flagged: number; findings: number };
  twins: { pairs: number; discriminated: number; flagged: number; coDetected: number };
}
export interface PopulationSlice { population: string; role: string; scanners: { scanner: string; counts: ScannerCounts }[] }
export interface GateRow { population: string; twinPairs: number; twinFailures: number; benignCases: number; benignFalseAlarms: number }
export interface ArtifactScanner { id: string; version: string | null; mode: string; build: string | null; configurationHash: string; status: string }
export interface PopulationView {
  population: string; role: string; denominator: string; runClass: 'public' | 'internal';
  artifact: {
    artifactDigest: string; semanticDigest: string; configHash: string; protocolVersion: string; engineRunClass?: string; publication?: string;
    engine: { name: string; version: string }; methods: string[]; caseCount: number;
    evidence: { source: string; revision: string; evidence_schema: string; corpus_digest: string; release?: { tag: string; manifest_digest: string } | null };
    scanners: ArtifactScanner[];
  };
}
export interface FamilyView {
  family: string;
  taxonomyFamilies: { id: string; name: string; provider: string | null }[];
  contract: { tier: string | null; providerSource: unknown; supportedContext: string[]; unprobeable: unknown };
  status: { value: SupportStatusWord; reasons: string[]; qualificationProfile: string | null; evidenceTier: string | null; evidenceBasis: string | null; methodsNotRun: string[] };
  evidence: Record<string, unknown>;
  fixtureProfile: { claimed: string | null; cellsMet: string[]; debt: unknown[] } | null;
  gates: GateRow[];
  populations: PopulationSlice[];
}
export interface QualificationView {
  schema: string;
  adapter: { id: string; version: number };
  publication: 'public' | 'internal';
  policy: { revision: string; components: { path: string; digest: string }[]; methodsRequired: string[]; populations: Record<string, string> };
  populations: PopulationView[];
  scanners: string[];
  distribution: Record<string, number>;
  stableDistribution: Record<string, number>;
  families: FamilyView[];
  undetected: { id: string; name: string; provider: string | null; supportStatus: string | null }[];
  knownGaps: { id: string; number?: number; status: string; kind?: string; fixtures: { fixture: string; matches: { population: string; flagged: boolean | null; measurement: string; outcomes: string[] | null }[] }[] }[];
  unmappedFamilies: string[];
}

export type QualificationLoad =
  | { state: 'ready'; view: QualificationView }
  | { state: 'not-built'; reason: string }
  | { state: 'incompatible'; reason: string }
  | { state: 'stale'; reason: string };

const STATUSES = new Set(['stable', 'provisional', 'pending', 'unsupported']);
const object = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** What this reader needs, checked field by field. `null` when the file has the shape; otherwise the first thing missing. */
export function qualificationShapeProblem(value: unknown): string | null {
  if (!object(value)) return 'the file is not an object';
  if (value.schema !== QUALIFICATION_SCHEMA) return `schema is ${JSON.stringify(value.schema)}, this build reads ${QUALIFICATION_SCHEMA}`;
  if (value.publication !== 'public' && value.publication !== 'internal') return 'publication is neither public nor internal';
  if (!object(value.policy) || typeof value.policy.revision !== 'string' || !Array.isArray(value.policy.components) || !Array.isArray(value.policy.methodsRequired)) return 'policy has no revision, components or methodsRequired';
  if (!Array.isArray(value.populations) || value.populations.length === 0) return 'populations is empty';
  for (const p of value.populations) {
    if (!object(p) || typeof p.population !== 'string' || !object(p.artifact) || !object(p.artifact.evidence) || !Array.isArray(p.artifact.scanners) || !Array.isArray(p.artifact.methods)) return 'a population has no artifact identity';
  }
  if (!Array.isArray(value.scanners) || !object(value.distribution) || !object(value.stableDistribution)) return 'scanners or the status distribution is missing';
  if (!Array.isArray(value.families) || !Array.isArray(value.undetected) || !Array.isArray(value.knownGaps) || !Array.isArray(value.unmappedFamilies)) return 'families, undetected, knownGaps or unmappedFamilies is missing';
  for (const f of value.families) {
    if (!object(f) || typeof f.family !== 'string' || !object(f.status) || !STATUSES.has(f.status.value) || !Array.isArray(f.status.reasons) || !Array.isArray(f.status.methodsNotRun)) return 'a family has no status';
    if (!Array.isArray(f.taxonomyFamilies) || !object(f.contract) || !object(f.evidence) || !Array.isArray(f.gates) || !Array.isArray(f.populations)) return `family ${f.family} is missing taxonomyFamilies, contract, evidence, gates or populations`;
    for (const slice of f.populations) {
      if (!object(slice) || !Array.isArray(slice.scanners) || slice.scanners.some((s: unknown) => !object(s) || !object((s as Record<string, unknown>).counts))) return `family ${f.family} has a population without counts`;
    }
  }
  return null;
}

interface Registry {
  engine: { version: string };
  populations: { id: string; evidence: { source: string; revision: string; evidenceSchema: string; corpusDigest: string; release: { tag: string; manifestDigest: string } } }[];
}

/** Why a view that has the right shape was not built from this checkout's pins, or `null` when it was. */
export async function qualificationStaleness(view: QualificationView): Promise<string | null> {
  const registry = await readJson<Registry>('benchmarks/official-runs.json');
  const problems: string[] = [];
  for (const population of view.populations) {
    const pin = registry.populations.find(p => p.id === population.population);
    if (!pin) { problems.push(`${population.population} is not a pinned population`); continue; }
    const e = population.artifact.evidence;
    if (e.revision !== pin.evidence.revision || e.corpus_digest !== pin.evidence.corpusDigest || e.release?.tag !== pin.evidence.release.tag || e.release?.manifest_digest !== pin.evidence.release.manifestDigest) problems.push(`${population.population} was run on other evidence than the one pinned`);
    if (population.artifact.engine.version !== registry.engine.version) problems.push(`${population.population} was run with engine ${population.artifact.engine.version}, the pin is ${registry.engine.version}`);
  }
  for (const pin of registry.populations) if (!view.populations.some(p => p.population === pin.id)) problems.push(`${pin.id} is pinned but has no artifact in the view`);
  for (const component of view.policy.components) {
    // `path#name` names a table inside a source file (the contracts of assessment.ts); only whole JSON files are re-digested here.
    if (!component.path.endsWith('.json')) continue;
    let current: string;
    try { current = sha256Digest(canonical(await readJson(component.path))); } catch { problems.push(`${component.path} cannot be read`); continue; }
    if (current !== component.digest) problems.push(`${component.path} changed since the view was built`);
  }
  return problems.length ? problems.join('; ') : null;
}

const RESULTS_DIR = () => process.env.WEB_RESULTS_DIR ?? path.join(REPO_ROOT, 'public', 'results');

export function loadQualificationView(): Promise<QualificationLoad> {
  return once('qualification-view', async () => {
    let text: string;
    try {
      text = await readFile(path.join(RESULTS_DIR(), 'qualification-v1.json'), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: 'not-built', reason: `${QUALIFICATION_FILE} is absent: no qualification view was built for this checkout.` };
      throw new Error(`${QUALIFICATION_FILE} is unreadable: ${(error as Error).message}`);
    }
    let value: unknown;
    try { value = JSON.parse(text); } catch { return { state: 'incompatible', reason: `${QUALIFICATION_FILE} is not valid JSON.` }; }
    const shape = qualificationShapeProblem(value);
    if (shape) return { state: 'incompatible', reason: `${QUALIFICATION_FILE} cannot be read: ${shape}.` };
    const stale = await qualificationStaleness(value as QualificationView);
    if (stale) return { state: 'stale', reason: `${QUALIFICATION_FILE} was not built from this checkout's pins: ${stale}.` };
    return { state: 'ready', view: value as QualificationView };
  });
}
