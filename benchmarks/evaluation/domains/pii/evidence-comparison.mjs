import { parseStrictJson, semanticDigest, verifyArtifact } from './pii-eval-artifact-consumer.mjs';
import { sha256, CONSUMER_PIN, validateSourceBuiltConsumerReceipt } from '../../../../scripts/lib/pii-evidence-contract.mjs';
import { stable, same, closed, evidenceDigest, validateEvidenceComparisonPlan } from '../../../../scripts/lib/pii-evidence-comparison-plan.mjs';

export const SIDES = ['baseline', 'candidate'];
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const refuse = code => { throw new Error(code); };
const tuple = row => [row.caseId, row.variantId, row.occurrenceId, row.method, row.scannerId].join('|');
export const POPULATION_INDEX_DIGEST = 'e898ea657b4247858b905407275513510cc7db6b8efe3824ae982d2ddb6e0b55';

export function validateEvidencePopulationIndex(index, { plan } = {}) {
  if (plan) validateEvidenceComparisonPlan(plan, { populationIndex: index });
  const count = plan?.counts.corpusVariants ?? 139, digest = plan?.populationIndexDigest ?? POPULATION_INDEX_DIGEST;
  if (!Array.isArray(index) || index.length !== count || evidenceDigest(index) !== digest ||
      index.some(row => !closed(row, ['caseId', 'variantId', 'occurrenceId', 'method', 'family']) ||
        !/^e[cu]-[a-f0-9]{24}$/.test(row.caseId) || !/^ev-[a-f0-9]{24}$/.test(row.variantId) || row.occurrenceId !== 'occurrence-1' ||
        !['schema-only', 'type-validation', 'pii-benign'].includes(row.method)) || new Set(index.map(row => row.variantId)).size !== count)
    refuse('population-index-mismatch');
  if (plan) {
    const families = {};
    for (const row of index) {
      families[row.family] ??= { cases: new Set(), variants: 0 }; families[row.family].cases.add(row.caseId); families[row.family].variants++;
    }
    if (!same(Object.fromEntries(Object.entries(families).map(([family, row]) => [family, { cases: row.cases.size, variants: row.variants }])), plan.mappedFamilies) ||
        new Set(index.map(row => row.caseId)).size !== plan.counts.corpusCases) refuse('population-index-accounting-mismatch');
  }
  return structuredClone(index);
}
export function deriveEvidencePopulationIndex(snapshot, binding, plan) {
  const byVariant = new Map(binding.semantic.rows.map(row => [row.variantId, row.mapped.family]));
  return validateEvidencePopulationIndex(snapshot.semantic.cases.flatMap(row => row.variants.map(variant =>
    ({ caseId: row.caseId, variantId: variant.variantId, occurrenceId: variant.expectations[0].occurrenceId, method: row.method, family: byVariant.get(variant.variantId) })))
    .sort((a, b) => a.variantId.localeCompare(b.variantId)), { plan });
}

