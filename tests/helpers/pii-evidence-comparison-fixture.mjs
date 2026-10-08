import { readFileSync } from 'node:fs';
import { evidenceComparisonPlan, evidenceDigest, executionScope } from '../../scripts/lib/pii-evidence-comparison-plan.mjs';
import { CONSUMER_PIN, sha256, expectedPreflightReport } from '../../scripts/lib/pii-evidence-contract.mjs';
import { semanticDigest } from '../../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
const read = path => JSON.parse(readFileSync(new URL('../../' + path, import.meta.url)));
const h = character => character.repeat(64);
// Synthetic metrics use the existing three-case wire fixture. They are never ledger evidence.
export function syntheticEvidenceComparison(options = {}) {
  const populationIndex = options.populationIndex ?? read('benchmarks/pii-evidence-comparison/population-index.json');
  const runtime = { ...options, populationIndex };
  const costDecision = { schema: 'pii-evidence-comparison-cost-decision/1', state: 'prepared', decidedBy: null, decidedAt: null,
    scope: executionScope(runtime) };
  const plan = evidenceComparisonPlan({ costDecision, ...runtime });
  const template = read('tests/fixtures/pii-eval/ci-37551091456-projection.public-synthetic-artifact.json');
  const receipt = { schema: 'pii-evidence-comparison-receipt/1', publicOnly: true, supportClaims: false, authorityChanged: false,
    planDigest: evidenceDigest(plan), mode: plan.mode, durationMs: 1,
    replayInputs: ['baseline', 'candidate'].flatMap(side => ['manifest', 'observation', 'run-artifact'].map(name => ({ name: `replay-inputs/${side}/${name}.json`, sha256: h('e') }))),
    engine: { ...plan.engine, binarySha256: plan.localVerification.engineBinarySha256, platform: 'darwin-arm64', canonical: false },
    importer: { binarySha256: CONSUMER_PIN.evidenceConsumer.localVerification.binarySha256, buildReceipt: null },
    import: { population: plan.population, counts: plan.counts, losses: plan.losses, populationIndexDigest: plan.populationIndexDigest,
      snapshotSha256: plan.preflight.outputs['snapshot.json'].sha256, bindingSha256: plan.preflight.outputs['binding.json'].sha256 } };
  const artifacts = [];
  for (const [index, side] of ['baseline', 'candidate'].entries()) {
    const doc = structuredClone(template); doc.schemaVersion = '1.4'; const sem = doc.semantic, tree = h(index ? 'b' : 'a');
    delete sem.productProjection;
    sem.population = { populationId: plan.population.id, populationVersion: 1, populationDigest: plan.population.digest, visibility: 'public-synthetic' };
    sem.populationCounts = { authoredCases: plan.counts.corpusCases, occurrences: plan.counts.occurrences, variants: plan.counts.corpusVariants };
    sem.outcomes = populationIndex.map(row => ({ caseId: row.caseId, variantId: row.variantId, occurrenceId: row.occurrenceId, method: row.method,
      scannerId: 'redact-secret-core', action: { state: 'output-verified', verification: 'residual-present' }, range: 'miss', sensitivityContext: 'unresolved', typeIdentity: 'unresolved' }));
    sem.scanners[0].identity = { ...sem.scanners[0].identity, scannerVersion: plan[side].version, artifactDigest: tree, product: { kind: 'candidate', candidateDigest: tree } };
    sem.scanners[0].replays = { count: 2, agreed: true };
    doc.semanticDigest = semanticDigest(doc); const text = JSON.stringify(doc);
    receipt[side] = { sourceCommit: plan[side].sourceCommit, version: plan[side].version, packageTreeSha256: tree, addonTreeSha256: h('c'), wasmTreeSha256: h('d'),
      manifestDigest: sem.manifestDigest, artifactDigest: doc.semanticDigest, artifactSha256: sha256(text),
      tarballs: { core: plan.candidate.coreTarballSha256, node: plan.candidate.localNativeDarwinTarballSha256, wasm: plan.candidate.piiWasmTarballSha256 },
      tarballIntegrity: { core: plan.baseline.packages['@redact-secret/core'].integrity, node: plan.baseline.packages['@redact-secret/node-darwin-arm64'].integrity, wasm: plan.baseline.packages['@redact-secret/wasm'].integrity },
      replays: Array.from({ length: 2 }, () => ({ state: 'replayed', parity: 'identical', publicArtifactDigest: doc.semanticDigest })) };
    artifacts.push({ side, text });
  }
  delete receipt.engine.repository;
  return { plan, receipt, artifacts, populationIndex };
}

