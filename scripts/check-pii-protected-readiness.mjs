/** Preparation metadata only. Reads public contracts; never executes or inspects protected state. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = 'docs/generated/pii-protected-readiness.json';
const sources = ['benchmarks/support/policy-qualified-credentials.json', 'benchmarks/support/taxonomy.json',
  'qualification/pii-v1.json', 'qualification/pii-national-id-arrival-v1.json', 'qualification/pii-profile-cost-v2.json',
  'benchmarks/regression-budgets.json', 'benchmarks/evaluation/domains/credential-policy/holdout.ts',
  'benchmarks/support/policy-holdout-receipt.ts', 'benchmarks/evaluation/domains/pii/beta11-disposition.ts'];

export async function buildReadiness() {
  const bytes = await Promise.all(sources.map(file => readFile(path.join(root, file), 'utf8')));
  const [profile, taxonomy, pii, arrival, cost, budgets] = bytes.slice(0, 6).map(JSON.parse);
  const families = Object.entries(profile.families).map(([detector, contract]) => {
    const family = taxonomy.families.find(row => row.id === contract.taxonomyFamily);
    if (!family?.detectors.includes(detector)) throw new Error('Policy membership disagrees with taxonomy');
    return { detector, taxonomyFamily: contract.taxonomyFamily, requiredAction: contract.requiredAction,
      allowedActions: contract.allowedActions ?? [contract.requiredAction], exclusions: contract.exclusions,
      blindSpots: contract.blindSpots };
  });
  if (families.map(row => row.detector).sort().join(',') !== 'bearer-token,connection-string,generic-token,otpauth-uri')
    throw new Error('Reconcile changed policy membership with the retained holdout kernel before updating readiness');
  const target = '5696d7e1a2950bdf54fa21244f351e1c4b171f25';
  return {
    schemaVersion: 1, recordType: 'protected-requalification-preparation', supportClaims: false,
    execution: 'none', epochCreated: false, attemptSpent: false,
    target: { sourceCommit: target, productPullRequest: 1284, qualificationRun: '37772337995',
      artifactQualification: 'success', artifactVersion: '0.1.0-beta.14', released: false,
      inventorySha256: 'ce4e59de91d00514f29a0035333912d2ec470a8d56a1a0ecbb12fbcc9fd1cb74',
      evidence: 'https://github.com/redact-secret/redact-secret-benchmarks/issues/667#issuecomment-6059642093' },
    pii: { issues: [667], gateEvidence: 'unmeasured-for-target', protectedPath: 'pending-not-operational',
      publicGateIds: ['exact-candidate-binding', 'activation-v2', 'pii-off-invariance', 'oracle-plan-public-stream',
        'identity-only-classification', 'source-artifact-equivalence', 'cross-surface-determinism',
        'diagnostic-population', 'benign-heavy-population', 'population-no-regression', 'population-mass-resolved',
        'authored-truth-agreement', 'contract-fixture-discrepancy', 'cross-surface-output',
        'default-wasm-excludes-pii', 'runtime-and-package-cost', 'size-regression-budget', 'profile-cost',
        'trusted-accounting-source', 'independent-evidence'],
      conditionalGates: { 'default-wasm-excludes-pii': 'applicable-to-split-pii-wasm-artifacts' },
      qualification: { mechanics: pii.mechanics, metrics: pii.metrics, gates: pii.gates },
      ssnPreparation: { minimumFreshCases: 20, review: 'genuine-custodian-and-reviewer-attestation-required',
        epoch: 'not-created', attemptLimit: 1, unresolvedAllowed: 0, maximumResult: 'provisional' },
      arrivalCost: { profiles: arrival.operational.profiles, surfaces: arrival.operational.surfaces,
        profileSelections: arrival.operational.profileSelections,
        minimumPairedSamples: arrival.operational.minimumPairedSamples,
        warmupSamples: arrival.operational.sampleProtocol.warmupSamples,
        metricScope: arrival.operational.sampleProtocol.metricScope, runtime: arrival.operational.runtime,
        packageBytes: arrival.operational.packageBytes, wasmPayloadPolicy: arrival.operational.wasmPayloadPolicy },
      sizeBudgets: budgets.triggers.filter(row => row.id.startsWith('size/'))
        .map(({ id, baselineValue, threshold }) => ({ id, baselineValue, threshold })),
      profileCost: { state: 'unmeasured-for-target', currentPlanTarget: cost.inputs.candidateProductCommit,
        requiresReviewedTargetRefreeze: cost.inputs.candidateProductCommit !== target,
        sampleProtocol: cost.sampleProtocol, thresholds: cost.thresholdPolicy,
        phases: cost.officialLinuxExecution.phases, artifactRoster: cost.artifactRoster,
        dispatch: 'requires-authorised-official-linux-plan-no-dispatch-by-this-record' } },
    credentialPolicy: { issue: 619, state: 'scope-reconciliation-before-freeze', profileId: profile.id,
      candidate: 'not-frozen', membership: families, floorsAndGates: profile.criteria,
      genericSlices: ['high-signal-high-confidence-redact', 'high-signal-below-high-confidence-warn',
        'ambiguous-name-stronger-contract-warn', 'excluded-or-unsupported-control'],
      sliceMeaning: 'contract-review-slices-not-new-taxonomy-families-or-measured-cells',
      pendingT3OutsideProfile: ['ory', 'baseten'],
      receiptDraft: { state: 'not-a-receipt', schemaVersion: 2, profileId: 'credential-policy-v1',
        productRevision: null, benchmarkRevision: null, report: null,
        requirements: ['exact-product-and-benchmark-revisions', 'validated-credential-policy-holdout-report',
          'complete-report', 'protected-purpose', 'custodian-declared', 'complete-product-scanner',
          'current-membership-reconciled-before-freeze', 'public-prerequisites-met', 'authorised-fresh-epoch-attempt'] } },
    custody: { currentTarget: 'private-custodian-selected-ec2-path-not-operational',
      historicalLocal: { contract: 'docs/specs/blind-evaluation.md', evidenceClass: 'custodian-blind',
        independence: 'procedural-separation', organisationalIndependence: false, sandbox: false,
        budget: 'one-attempt-per-candidate-identity-per-epoch-spent-at-reservation',
        newPiiEvalReadiness: false, handoff: 'not-performed' },
      approvalBoundary: ['restricted-activation', 'exact-first-protected-evaluation', 'benchmark-authority-cutover',
        'exact-projection-release-and-destination'],
      holds: ['host-isolation-not-verified', 'operational-catalog-and-seal-not-ready',
        'operator-and-disclosure-policy-not-activated', 'production-signing-trust-not-ready',
        'approved-transport-and-revocation-not-ready', 'operational-ledger-and-checkpoints-not-ready',
        'exact-target-public-and-cost-gates-unmeasured'],
      publicSyntheticMeasurementBlocked: false },
    provenance: sources.map((file, index) => ({ path: file,
      sha256: createHash('sha256').update(bytes[index]).digest('hex') }))
  };
}

export async function checkReadiness() {
  const expected = `${JSON.stringify(await buildReadiness(), null, 2)}\n`;
  if (await readFile(path.join(root, output), 'utf8') !== expected)
    throw new Error('Protected readiness metadata is stale or altered; review then run --write');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).some(arg => arg !== '--write')) throw new Error('Only --write is accepted');
  if (process.argv.includes('--write')) await writeFile(path.join(root, output), `${JSON.stringify(await buildReadiness(), null, 2)}\n`);
  else await checkReadiness();
  console.log('Protected readiness preparation metadata matches public contracts; no protected state read.');
}