export function validateEvidenceComparisonReceipt(receipt, plan) {
  validateEvidenceComparisonPlan(plan);
  const keys = ['schema', 'publicOnly', 'supportClaims', 'authorityChanged', 'planDigest', 'mode', 'engine', 'importer', 'import', 'baseline', 'candidate', 'durationMs', 'replayInputs'];
  if (plan.mode === 'official') keys.push('github');
  if (!closed(receipt, keys) || receipt.schema !== 'pii-evidence-comparison-receipt/1' || receipt.publicOnly !== true ||
      receipt.supportClaims !== false || receipt.authorityChanged !== false || receipt.planDigest !== evidenceDigest(plan) ||
      receipt.mode !== plan.mode || !Number.isSafeInteger(receipt.durationMs) || receipt.durationMs < 0 || receipt.durationMs > 900000)
    refuse('receipt-identity-mismatch');
  if (!closed(receipt.engine, ['commit', 'binarySha256', 'shimSha256', 'platform', 'canonical']) ||
      receipt.engine.commit !== plan.engine.commit || receipt.engine.shimSha256 !== plan.engine.shimSha256 ||
      !hex(receipt.engine.binarySha256)) refuse('engine-identity-mismatch');
  if (!closed(receipt.importer, ['binarySha256', 'buildReceipt']) || !hex(receipt.importer.binarySha256)) refuse('importer-identity-mismatch');
  if (plan.mode === 'official') {
    if (receipt.engine.platform !== 'linux-x64' || receipt.engine.canonical !== true || receipt.engine.binarySha256 !== plan.engine.binarySha256)
      refuse('canonical-engine-mismatch');
    validateSourceBuiltConsumerReceipt(receipt.importer.buildReceipt);
    if (receipt.importer.binarySha256 !== receipt.importer.buildReceipt.binarySha256) refuse('importer-binary-mismatch');
    const g = receipt.github;
    if (!closed(g, ['repository', 'runId', 'runAttempt', 'headSha', 'workflowRef']) ||
        g.repository !== 'redact-secret/redact-secret-benchmarks' || !Number.isSafeInteger(g.runId) || g.runId <= 0 || g.runAttempt !== 1 ||
        !/^[a-f0-9]{40}$/.test(g.headSha ?? '') || !/^redact-secret\/redact-secret-benchmarks\/\.github\/workflows\/pii-official-run\.yml@refs\/heads\/(?!main$|develop$)[A-Za-z0-9._/-]+$/.test(g.workflowRef ?? ''))
      refuse('canonical-github-mismatch');
  } else {
    if (receipt.engine.platform !== 'darwin-arm64' || receipt.engine.canonical !== false || receipt.engine.binarySha256 !== plan.localVerification.engineBinarySha256 || receipt.importer.buildReceipt !== null ||
        receipt.importer.binarySha256 !== CONSUMER_PIN.evidenceConsumer.localVerification.binarySha256)
      refuse('local-verification-mismatch');
  }
  if (!same(receipt.import, { population: plan.population, counts: plan.counts, losses: plan.losses,
    snapshotSha256: plan.preflight.outputs['snapshot.json'].sha256,
    bindingSha256: plan.preflight.outputs['binding.json'].sha256,
    populationIndexDigest: plan.populationIndexDigest })) refuse('import-binding-mismatch');
  const replayNames = SIDES.flatMap(side => ['manifest', 'observation', 'run-artifact'].map(name => `replay-inputs/${side}/${name}.json`));
  if (!Array.isArray(receipt.replayInputs) || receipt.replayInputs.length !== replayNames.length ||
      receipt.replayInputs.some((row, index) => !closed(row, ['name', 'sha256']) || row.name !== replayNames[index] || !hex(row.sha256))) refuse('replay-input-inventory-mismatch');
  for (const side of SIDES) {
    const row = receipt[side];
    if (!closed(row, ['sourceCommit', 'version', 'packageTreeSha256', 'addonTreeSha256', 'wasmTreeSha256', 'tarballs', 'tarballIntegrity', 'manifestDigest', 'artifactDigest', 'artifactSha256', 'replays']) ||
        row.sourceCommit !== plan[side].sourceCommit || row.version !== plan[side].version ||
        ['packageTreeSha256', 'addonTreeSha256', 'wasmTreeSha256', 'manifestDigest', 'artifactDigest', 'artifactSha256'].some(key => !hex(row[key])) ||
        !closed(row.tarballs, ['core', 'node', 'wasm']) || !Object.values(row.tarballs).every(hex) ||
        !closed(row.tarballIntegrity, ['core', 'node', 'wasm']) || !Object.values(row.tarballIntegrity).every(value => /^sha512-[A-Za-z0-9+/]+==$/.test(value)) ||
        !Array.isArray(row.replays) || row.replays.length !== 2 || row.replays.some(replay => !closed(replay, ['state', 'parity', 'publicArtifactDigest']) ||
          replay.state !== 'replayed' || replay.parity !== 'identical' || replay.publicArtifactDigest !== row.artifactDigest))
      refuse('product-or-replay-binding-mismatch');
    if (side === 'baseline') {
      for (const key of ['core', 'node', 'wasm']) {
        const name = key === 'node' ? `@redact-secret/node-${receipt.engine.platform}${receipt.engine.platform === 'linux-x64' ? '-gnu' : ''}` : `@redact-secret/${key}`;
        if (row.tarballIntegrity[key] !== plan.baseline.packages[name]?.integrity) refuse('published-integrity-mismatch');
      }
    } else if (row.tarballs.core !== plan.candidate.coreTarballSha256 || row.tarballs.wasm !== plan.candidate.piiWasmTarballSha256 ||
      (plan.mode === 'official' && row.tarballs.node !== plan.candidate.nativeLinuxTarballSha256)) refuse('qualified-package-mismatch');
  }
  return structuredClone(receipt);
}