export function syntheticEvidenceOfficialUpload(options = {}) {
  const e = syntheticEvidenceComparison(options), costDecision = { schema: 'pii-evidence-comparison-cost-decision/1', state: 'approved',
    decidedBy: 'synthetic-test-owner', decidedAt: '2026-10-08T00:00:00Z', scope: e.plan.execution };
  e.plan = evidenceComparisonPlan({ costDecision, preflight: e.plan.preflight, policy: e.plan.policy, populationIndex: e.populationIndex }); e.receipt.planDigest = evidenceDigest(e.plan); e.receipt.mode = 'official';
  e.receipt.engine.binarySha256 = e.plan.engine.binarySha256; e.receipt.engine.platform = 'linux-x64'; e.receipt.engine.canonical = true;
  const pin = e.plan.consumer;
  e.receipt.importer = { binarySha256: h('a'), buildReceipt: { schema: 'pii-evidence-consumer-build-receipt/1', sourceCommit: pin.source.commit,
    sourceArchiveSha256: pin.source.sourceArchiveSha256, cargoLockSha256: pin.source.cargoLockSha256, rustToolchainFileSha256: pin.source.rustToolchainFileSha256,
    rustc: pin.evidenceConsumer.canonicalLinux.rustc, command: pin.evidenceConsumer.canonicalLinux.command, platform: 'linux-x64', binarySha256: h('a') } };
  const headSha = '1'.repeat(40), runId = 9, repository = 'redact-secret/redact-secret-benchmarks', branch = 'feat/synthetic-evidence';
  e.receipt.github = { repository, runId, runAttempt: 1, headSha, workflowRef: `${repository}/.github/workflows/pii-official-run.yml@refs/heads/${branch}` };
  for (const side of ['baseline', 'candidate']) {
    e.receipt[side].tarballIntegrity.node = e.plan.baseline.packages['@redact-secret/node-linux-x64-gnu'].integrity;
    if (side === 'candidate') e.receipt[side].tarballs.node = e.plan.candidate.nativeLinuxTarballSha256;
  }
  const files = { 'plan.json': JSON.stringify(e.plan), 'build-receipt.json': JSON.stringify(e.receipt.importer.buildReceipt) };
  for (const input of e.receipt.replayInputs) { files[input.name] = '{}'; input.sha256 = sha256(files[input.name]); }
  files['receipt.json'] = JSON.stringify(e.receipt);
  for (const artifact of e.artifacts) files[`${artifact.side}.public-synthetic-artifact.json`] = artifact.text;
  return { ...e, costDecision, files, expectedHeadSha: headSha, archiveSha256: h('f'),
    run: { id: runId, repository: { full_name: repository }, head_repository: { full_name: repository }, path: '.github/workflows/pii-official-run.yml', event: 'workflow_dispatch',
      status: 'completed', conclusion: 'success', run_attempt: 1, head_sha: headSha, head_branch: branch },
    artifact: { id: 7, name: 'pii-evidence-comparison', expired: false, digest: 'sha256:' + h('f'), size_in_bytes: 1000, workflow_run: { id: runId, head_sha: headSha } } };
}

export function syntheticFutureEvidenceOfficialUpload() {
  const first = syntheticEvidenceComparison(), snapshotPin = structuredClone(first.plan.evidence), consumerPin = structuredClone(first.plan.consumer);
  snapshotPin.snapshot.id = 'public-pii-phi/2026-10-08/cccccccccccc'; snapshotPin.snapshot.contentDigest = h('c');
  snapshotPin.release.tag = 'snapshot-' + snapshotPin.snapshot.id.replaceAll('/', '-');
  snapshotPin.release.archive.name = 'pii-evidence-' + snapshotPin.snapshot.id.replaceAll('/', '-') + '.tar.gz';
  snapshotPin.release.commit = '2'.repeat(40); snapshotPin.snapshot.manifestSha256 = h('d');
  consumerPin.importedPopulation = { id: 'pii-evidence-' + snapshotPin.snapshot.id.replaceAll('/', '-'), version: 1, digest: h('2'), bindingDigest: h('3') };
  const outputs = structuredClone(first.plan.preflight.outputs); outputs['snapshot.json'].sha256 = h('4'); outputs['binding.json'].sha256 = h('5');
  const preflight = expectedPreflightReport(first.plan.policy, { snapshotPin, consumerPin, counts: first.plan.counts, losses: first.plan.losses,
    mappedFamilies: first.plan.mappedFamilies, mappedKinds: first.plan.preflight.mappedKinds, outputs });
  return syntheticEvidenceOfficialUpload({ preflight, policy: first.plan.policy, populationIndex: first.populationIndex });
}
