/**
 * What the two evaluation domains record, read for `/evaluation/pii/` and `/evaluation/credential/` (#611).
 *
 * PII: the support matrix is rebuilt here, at build time, from the reviewed Beta.11 protected binding and the evidence it
 * names. This is the route the production publish binds (`scripts/publish-pii-support.ts`, no product activation record),
 * so no `public/results` file and no product artifact is needed. The binding is validated by the same function the
 * publish uses (`validatePiiProtectedSupportBinding`); a binding that does not validate yields `not-recorded`, never a
 * partial protected page. Independently validated published public-synthetic measurements remain visible when the
 * protected binding fails. Case counts per family and view come from the frozen Beta.11 report that binding commits to.
 *
 * Credential: the support record (`evidence/<n>/<commit>/support-status-<mode>.json`) whose package version matches the
 * run's, the engine qualification record, and the known-gaps ledger. The catalog and the run come from the existing
 * services. Nothing is derived beyond recounting what a record says it holds.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ACCOUNTING_VERSION } from '../../benchmarks/accounting/index';
import { PII_METRIC_IDS, PII_METRIC_LABELS, piiV1Profile } from '../../benchmarks/evaluation/domains/pii/profile';
import { PII_CONTEXT_LANGUAGES } from '../../benchmarks/evaluation/domains/pii/context-languages';
import { PII_JURISDICTION_STANDARD } from '../../benchmarks/evaluation/domains/pii/jurisdictions';
import { piiCurrentProtectedRoute } from '../../benchmarks/evaluation/domains/pii/support-semantics';
import { loadPiiProtectedSupportEvidence, validatePiiProtectedSupportBinding } from '../../benchmarks/evaluation/domains/pii/protected-support-binding';
import { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2 } from '../../benchmarks/evaluation/domains/pii/support-v2';
import type { CustodianConformance, PiiEvalMeasurement } from '../../benchmarks/evaluation/domains/pii/support-v2';
export type { PiiEvalMeasurement };
import { domainDescriptorV2, evaluationDomainsV2Problem } from '../../benchmarks/shared/evaluation-domains-v2.ts';
import type { Catalog } from './catalog';
import { loadPiiAuthority, type PiiAuthority, type PiiAuthorityState } from './pii-authority';
import { loadCredentialSource, type CredentialPipeline } from './credential-source';
import { loadFindings } from './findings';
import { once, readJsonIfPresent, REPO_ROOT } from './repo';
import { piiEvalMeasurementFrom } from '../../scripts/pii-publication-inputs';
import type { RunLoad } from './run';
import type { KnownGaps } from './findings';

// ---- PII ----------------------------------------------------------------------------------------

export type PiiViewId = 'oracle-plan' | 'qualification-plan' | 'diagnostic-balanced' | 'benign-heavy-stress';
export const PII_VIEW_IDS: PiiViewId[] = ['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'];

/** The cases of one view, split by what the author expects. */
export interface PiiViewCounts { cases: number; sensitive: number; nonSensitive: number; notEstablished: number }

export interface PiiFamilyRecord {
  id: string;
  name: string;
  scope: string;
  jurisdiction: string | null;
  validatorApplicable: boolean;
  /** What the binding says the family covers ("Global", "Country code +1 (NANP) only"). */
  coverage: string;
  /** `pending`, `provisional`, `stable` or `unsupported`, as the matrix projects it. */
  status: string;
  reasonCodes: string[];
  activation: string;
  /** Cases in each view, or `null` when the frozen report is not bound to this matrix. */
  views: Record<PiiViewId, PiiViewCounts> | null;
  protectedRun: { state: string; reason: string; cases: number | null };
  publicGates: { met: number; notMet: number; unresolved: number; acceptedTradeoffs: number } | null;
}

export interface PiiMetricDefinition { id: string; population: string; numerator: string; denominator: string; direction: 'upper' | 'lower'; applicability: string }

export type PiiEvidence =
  | {
      state: 'recorded';
      mode: 'candidate' | 'published';
      core: { commit: string; versionString: string | null };
      route: { id: string; record: string; maximumStatus: string };
      profile: { id: string; version: number; evaluationProfile: string; domainAccountingVersion: string };
      distribution: Record<string, number>;
      families: PiiFamilyRecord[];
      productActivation: string;
      populationComparisons: { id: string; verdict: string }[];
      metrics: PiiMetricDefinition[];
      costAcceptance: { cells: number; sizeRows: number } | null;
      languages: string[];
      jurisdictionStandard: { id: string; codeCount: number };
      piiEvalMeasurement: PiiEvalMeasurement | null;
      custodianConformance: CustodianConformance | null;
    }
  | {
      state: 'public-recorded';
      profile: { id: string; version: number; evaluationProfile: string; domainAccountingVersion: string };
      metrics: PiiMetricDefinition[];
      piiEvalMeasurement: PiiEvalMeasurement | null;
      custodianConformance: CustodianConformance | null;
      protectedReason: string;
    }
  | { state: 'not-recorded'; reason: string };

