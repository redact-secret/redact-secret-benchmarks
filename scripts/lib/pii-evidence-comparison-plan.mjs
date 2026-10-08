import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
import { SNAPSHOT_PIN, CONSUMER_PIN, sha256, validatePreflightReport } from './pii-evidence-contract.mjs';
import { parseEvidenceJson } from './pii-evidence-json.mjs';

// Frozen product inputs from the reviewed beta.14 comparison; package-lock upgrades
// and retirement of the old four-population driver cannot repin this sidecar.
const PRODUCT_PINS = {
 "protocol": {
  "id": "pii-v1",
  "revision": 2,
  "artifactSchema": "1.4"
 },
 "scanner": {
  "adapter": {
   "id": "redact-secret-core-node",
   "version": "1.0.0",
   "normalizationVersion": 1
  },
  "configurationDigest": "d213ca5dd371adcea382769b656cd9b3d7b6543ea157dbf63e9a3f50eaeb3f21",
  "activationDigest": "68785ee0037e8b4d5b0ea2b0043e5d897eb942a7bea89a3bd7191510e338b5a3",
  "activation": [
   "pii:global",
   "pii:us"
  ]
 },
 "baseline": {
  "provenance": "published-npm-lockfile",
  "version": "0.1.0-beta.14",
  "sourceCommit": "0c62fd38bca75c5b28b042dc79789b708ebf1d17",
  "packages": {
   "@redact-secret/core": {
    "version": "0.1.0-beta.14",
    "integrity": "sha512-1h5NxUto2ZEqQD5hfIgbzwDZkmu6WXdlmtF0waG3FcKDhpCEoUphgj4B4VGRyhVhjJOFT58/TrER+3EL1bCnag==",
    "resolved": "https://registry.npmjs.org/@redact-secret/core/-/core-0.1.0-beta.14.tgz"
   },
   "@redact-secret/node-darwin-arm64": {
    "version": "0.1.0-beta.14",
    "integrity": "sha512-ARFG6EaEZwHGOCnaPqqtlF5BljxQ6sNAA74N7QU159EvVYCEZvg8gzSeDgt0kjJdJL+vlEjT1zWov+MoZV8KMA==",
    "resolved": "https://registry.npmjs.org/@redact-secret/node-darwin-arm64/-/node-darwin-arm64-0.1.0-beta.14.tgz"
   },
   "@redact-secret/node-darwin-x64": {
    "version": "0.1.0-beta.14",
    "integrity": "sha512-xAiObLUcaFjPXJ07NRt/LcfjNUKUYCwEpf9lE2v3PfXY7xnkSBop9h06rLjEziR4XjPilb2pQeuuiO3PbzBNKA==",
    "resolved": "https://registry.npmjs.org/@redact-secret/node-darwin-x64/-/node-darwin-x64-0.1.0-beta.14.tgz"
   },
   "@redact-secret/node-linux-arm64-gnu": {
    "version": "0.1.0-beta.14",
    "integrity": "sha512-v1yP2VwFyP0o9qV32jECFId9jTvRjGTFyDpwn3wMCix+9iST7fSDhakEaEKJMifBCx/tfMy/1mXltF/pKPYdDA==",
    "resolved": "https://registry.npmjs.org/@redact-secret/node-linux-arm64-gnu/-/node-linux-arm64-gnu-0.1.0-beta.14.tgz"
   },
   "@redact-secret/node-linux-arm64-musl": {
    "version": "0.1.0-beta.14",
    "integrity": "sha512-R8Fp1QHyVIOH+qGKcfLZbmEP4gG3sLpIKkmuzfx1sjN23WEvUz3O4UYL9DXJpXYZPG4QWPZuxSewpmGYuw6f2A==",
    "resolved": "https://registry.npmjs.org/@redact-secret/node-linux-arm64-musl/-/node-linux-arm64-musl-0.1.0-beta.14.tgz"
   },
   "@redact-secret/node-linux-x64-gnu": {
    "version": "0.1.0-beta.14",
    "integrity": "sha512-LaNrvAeyzMgSlj7rXghK8LBUIDuCR5nDt7exXzyRgJRvP0jz3zeZGS4KSkbyQtrf90cyAs3VAb5ONMt5XVOwtA==",
    "resolved": "https://registry.npmjs.org/@redact-secret/node-linux-x64-gnu/-/node-linux-x64-gnu-0.1.0-beta.14.tgz"
   },
   "@redact-secret/node-linux-x64-musl": {
    "version": "0.1.0-beta.14",
    "integrity": "sha512-DOvm796wqFx9aWL49ZCAmEaHymqxVMHbJudnmSxtrPY2kdWeTR4Hy+fTKZ8lODCTsbWfJoeMK6W55F2TcNC4HA==",
    "resolved": "https://registry.npmjs.org/@redact-secret/node-linux-x64-musl/-/node-linux-x64-musl-0.1.0-beta.14.tgz"
   },
   "@redact-secret/node-win32-arm64-msvc": {
    "version": "0.1.0-beta.14",
    "integrity": "sha512-OoNSo5+AyT4s2Za9lmKhvp7qcCDOVd/DluuB02n7gmpg2Wf1TfSZCkDwvgK1RWUw92onghrKXKVWgDjMjZL2zw==",
    "resolved": "https://registry.npmjs.org/@redact-secret/node-win32-arm64-msvc/-/node-win32-arm64-msvc-0.1.0-beta.14.tgz"
   },
   "@redact-secret/node-win32-x64-msvc": {
    "version": "0.1.0-beta.14",
    "integrity": "sha512-L3y7yMRCtkZIfQkx44UdRLbPPGqN8xyO+RCYo903IMeaVmoBV+7wOS6bCghyzvj57D+EKDl4ORJq952dsFvcpA==",
    "resolved": "https://registry.npmjs.org/@redact-secret/node-win32-x64-msvc/-/node-win32-x64-msvc-0.1.0-beta.14.tgz"
   },
   "@redact-secret/wasm": {
    "version": "0.1.0-beta.14",
    "integrity": "sha512-GbNKLcvEWVzojswaInd+sZgLRkYolAU6IeKNCYvUIIQWaPcrPuLcHitixBTqeS0IEHxWbFkI6RyfMBZyVTPrBQ==",
    "resolved": "https://registry.npmjs.org/@redact-secret/wasm/-/wasm-0.1.0-beta.14.tgz"
   }
  }
 },
 "candidate": {
  "provenance": "qualified-unpublished-artifacts",
  "version": "0.1.0-beta.14",
  "sourceCommit": "5696d7e1a2950bdf54fa21244f351e1c4b171f25",
  "qualificationRunId": "37772337995",
  "inventorySha256": "ce4e59de91d00514f29a0035333912d2ec470a8d56a1a0ecbb12fbcc9fd1cb74",
  "coreTarballSha256": "42c0447c124ace12c128768b30e33d83b4c58b8af2d0d8502c6d42f795c62c35",
  "piiWasmTarballSha256": "77af5822255f28f13b4fc6e2de3ce393abdfe6ce205e7d2e61cb858808c4c037",
  "nativeLinuxTarballSha256": "cc9bda9802092fdc60d1458657f27f04d74f4789b64f31685a3abb721a43ea72",
  "localNativeDarwinTarballSha256": "1e165fe460548f6df664870d647f8c077b331e4e4da453f76b3895d82bcc91b9",
  "piiWasmBinarySha256": "f52314fa95a51a064a42d0e03458ab8575dd32b4c42398191dc015e6983201e3"
 }
};

