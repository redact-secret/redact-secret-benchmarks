import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import type { MechanicalAccountingConfig } from '../../../accounting/shared/primitives.ts';
import { accountCounts, validateMechanicalAccounting } from '../../../accounting/shared/primitives.ts';
import { evaluationInputs } from '../../substrate/case-lifecycle.ts';
import { hash } from '../../substrate/hash.ts';
import { assessPiiCase } from './assessment.ts';
import { executeDomainEvaluation } from '../../substrate/orchestration.ts';
import type { Registry } from '../../substrate/registry.ts';
import { assembleEvaluationArtifact } from '../../substrate/result-assembly.ts';
import type { RuntimeObservation } from '../../substrate/runtime.ts';
import { piiIdentity } from './identity.ts';
import type { PiiCase, PiiFinding, PiiGeneratedCase, PiiMethod, PiiOutcome, PiiScanner, PiiVariant } from './types.ts';

export const PII_ENGINE_VERSION = '1.0.0';
export const piiAccounting: MechanicalAccountingConfig = Object.freeze({ minDenominator: 1, replays: 2, intervalZ: 1.96, intervalPrecision: 6 });
export interface PiiRunProvenance { sourceRevision?: string; candidateArtifactHash?: string; planHash?: string }

export interface PiiEvaluationOptions {
  cases: PiiCase[];
  methods: Registry<PiiMethod>;
  scanners: PiiScanner[];
  provenance?: PiiRunProvenance;
  runId?: string;
  scratchParent?: string;
  accounting?: MechanicalAccountingConfig;
  reusedObservations?: RuntimeObservation<PiiFinding>[];
  captureObservations?: (inputs: PiiVariant['fixture'][], observations: RuntimeObservation<PiiFinding>[]) => Promise<void>;
}

function generate(c: PiiCase, methods: Registry<PiiMethod>): PiiGeneratedCase {
  const method = methods.get(c.method);
  method.validateCase(c);
  const variants = method.generate(c);
  if (!variants.length) throw new Error(`PII method generated no variants: ${c.method}`);
  return { case: c, variants, attempts: [{ operator: c.method, status: 'generated' }], method };
}

function validateFindings(findings: PiiFinding[], fixtures: PiiVariant['fixture'][]) {
  for (const finding of findings) {
    const fixture = fixtures.find(row => row.path === finding.path);
    if (!fixture || !Number.isInteger(finding.start) || !Number.isInteger(finding.end) || finding.start < 0 || finding.end <= finding.start ||
        finding.end > Buffer.byteLength(fixture.content) ||
        (finding.family !== undefined && !/^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(finding.family)) ||
        (finding.jurisdiction !== undefined && !/^(?:BR|TR|US)$/.test(finding.jurisdiction)) ||
        (finding.sensitive !== undefined && typeof finding.sensitive !== 'boolean')) throw new Error('Invalid PII finding');
  }
}

export function normalizePiiFinding(finding: PiiFinding): PiiFinding {
  return Object.fromEntries(Object.entries({ path: finding.path, start: finding.start, end: finding.end,
    family: finding.family, jurisdiction: finding.jurisdiction, sensitive: finding.sensitive, action: finding.action })
    .filter(([, value]) => value !== undefined)) as unknown as PiiFinding;
}

const count = (outcomes: PiiOutcome[], axis: 'typeIdentity' | 'sensitivityContext', accounting: MechanicalAccountingConfig) => accountCounts(
  Object.fromEntries(['pass', 'fail', 'review-required', 'not-measured'].map(status =>
    [status, outcomes.filter(row => row[axis].status === status).length])), accounting,
);

export async function executePiiEvaluation({ cases, methods, scanners, provenance = {}, runId = randomUUID(), scratchParent = tmpdir(),
  accounting = piiAccounting, reusedObservations = [], captureObservations }: PiiEvaluationOptions) {
  validateMechanicalAccounting(accounting);
  if (Object.keys(provenance).some(key => !['sourceRevision', 'candidateArtifactHash', 'planHash'].includes(key)) ||
      Object.values(provenance).some(value => !/^[a-f0-9]{64}$/.test(value))) throw new Error('Invalid PII run provenance');
  const { generated, fixtures, runtime } = await executeDomainEvaluation({
    prepare: () => { const prepared = evaluationInputs<PiiCase, PiiVariant['fixture'], PiiGeneratedCase>(cases, c => generate(c, methods));
      return { ...prepared, inputs: prepared.fixtures }; },
    scanners, reusedObservations, runId, replays: accounting.replays, scratchParent, identity: hash,
    validateFindings: (findings, prepared) => validateFindings(findings as PiiFinding[], prepared.fixtures),
    normalizeFinding: finding => normalizePiiFinding(finding), captureObservations,
    compose: (prepared, observed) => ({ ...prepared, runtime: observed }),
  });
  const observations = runtime.observations as RuntimeObservation<PiiFinding>[];
  return assembleEvaluationArtifact({
    generated, observations, caseCount: cases.length, variantCount: fixtures.length, schemaVersion: 1,
    engineVersion: PII_ENGINE_VERSION, runId, startedAt: runtime.startedAt, mode: 'discovery',
    scope: 'Internal PII evaluation scaffold; no public support or qualification claim.',
    identity: { ...piiIdentity, accounting },
    provenance: { ...provenance, methods: methods.values().map(({ id, version }) => ({ id, version })) },
    observationMetadata: ({ findings: _findings, ...metadata }) => metadata,
    assembleResult: (g: PiiGeneratedCase) => {
      const evaluated = g.method.evaluate({ case: g.case, variants: g.variants, observations });
      return { result: { id: g.case.id, method: g.case.method, assessment: assessPiiCase(g.case), category: g.case.contract.category, family: g.case.contract.family,
        displayName: g.case.contract.displayName, identityDomain: g.case.contract.identityDomain,
        scope: g.case.contract.scope, qualificationProfile: g.case.contract.qualificationProfile, authority: g.case.contract.authority,
        variants: g.variants.map(v => ({ id: v.id, strategy: v.strategy, transformation: v.transformation,
          expectation: { type: v.contract.typeExpectation.state, sensitivity: v.contract.sensitivityExpectation,
            contextObligation: v.contract.context.obligation, contextClass: v.contract.context.class,
            validatorApplicable: v.contract.typeExpectation.validator !== null, referenceApplicable: v.contract.referenceEvidence !== null } })),
        generation: g.attempts, ...evaluated },
        reviewEntries: evaluated.reviews.map(review => ({ ...review, caseId: g.case.id, method: g.case.method })) };
    },
    failures: results => results.flatMap(result => result.outcomes.filter(outcome =>
      outcome.typeIdentity.status === 'fail' || outcome.sensitivityContext.status === 'fail').map(outcome => ({ caseId: result.id, outcome }))),
    generationErrors: results => results.flatMap(result => result.generation.filter(row => row.status === 'error').map(row => ({ caseId: result.id, ...row }))),
    summarize: results => {
      const outcomes = results.flatMap(result => result.outcomes);
      return { assertionCount: outcomes.length * 2, typeIdentity: count(outcomes, 'typeIdentity', accounting),
        sensitivityContext: count(outcomes, 'sensitivityContext', accounting) };
    },
    decorate: (_summary, _rows, reviewQueue) => ({ reviewQueue, supportClaims: false as const }),
  });
}