interface RawView { view: string; cases: number; sensitive: { cases: number }; nonSensitive: { cases: number }; notEstablished: { cases: number } }
interface RawReportFamily { family: string; views: { reviewed: RawView[] } }

function viewsOf(report: { artifactCommitment?: string; families?: RawReportFamily[] } | undefined, commitment: string, family: string): PiiFamilyRecord['views'] {
  if (!report || report.artifactCommitment !== commitment) return null;
  const raw = report.families?.find(f => f.family === family)?.views?.reviewed;
  if (!raw) return null;
  const out = {} as Record<PiiViewId, PiiViewCounts>;
  for (const id of PII_VIEW_IDS) {
    const view = raw.find(v => v.view === id);
    if (!view) return null;
    out[id] = { cases: view.cases, sensitive: view.sensitive.cases, nonSensitive: view.nonSensitive.cases, notEstablished: view.notEstablished.cases };
  }
  return out;
}

async function loadPublishedPiiEvidence(): Promise<{ piiEvalMeasurement: PiiEvalMeasurement | null; custodianConformance: CustodianConformance | null }> {
  const index = await readJsonIfPresent<unknown>('public/results/evaluation-domains-v2.json');
  if (!index) return { piiEvalMeasurement: null, custodianConformance: null };
  const problem = evaluationDomainsV2Problem(index), descriptor = domainDescriptorV2(index, 'pii');
  if (problem || !descriptor?.support.href || !descriptor.support.artifactCommitment) throw new Error(problem ?? 'PII support publication is incomplete');
  const match = /^\/results\/(pii-support-matrix-v2-[a-f0-9]{64}\.json)$/.exec(descriptor.support.href);
  if (!match) throw new Error('PII support publication path is unsafe');
  const matrix = validatePiiSupportMatrixV2(await readJsonIfPresent<unknown>(`public/results/${match[1]}`));
  if (matrix.artifactCommitment !== descriptor.support.artifactCommitment) throw new Error('PII support publication commitment differs from its index');
  return { piiEvalMeasurement: matrix.piiEvalMeasurement ?? null, custodianConformance: matrix.custodianConformance ?? null };
}

/**
 * Under the `new` authority the pii-eval measurement is the authority, so a build with no published support artifact (a pull request build, a
 * local build) reads it from the same committed inputs the publication binds: the pins and the durable copies of the recorded official run (or,
 * before one is recorded, of the dual-run). This is the new pipeline's own input, not a fallback to the legacy one; the product is not
 * bound (`null`), so the measurement is never described as measuring the release. An input that does not validate throws and the caller says so.
 */
async function committedPiiEvalMeasurement(): Promise<PiiEvalMeasurement> {
  const dir = (await readJsonIfPresent<unknown>('benchmarks/pii-eval-official-run/record.json')) ? 'benchmarks/pii-eval-official-run' : 'benchmarks/pii-eval-population-dual-run';
  return piiEvalMeasurementFrom(path.join(REPO_ROOT, 'benchmarks/pii-eval-population-pins.json'),
    PII_VIEW_IDS.map(view => path.join(REPO_ROOT, `${dir}/${view}.public-synthetic-artifact.json`)), null);
}