function artifactPins(doc, side, receipt, plan) {
  const row = receipt[side];
  return { artifactSchema: { id: 'pii-eval.public-synthetic-artifact', version: '1.4' },
    engine: { name: 'pii-eval', version: '0.0.0' }, protocol: { accounting: 'pii-v1', id: 'pii-v1',
      rules: { accounting: { id: 'pii-v1-canonical-accounting', revision: 2 }, matching: { id: 'pii-v1-canonical', revision: 2 }, statistics: { id: 'pii-v1-wilson-exact', revision: 1 } }, version: 2 },
    requireComplete: true, populations: [{ label: 'released-evidence', runClass: 'public-synthetic', artifactDigest: row.artifactDigest,
      retiredArtifactDigests: [], manifestDigest: row.manifestDigest, retiredManifestDigests: [],
      population: { populationId: plan.population.id, populationVersion: 1, populationDigest: plan.population.digest, visibility: 'public-synthetic' },
      scanners: [{ scannerId: 'redact-secret-core', scannerVersion: row.version, artifactDigest: row.packageTreeSha256,
        adapter: { adapterId: plan.scanner.adapter.id, adapterVersion: plan.scanner.adapter.version, normalizationVersion: 1 },
        configurationDigest: plan.scanner.configurationDigest, activationDigest: plan.scanner.activationDigest,
        product: { kind: 'candidate', candidateDigest: row.packageTreeSha256 }, candidateSourceCommit: row.sourceCommit }] }] };
}

export function validateEvidenceComparisonRecord(record, { plan, receipt, receiptText, artifacts }) {
  if (!closed(record, ['schema', 'publicOnly', 'supportClaims', 'authorityChanged', 'planDigest', 'workflow', 'actionsArtifact', 'receipt', 'buildReceipt', 'artifacts', 'replayInputs']) ||
      record.schema !== 'pii-evidence-comparison-record/1' || record.publicOnly !== true || record.supportClaims !== false || record.authorityChanged !== false ||
      record.planDigest !== evidenceDigest(plan)) refuse('record-identity-mismatch');
  const w = record.workflow, g = receipt.github;
  if (!closed(w, ['repository', 'path', 'reusablePath', 'runId', 'runAttempt', 'event', 'headSha', 'headBranch', 'conclusion']) ||
      w.repository !== g.repository || w.path !== '.github/workflows/pii-official-run.yml' || w.reusablePath !== '.github/workflows/pii-evidence-comparison.yml' ||
      w.runId !== g.runId || w.runAttempt !== 1 || w.event !== 'workflow_dispatch' || w.headSha !== g.headSha || w.conclusion !== 'success' ||
      g.workflowRef !== `${w.repository}/${w.path}@refs/heads/${w.headBranch}`) refuse('record-workflow-mismatch');
  const a = record.actionsArtifact;
  if (!closed(a, ['id', 'name', 'archiveSha256', 'sizeInBytes']) || !Number.isSafeInteger(a.id) || a.id <= 0 || a.name !== 'pii-evidence-comparison' ||
      !hex(a.archiveSha256) || !Number.isSafeInteger(a.sizeInBytes) || a.sizeInBytes <= 0) refuse('record-archive-mismatch');
  if (!closed(record.receipt, ['sha256', 'documentDigest']) || record.receipt.sha256 !== sha256(receiptText) || record.receipt.documentDigest !== evidenceDigest(receipt))
    refuse('record-receipt-mismatch');
  if (!closed(record.buildReceipt, ['sha256', 'documentDigest']) || !hex(record.buildReceipt.sha256) ||
      record.buildReceipt.documentDigest !== evidenceDigest(receipt.importer.buildReceipt)) refuse('record-build-receipt-mismatch');
  if (!same(record.artifacts, SIDES.map(side => ({ side, sha256: sha256(artifacts.find(row => row.side === side).text) })))) refuse('record-artifact-mismatch');
  if (!same(record.replayInputs, receipt.replayInputs)) refuse('record-replay-input-mismatch');
  return structuredClone(record);
}