export const PLAN_PATH = 'benchmarks/pii-evidence-comparison/plan.json';
export const COST_PATH = 'benchmarks/pii-evidence-comparison/cost-decision.json';
export const evidenceDigest = value => sha256(stable(value));
export function stable(value) {
  return JSON.stringify(value === null || typeof value !== 'object' ? value : Array.isArray(value)
    ? value.map(item => JSON.parse(stable(item)))
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(stable(value[key]))])));
}
export const same = (a, b) => stable(a) === stable(b);
export const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && same(Object.keys(value).sort(), [...keys].sort());
function runtimeInputs({ preflight, policy, populationIndex, populationIndexDigest } = {}) {
  policy ??= parseEvidenceJson(readFileSync(resolve(ROOT, 'benchmarks/pii-population-policy.json'), 'utf8'));
  preflight ??= parseEvidenceJson(readFileSync(resolve(ROOT, 'benchmarks/pii-evidence/preflight.json'), 'utf8'));
  validatePreflightReport(preflight, policy, { snapshotPin: preflight.evidence, consumerPin: preflight.consumer });
  const indexDigest = populationIndex ? evidenceDigest(populationIndex) : populationIndexDigest ?? 'e898ea657b4247858b905407275513510cc7db6b8efe3824ae982d2ddb6e0b55';
  if (!/^[a-f0-9]{64}$/.test(indexDigest)) throw new Error('population-index-digest-invalid');
  if (same(preflight.evidence, SNAPSHOT_PIN) && indexDigest !== 'e898ea657b4247858b905407275513510cc7db6b8efe3824ae982d2ddb6e0b55') throw new Error('initial-population-index-changed');
  if (!same(preflight.evidence, SNAPSHOT_PIN) && !populationIndex && !populationIndexDigest) throw new Error('future-population-index-required');
  return { preflight, policy, populationIndexDigest: indexDigest };
}
export function executionScope(runtime) {
  const inputs = runtimeInputs(runtime), { preflight } = inputs;
  return { baselineSourceCommit: '0c62fd38bca75c5b28b042dc79789b708ebf1d17', candidateSourceCommit: '5696d7e1a2950bdf54fa21244f351e1c4b171f25',
    qualificationRunId: '37772337995', inventorySha256: 'ce4e59de91d00514f29a0035333912d2ec470a8d56a1a0ecbb12fbcc9fd1cb74',
    engineCommit: CONSUMER_PIN.source.commit, engineBinarySha256: CONSUMER_PIN.executionEngine.binarySha256,
    sourceArchiveSha256: CONSUMER_PIN.source.sourceArchiveSha256, snapshotDigest: preflight.evidence.snapshot.contentDigest,
    populationDigest: preflight.population.digest, bindingDigest: preflight.population.bindingDigest,
    preflightDigest: evidenceDigest(preflight), policyDigest: evidenceDigest(inputs.policy), populationIndexDigest: inputs.populationIndexDigest,
    importerBuild: CONSUMER_PIN.evidenceConsumer.canonicalLinux.command,
    runs: 2, replaysPerRun: 2, protectedRuns: 0, maxJobs: 1, timeoutMinutes: 15 };
}
export function validateEvidenceCostDecision(cost, runtime) {
  if (!closed(cost, ['schema', 'state', 'decidedBy', 'decidedAt', 'scope']) || cost.schema !== 'pii-evidence-comparison-cost-decision/1' ||
      !same(cost.scope, executionScope(runtime)) || !['prepared', 'approved'].includes(cost.state)) throw new Error('evidence-cost-decision-invalid');
  if (cost.state === 'prepared' ? cost.decidedBy !== null || cost.decidedAt !== null
    : typeof cost.decidedBy !== 'string' || !cost.decidedBy.trim() || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(cost.decidedAt ?? '') || !Number.isFinite(Date.parse(cost.decidedAt)))
    throw new Error('evidence-cost-decision-invalid');
  return structuredClone(cost);
}
export function evidenceComparisonPlan({ costDecision, preflight, policy, populationIndex, populationIndexDigest } = {}) {
  const old = structuredClone(PRODUCT_PINS);
  const inputs = runtimeInputs({ preflight, policy, populationIndex, populationIndexDigest }); preflight = inputs.preflight; policy = inputs.policy;
  const runtime = { preflight, policy, populationIndex, populationIndexDigest };
  const cost = validateEvidenceCostDecision(costDecision ?? parseEvidenceJson(readFileSync(resolve(ROOT, COST_PATH), 'utf8')), runtime);
  return { schema: 'pii-evidence-comparison-plan/1', publicOnly: true, supportClaims: false, qualified: false,
    mode: cost.state === 'approved' ? 'official' : 'exploratory', runClass: 'public-synthetic', engineProductPin: 'candidate',
    evidence: structuredClone(preflight.evidence), consumer: structuredClone(preflight.consumer), preflight: structuredClone(preflight), policy: structuredClone(policy),
    engine: { repository: CONSUMER_PIN.source.repository, commit: CONSUMER_PIN.source.commit,
      binarySha256: CONSUMER_PIN.executionEngine.binarySha256, shimSha256: CONSUMER_PIN.source.shimSha256 },
    protocol: old.protocol, scanner: old.scanner, baseline: old.baseline, candidate: old.candidate,
    population: structuredClone(preflight.population), populationIndexDigest: inputs.populationIndexDigest, counts: structuredClone(preflight.counts), losses: structuredClone(preflight.losses),
    mappedFamilies: structuredClone(preflight.mappedFamilies), execution: executionScope(runtime),
    localVerification: { platform: 'darwin-arm64', canonical: false,
      engineBinarySha256: 'dee8ea89b3d78e5d36ab4aa5ac7daf3a9697cc8d730e80c288d15b0f167e8350',
      sourceCommit: CONSUMER_PIN.source.commit, sourceArchiveSha256: CONSUMER_PIN.source.sourceArchiveSha256,
      rustc: CONSUMER_PIN.evidenceConsumer.localVerification.rustc,
      command: 'cargo build --offline --release --locked -p pii-eval-cli --bin pii-eval --bin pii-eval-evidence -j 2',
      maximumExecutionSeconds: 60 },
    dispatch: { authorised: cost.state === 'approved', costDecision: COST_PATH,
      costDecisionSha256: cost.state === 'approved' ? evidenceDigest(cost) : null,
      sourceApproval: 'reviewed-e991-consumer-contract-and-released-evidence-pin', actualCostRecord: null },
    limitations: { familyMetrics: 'unavailable-no-family-projection-in-unprojected-schema-1.4',
      lostAxes: 'pending-until-faithfully-represented', protected: 'not-operational',
      baseline: 'published npm provenance; engine uses candidate tree binding for both products',
      historical: 'beta12 Darwin record is descriptive; explicit platform, binary and population match flags, distinct package, no regression verdict' } };
}
export function validateEvidenceComparisonPlan(plan, { populationIndex } = {}) {
  // The initial archive anchor remains fixed; a future plan carries its reviewed
  // candidate preflight and policy, bound by the fresh cost decision.
  const runtime = { preflight: plan?.preflight, policy: plan?.policy, populationIndex, populationIndexDigest: plan?.populationIndexDigest };
  const syntheticCost = { schema: 'pii-evidence-comparison-cost-decision/1', state: 'prepared', decidedBy: null, decidedAt: null, scope: executionScope(runtime) };
  const prepared = evidenceComparisonPlan({ costDecision: syntheticCost, ...runtime });
  if (plan?.mode === 'official') {
    prepared.mode = 'official'; prepared.dispatch.authorised = true;
    prepared.dispatch.costDecisionSha256 = plan.dispatch?.costDecisionSha256;
    if (!/^[a-f0-9]{64}$/.test(prepared.dispatch.costDecisionSha256 ?? '')) throw new Error('evidence-plan-invalid');
  }
  if (!same(plan, prepared)) throw new Error('evidence-plan-invalid');
  return structuredClone(plan);
}
export function readEvidenceComparisonPlan(file = PLAN_PATH) {
  return validateEvidenceComparisonPlan(parseEvidenceJson(readFileSync(file, 'utf8')));
}