function loadPiiEvidence(): Promise<PiiEvidence> {
  return once('pii-evidence', async () => {
    let published: Awaited<ReturnType<typeof loadPublishedPiiEvidence>>;
    try {
      published = await loadPublishedPiiEvidence();
      if (!published.piiEvalMeasurement && (await loadPiiAuthority()).authority === 'new') published = { ...published, piiEvalMeasurement: await committedPiiEvalMeasurement() };
    } catch (error) {
      return { state: 'not-recorded', reason: `The published PII artifact did not validate: ${(error as Error).message}` } satisfies PiiEvidence;
    }
    const profile = { id: piiV1Profile.id, version: piiV1Profile.version, evaluationProfile: piiV1Profile.evaluationProfile,
      domainAccountingVersion: piiV1Profile.domainAccountingVersion };
    const metrics = PII_METRIC_IDS.map(id => {
      const [population, numerator, denominator] = PII_METRIC_LABELS[id];
      const metric = piiV1Profile.metrics[id];
      return { id, population, numerator, denominator, direction: metric.direction, applicability: metric.applicability };
    });
    const publicOnly = (protectedReason: string): PiiEvidence => published.piiEvalMeasurement || published.custodianConformance
      ? { state: 'public-recorded', profile, metrics, ...published, protectedReason }
      : { state: 'not-recorded', reason: protectedReason };
    const binding = piiCurrentProtectedRoute();
    if (!binding) return publicOnly('No reviewed PII protected binding is registered.');
    try {
      const evidence = await loadPiiProtectedSupportEvidence(REPO_ROOT, binding);
      const route = validatePiiProtectedSupportBinding(binding, evidence);
      const matrix = validatePiiSupportMatrixV2(buildPiiSupportMatrixV2({ protectedRoute: route }), { protectedRoute: route });
      const caseCount = new Map<string, number>(evidence.runs.map(run => [run.aggregate.family as string, run.aggregate.caseCount as number]));
      const disposition = (evidence.protectedDisposition.families ?? []) as {
        family: string; publicGates: { met: number; notMet: unknown[]; unresolved: unknown[]; acceptedTradeoffs: unknown[] };
      }[];
      const bound = evidence.protectedDisposition.artifactCommitment === route.artifactCommitment;
      const families: PiiFamilyRecord[] = matrix.families.map(row => {
        const routed = route.families.find(f => f.family === row.family);
        const gates = bound ? disposition.find(f => f.family === row.family)?.publicGates : undefined;
        return {
          id: row.family,
          name: row.displayName,
          scope: row.scope,
          jurisdiction: row.jurisdiction,
          validatorApplicable: row.validatorApplicable,
          coverage: routed?.coverage.note ?? 'Not recorded',
          status: row.status.state,
          reasonCodes: row.status.reasonCodes,
          activation: row.activation.state,
          views: viewsOf(evidence.report, route.reportCommitment, row.family),
          protectedRun: { state: routed ? (routed.status === 'provisional' ? 'met' : 'not-met') : 'not-recorded', reason: routed?.reason ?? 'not-recorded', cases: caseCount.get(row.family) ?? null },
          publicGates: gates ? { met: gates.met, notMet: gates.notMet.length, unresolved: gates.unresolved.length, acceptedTradeoffs: gates.acceptedTradeoffs.length } : null,
        };
      });
      const accepted = evidence.protectedDisposition.costAcceptance?.accepted as { cells: number; sizeRows: number } | undefined;
      const candidate = evidence.report.candidate as { sourceCommit: string; versionString?: string; released?: boolean };
      return {
        state: 'recorded',
        mode: candidate.released ? 'published' : 'candidate',
        core: { commit: route.coreCommit, versionString: candidate.versionString ?? null },
        route: { id: route.id, record: route.record, maximumStatus: route.maximumStatus },
        profile,
        distribution: { ...matrix.distribution },
        families,
        productActivation: matrix.activationContract.productArtifact,
        populationComparisons: matrix.populationComparisons.map(c => ({ id: c.id, verdict: c.verdict })),
        metrics,
        costAcceptance: accepted ? { cells: accepted.cells, sizeRows: accepted.sizeRows } : null,
        languages: [...PII_CONTEXT_LANGUAGES],
        jurisdictionStandard: { id: PII_JURISDICTION_STANDARD.id, codeCount: PII_JURISDICTION_STANDARD.codeCount },
        ...published,
      } satisfies PiiEvidence;
    } catch (error) {
      // Protected product evidence stays fail-closed. Independently validated public-synthetic measurement may still be
      // shown as measurement, never as a family status or support claim.
      return publicOnly(`The PII protected binding did not validate: ${(error as Error).message}`);
    }
  });
}

/** Which pipeline is the authority for the PII evaluation (#666), carried with it so every page says so. Independent of the credential authority. */
export interface PiiAuthorityStamp {
  authority: PiiAuthority;
  from: 'committed' | 'default';
  /** The legacy source of truth, or the oracle's role under `new`. */
  source: string;
  /** Exit criteria not yet met, by id; the number met is `total - unmet.length`. */
  unmet: string[];
  total: number;
  /** Protected-scope criteria not met: the protected path is pending and never gates the public measurement. */
  protectedPending: string[];
  authorisation: PiiAuthorityState['authorisation'];
  decidedBy: string | null;
  reviewOn: string | null;
}