export function loadPiiEvidenceComparison({ plan, receipt, receiptText, artifacts = [], record, populationIndex, allowUnrecordedOfficial = false } = {}) {
  const base = { publicOnly: true, supportClaims: false, qualified: false };
  if (!plan || !receipt) return { ...base, state: 'absent', reason: 'new-evidence-comparison-not-recorded' };
  try {
    validateEvidenceComparisonReceipt(receipt, plan); validateEvidencePopulationIndex(populationIndex, { plan });
    if (!Array.isArray(artifacts) || artifacts.length !== 2 || !same(artifacts.map(row => row.side).sort(), SIDES)) refuse('artifact-set-mismatch');
    if (plan.mode === 'official' && !allowUnrecordedOfficial) {
      if (!record || typeof receiptText !== 'string') refuse('canonical-record-missing');
      validateEvidenceComparisonRecord(record, { plan, receipt, receiptText, artifacts });
    }
    const documents = {};
    for (const side of SIDES) {
      const artifact = artifacts.find(row => row.side === side), doc = parseStrictJson(artifact.text);
      if (sha256(artifact.text) !== receipt[side].artifactSha256) refuse('artifact-byte-mismatch');
      const checked = verifyArtifact(doc, artifactPins(doc, side, receipt, plan));
      if (checked.reasons.length) refuse(`artifact-${checked.reasons[0].code}`);
      if (doc.semantic.scanners.length !== 1 || !same(doc.semantic.scanners[0].replays, { agreed: true, count: 2 }) ||
          !same(doc.semantic.populationCounts, { authoredCases: plan.counts.corpusCases, occurrences: plan.counts.occurrences, variants: plan.counts.corpusVariants }) ||
          doc.semantic.outcomes.length !== plan.counts.occurrences || doc.semantic.scannerMetrics.length !== 1 || doc.semantic.scannerMetrics[0].metrics.length !== 10) refuse('artifact-incomplete-paired-population');
      const membership = new Map(populationIndex.map(row => [row.variantId, row]));
      if (new Set(doc.semantic.outcomes.map(row => row.variantId)).size !== plan.counts.corpusVariants || doc.semantic.outcomes.some(row =>
        membership.get(row.variantId)?.caseId !== row.caseId || membership.get(row.variantId)?.occurrenceId !== row.occurrenceId ||
        membership.get(row.variantId)?.method !== row.method || row.scannerId !== 'redact-secret-core')) refuse('outcome-membership-mismatch');
      documents[side] = doc;
    }
    const candidates = new Map(documents.candidate.semantic.outcomes.map(row => [tuple(row), row]));
    const families = new Map(populationIndex.map(row => [row.variantId, row.family]));
    const outcomes = documents.baseline.semantic.outcomes.map(baseline => {
      const candidate = candidates.get(tuple(baseline)); if (!candidate) refuse('outcome-pair-mismatch');
      return { caseId: baseline.caseId, variantId: baseline.variantId, family: families.get(baseline.variantId), baseline, candidate, changed: !same(baseline, candidate) };
    });
    const baselineMetrics = documents.baseline.semantic.scannerMetrics[0].metrics, candidateMetrics = documents.candidate.semantic.scannerMetrics[0].metrics;
    const metrics = baselineMetrics.map(baseline => {
      const candidate = candidateMetrics.find(row => same(row.metric, baseline.metric)); if (!candidate) refuse('metric-pair-mismatch');
      const numeric = value => value.mantissa / 10 ** value.scale;
      return { metric: baseline.metric, baseline, candidate, delta: baseline.value.state === 'measured' && candidate.value.state === 'measured'
        ? numeric(candidate.value.point) - numeric(baseline.value.point) : null };
    });
    const byFamily = Object.fromEntries(Object.keys(plan.mappedFamilies).map(family => [family, outcomes.filter(row => row.family === family && row.changed).length]));
    return { ...base, state: 'recorded', mode: plan.mode, evidence: plan.evidence, population: plan.population, counts: plan.counts, losses: plan.losses,
      mappedFamilies: plan.mappedFamilies, protocol: plan.protocol, scanner: plan.scanner, engine: receipt.engine, importer: receipt.importer, baseline: { ...plan.baseline, ...receipt.baseline },
      candidate: { ...plan.candidate, ...receipt.candidate }, metrics, outcomes, changes: { total: outcomes.filter(row => row.changed).length, byFamily },
      provenance: plan.mode === 'official' && record ? { workflow: record.workflow, actionsArtifact: record.actionsArtifact, receipt: record.receipt }
        : { mode: 'exploratory', canonical: false },
      familyMetrics: { state: 'unavailable', reason: 'unprojected-schema-1.4' },
      historical: { state: 'descriptive-only', version: '0.1.0-beta.12', platform: 'darwin-arm64', source: 'upstream-bootstrap-measurement',
        record: 'https://github.com/redact-secret/pii-eval/blob/e99128f5633c5905497342623e249ad90d902800/docs/measurements/pii-evidence-public-pii-phi-2026-10-07-9d4e8e036bbb/provenance.json',
        artifactDigest: 'd54f96f9b71f89c4960d7d3e086de6d1a19f24d9012fa63d08015f9a605faa6d',
        artifactSha256: '077b1ea0f545a43ceacbc0ea94ab6fd4c517c18e48d06132a7d1d1e73408a9a3',
        engineBinarySha256: 'dee8ea89b3d78e5d36ab4aa5ac7daf3a9697cc8d730e80c288d15b0f167e8350',
        populationDigest: CONSUMER_PIN.importedPopulation.digest,
        platformMatches: receipt.engine.platform === 'darwin-arm64',
        engineBinaryMatches: receipt.engine.binarySha256 === 'dee8ea89b3d78e5d36ab4aa5ac7daf3a9697cc8d730e80c288d15b0f167e8350',
        populationMatches: plan.population.digest === CONSUMER_PIN.importedPopulation.digest,
        verdict: 'unavailable-descriptive-history-only-no-regression-verdict' } };
  } catch (error) { return { ...base, state: 'invalid', reason: error.message }; }
}