export type PiiEvaluation = PiiEvidence & { authority: PiiAuthorityStamp };

/**
 * The PII evaluation under the committed PII authority. `legacy` shows the benchmark-scorer evidence as the authority and the pii-eval
 * measurement as exploratory. `new` is refused without an owner authorisation record, and it never falls back to legacy: when the pii-eval
 * artifacts carry no validated schema 1.2 projection the evaluation is not recorded and says why.
 */
export function loadPiiEvaluation(): Promise<PiiEvaluation> {
  return once('pii-evaluation', async () => {
    const state = await loadPiiAuthority();
    const stamp: PiiAuthorityStamp = {
      authority: state.authority, from: state.from, source: state.file?.legacy.source ?? 'No PII authority file is committed, so the legacy pipeline is the authority.',
      unmet: state.unmet, total: state.total, protectedPending: state.protectedPending, authorisation: state.authorisation, decidedBy: state.file?.legacy.oracle.decidedBy ?? null, reviewOn: state.file?.legacy.oracle.reviewOn ?? null,
    };
    if (state.refusal) return { state: 'not-recorded', reason: state.refusal, authority: stamp } satisfies PiiEvaluation;
    const evidence = await loadPiiEvidence();
    if (state.authority === 'new') {
      const measurement = evidence.state === 'not-recorded' ? null : evidence.piiEvalMeasurement;
      if (!measurement || !measurement.populations.some(p => p.productProjection))
        return { state: 'not-recorded', reason: `The PII authority is new and no validated pii-eval schema 1.2 projection backs this build.${evidence.state === 'not-recorded' ? ` ${evidence.reason}` : ''} There is no fallback to the legacy pipeline.`, authority: stamp } satisfies PiiEvaluation;
    }
    return { ...evidence, authority: stamp } as PiiEvaluation;
  });
}

// ---- Credential ---------------------------------------------------------------------------------

export interface SupportRecord {
  mode: 'published' | 'candidate';
  /** The package version the record measured. */
  version: string;
  sourceCommit: string | null;
  generatedAt: string;
  /** Repository-relative path of the record. */
  path: string;
  familyCount: number;
  distribution: Record<'stable' | 'provisional' | 'pending' | 'unsupported', number>;
  stable: { documented: number; empirical: number; policyQualified: number };
}

export interface QualificationMethod { method: string; cases: number; variants: number }
export interface EngineQualification { status: string; supportClaims: boolean; finishedAt: string; methods: QualificationMethod[]; path: string }

interface RawSupportRecord {
  schemaVersion: number;
  generatedAt: string;
  familyCount: number;
  distribution: Record<string, number>;
  stableDistribution: { documented: number; empirical: number; policyQualified: number };
  families: { status?: string; state?: string; qualificationProfile?: string }[];
  product?: { sourceCommit: string; declaredVersion: string } | null;
  publishedPackage?: { version: string } | null;
}

const STATUS_KEYS = ['stable', 'provisional', 'pending', 'unsupported'] as const;

/** A support record that recounts from its own families; one that does not is never shown. */
function supportRecordOf(raw: RawSupportRecord): boolean {
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.families) || raw.families.length !== raw.familyCount) return false;
  const stateOf = (f: RawSupportRecord['families'][number]): string | undefined => f.status ?? f.state;
  if (raw.families.some(f => !stateOf(f))) return false;
  return STATUS_KEYS.every(key => raw.distribution[key] === raw.families.filter(f => stateOf(f) === key).length);
}

async function evidenceFiles(name: string): Promise<string[]> {
  const out: string[] = [];
  const top = path.join(REPO_ROOT, 'evidence');
  for (const issue of await readdir(top, { withFileTypes: true })) {
    if (!issue.isDirectory()) continue;
    for (const run of await readdir(path.join(top, issue.name), { withFileTypes: true })) {
      if (run.isDirectory()) out.push(`evidence/${issue.name}/${run.name}/${name}`);
    }
  }
  return out;
}

/**
 * The newest support record of the run's own mode and build: `support-status-published.json` for the published package
 * version the run measured, or `support-status-candidate.json` for the candidate commit it measured. With no run, or no
 * matching record, there is no count to show.
 */
export function loadSupportRecord(run: RunLoad): Promise<SupportRecord | undefined> {
  if (run.state !== 'measured') return Promise.resolve(undefined);
  const key = run.mode === 'candidate' ? `candidate:${run.candidate?.sourceCommit ?? ''}` : `published:${run.productVersion ?? ''}`;
  return once(`support-record:${key}`, async () => {
    const file = run.mode === 'candidate' ? 'support-status-candidate.json' : 'support-status-published.json';
    let best: SupportRecord | undefined;
    for (const relative of await evidenceFiles(file)) {
      const raw = await readJsonIfPresent<RawSupportRecord>(relative);
      if (!raw || !supportRecordOf(raw)) continue;
      const matches = run.mode === 'candidate'
        ? !!run.candidate && raw.product?.sourceCommit === run.candidate.sourceCommit
        : !!run.productVersion && raw.publishedPackage?.version === run.productVersion;
      if (!matches || (best && best.generatedAt >= raw.generatedAt)) continue;
      best = {
        mode: run.mode, version: run.mode === 'candidate' ? raw.product!.declaredVersion : raw.publishedPackage!.version,
        sourceCommit: raw.product?.sourceCommit ?? null, generatedAt: raw.generatedAt, path: relative, familyCount: raw.familyCount,
        distribution: { stable: raw.distribution.stable, provisional: raw.distribution.provisional, pending: raw.distribution.pending, unsupported: raw.distribution.unsupported },
        stable: raw.stableDistribution,
      };
    }
    return best;
  });
}

/** The new pipeline's stable count as the page's support record: the view's distribution, for the published build the official runs measured. */
function newSupportRecord(source: Awaited<ReturnType<typeof loadCredentialSource>>): SupportRecord | undefined {
  const { support } = source;
  if (!support || source.run.state !== 'measured') return undefined;
  return { mode: 'published', version: support.version ?? '', sourceCommit: null, generatedAt: support.recordedOn ?? '', path: support.path, familyCount: support.familyCount, distribution: support.distribution, stable: support.stable };
}

const QUALIFICATION = 'docs/specs/qualification/engine-v1.json';

export function loadEngineQualification(): Promise<EngineQualification | undefined> {
  return once('engine-qualification', async () => {
    const raw = await readJsonIfPresent<{ reportType: string; status: string; supportClaims: boolean; finishedAt: string; methods: { method: string; cases: number; variants: number }[] }>(QUALIFICATION);
    if (!raw || raw.reportType !== 'qualification' || raw.supportClaims !== false || !Array.isArray(raw.methods)) return undefined;
    return { status: raw.status, supportClaims: raw.supportClaims, finishedAt: raw.finishedAt, path: QUALIFICATION, methods: raw.methods.map(m => ({ method: m.method, cases: m.cases, variants: m.variants })) };
  });
}

export interface CredentialEvaluation {
  /** Which pipeline the run, catalog and stable count come from (#608). */
  pipeline: CredentialPipeline;
  run: RunLoad;
  catalog: Catalog;
  findings: KnownGaps;
  support: SupportRecord | undefined;
  qualification: EngineQualification | undefined;
  /** `run.json` names its evaluation and accounting profiles; read only when a run exists. */
  profiles: { evaluationProfile: string; domainAccountingVersion: string } | undefined;
}

async function readRunProfiles(): Promise<CredentialEvaluation['profiles']> {
  try {
    const file = path.join(process.env.WEB_RESULTS_DIR ?? path.join(REPO_ROOT, 'public', 'results'), 'run.json');
    const raw = JSON.parse(await readFile(file, 'utf8')) as { evaluationProfile?: string; domainAccountingVersion?: string };
    return raw.evaluationProfile && raw.domainAccountingVersion ? { evaluationProfile: raw.evaluationProfile, domainAccountingVersion: raw.domainAccountingVersion } : undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export function loadCredentialEvaluation(): Promise<CredentialEvaluation> {
  return once('credential-evaluation', async () => {
    const source = await loadCredentialSource();
    const { run, catalog, pipeline } = source;
    const fromView = pipeline.authority === 'new';
    const [findings, support, qualification, runFile] = await Promise.all([
      loadFindings(),
      // The stable count is the pipeline's own: the committed support record of the legacy run, or the distribution of the new view.
      fromView ? Promise.resolve(newSupportRecord(source)) : loadSupportRecord(run),
      loadEngineQualification(),
      !fromView && run.state === 'measured' ? readRunProfiles() : Promise.resolve(undefined),
    ]);
    return { pipeline, run, catalog, findings, support, qualification, profiles: fromView ? { evaluationProfile: 'qualification-view', domainAccountingVersion: ACCOUNTING_VERSION } : runFile };
  });
}
