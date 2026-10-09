import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEvidenceJson } from './pii-evidence-json.mjs';
import { validatePiiPopulationPolicy } from './pii-population-policy.mjs';
import { parseStrictJson, semanticDigest } from '../../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(item => JSON.parse(canonical(item)))
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value);
const same = (a, b) => canonical(a) === canonical(b);
const refuse = code => { throw new Error(`PII evidence refusal: ${code}`); };
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const closed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && same(Object.keys(value).sort(), [...keys].sort());
const integer = value => Number.isSafeInteger(value) && value >= 0;

export const SNAPSHOT_PIN = {
  schema: 'pii-eval-evidence-pin/1',
  contract: { name: 'pii-evidence-consumer-contract', version: '1', digestSpec: 'files-v1' },
  release: {
    repository: 'redact-secret/pii-evidence', tag: 'snapshot-public-pii-phi-2026-10-07-9d4e8e036bbb',
    commit: 'c436ae013011b9c8b1126f589d1b14d99a84baf5',
    archive: { name: 'pii-evidence-public-pii-phi-2026-10-07-9d4e8e036bbb.tar.gz',
      tarGzSha256: '8962f02ec04687c3b26bc70a95c57629eb31161b809f8b8317851ff1baa7498b',
      tarSha256: '05d9dcd1483c70c5e763338a70366364b650658af1883b6a98bae0f4ab08b5a6' },
  },
  snapshot: { id: 'public-pii-phi/2026-10-07/9d4e8e036bbb',
    contentDigest: '9d4e8e036bbb180fb3a09569a2993e51ad10fbc183765882325f2bc10b321ba2',
    manifestSha256: 'a9e24b6dc73bc876f9fce341c7305421b054ae399df83d198513bede03555ca9',
    sourceManifestDigest: 'e6f26033e83341c9a106dfa2542573e956912266cacfae0fcc1a6fb46d07c47c' },
};
export const CONSUMER_PIN = {
  schema: 'pii-evidence-consumer-pin/1', state: 'candidate', supportClaims: false,
  source: { repository: 'redact-secret/pii-eval', commit: 'e99128f5633c5905497342623e249ad90d902800',
    sourceArchiveSha256: 'da47d780545ccdefe65258cf6f0cbe77b06e1ec77610b6ccdb94994ce173d84d',
    cargoLockSha256: 'e646a917c7dc8a5d5f5744bbfc56456661ebeb5505ac18788b7d5262f29a956a',
    rustToolchainFileSha256: '887f9be066a15585a2c583578e84b0fcb541126d81546276bad3d2ff00d61167',
    fetchHelperSha256: '2d643183e4fe65c05411047cc463001b4ec390274061f10a171ec8e5d17bc1e4',
    shimSha256: '21664407345b099d3f5e44db26bcfb037b2e981635dec0a7b5383b42b737e0a8' },
  contract: { engineVersion: '0.0.0', protocol: { id: 'pii-v1', revision: 2 }, corpusSchema: '1.4',
    artifactSchema: '1.4', mapping: { id: 'pii-evidence-to-corpus', revision: 1 } },
  executionEngine: {
    platform: 'linux-x64', binarySha256: '5bf386ced06361ff46649fb085a51148548b70b2ca2276c34e7e0e028c617046',
    workflow: { runId: 37637513834, runAttempt: 1, path: '.github/workflows/ci.yml', event: 'push', branch: 'main', conclusion: 'success' },
    archive: { id: 11490276889, name: 'pii-eval-engine-e99128f5633c5905497342623e249ad90d902800-linux-x86_64',
      sha256: 'eeddad4deba3a7c28a0d5d3bfc28a6a0f4f27d1403818e9de7c103b3f209a1b0',
      members: { 'pii-eval': '5bf386ced06361ff46649fb085a51148548b70b2ca2276c34e7e0e028c617046',
        'build-info.json': 'c172a059c7380680026a053da1165cb2f5a293f1a9a35454bf78014a9468410f',
        SHA256SUMS: 'bcd492c124f16f43fef8ba33fa741ae4ffc5dc93056d7f18ebc81e61b2aad746' } },
  },
  evidenceConsumer: {
    binary: 'pii-eval-evidence', canonicalLinux: { state: 'pending-source-build',
      reason: 'upstream-ci-does-not-archive-evidence-consumer', binarySha256: null,
      command: 'cargo build --offline --release --locked -p pii-eval-cli --bin pii-eval-evidence -j 2',
      rustc: 'rustc 1.98.1 (48a229cea 2026-09-01)',
      receiptRequiredBeforeUse: true, scannerGate: 'sealed-build-receipt-and-exact-import-semantics' },
    localVerification: { platform: 'darwin-arm64', binarySha256: '53add85cecefb9fb10ccc82e735d09ae8d36381edb014dd6790a95d41bf5e591',
      rustc: 'rustc 1.98.1 (48a229cea 2026-09-01)', canonical: false },
  },
  importedPopulation: { id: 'pii-evidence-public-pii-phi-2026-10-07-9d4e8e036bbb', version: 1,
    digest: '612a8cf629c24c8e92be474a8129a592c7f1f75cbe4e2e2afcc60383cc6347d8',
    bindingDigest: 'f481baee5aa3d812f7858902c5024618e09e0a2868993d31dc10525c53ddf9fb' },
  preservedPopulationPinsSha256: '65179ea2b1ec86f2bae7e0f81c6e9dadf3943388e5b5d28998ddfa86c9636787',
};
export const COUNTS = { evidenceCases: 49, evidenceCasesCarried: 47, evidenceCasesWithoutFixtures: 2,
  evidenceFixtures: 139, evidenceSkipped: 8, corpusCases: 55, corpusVariants: 139, occurrences: 139,
  locatedOccurrences: 98, rangeLessOccurrences: 41 };
export const LOSSES = { 'contexts-not-carried': 37, 'phi-domain-not-carried': 37,
  'sensitivity-context-dependent-flattened': 11, 'identity-weakened-no-span': 17, 'sensitivity-weakened-no-span': 19 };
export const IMPORT_OUTPUTS = { 'snapshot.json': { bytes: 132062, sha256: '7396c86b3683c51999a22978bc3a007b32d31eb0fc0cd55378c54f0aa42f3067' },
  'binding.json': { bytes: 154912, sha256: '723090ce467a09d453d9f154e26abfa393e952538a9092573dcde9a02a88f928' } };
export const MAPPING_KINDS = {
  'email/global/basic': 'pii:global:email', 'phone/global/basic': 'pii:global:phone',
  'payment-card/global/basic': 'pii:global:payment-card', 'iban/global/basic': 'pii:global:iban',
  'us-ssn/us/structured': 'pii:us:ssn', 'medical-record-number/us/labeled-field': 'pii:us:medical-record-number',
  'health-plan-member-id/us/member-field': 'pii:us:health-plan-member-id',
  'health-claim-identifier/us/claim-field': 'pii:us:health-claim-identifier',
  'prescription-order-identifier/us/order-field': 'pii:us:prescription-order-identifier',
};
export const MAPPED_KINDS = Object.keys(MAPPING_KINDS).filter(kind => !['payment-card/global/basic', 'iban/global/basic'].includes(kind)).sort();
export const MAPPED_FAMILIES = {
  'pii:global:email': { cases: 28, variants: 92 }, 'pii:global:phone': { cases: 2, variants: 10 },
  'pii:us:health-claim-identifier': { cases: 1, variants: 1 }, 'pii:us:health-plan-member-id': { cases: 5, variants: 9 },
  'pii:us:medical-record-number': { cases: 9, variants: 17 }, 'pii:us:prescription-order-identifier': { cases: 1, variants: 1 },
  'pii:us:ssn': { cases: 9, variants: 9 },
};

const runtimeIdentity = pin => ({ ...pin, importedPopulation: CONSUMER_PIN.importedPopulation });
const familiesOf = value => Array.isArray(value) ? value : [value];
function reviewedCandidateRuntime(pin, repoRoot) {
  // A static-export bundler treats a literal file URL as a public asset. Read the
  // registry through the build's repository root so its bytes stay server-only.
  const root = repoRoot ?? process.env.WEB_REPO_ROOT ?? (path.basename(process.cwd()) === 'web'
    ? path.resolve(process.cwd(), '..') : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
  const registry = parseEvidenceJson(readFileSync(path.join(root, 'benchmarks/pii-evidence/candidate-runtimes.json'), 'utf8'));
  if (!closed(registry, ['schema', 'runtimes']) || registry.schema !== 'pii-evidence-reviewed-candidate-runtimes/1' || !Array.isArray(registry.runtimes)) refuse('candidate-runtime-registry-invalid');
  const entry = registry.runtimes.find(runtime => same(runtime.consumerIdentity, runtimeIdentity(pin)));
  const semanticContract = { ...CONSUMER_PIN.contract, protocol: { id: 'pii-v1', revision: 3 },
    corpusSchema: '1.5', artifactSchema: '1.5', mapping: { id: 'pii-evidence-to-corpus', revision: 3 } };
  const semanticRuntime = same(pin.contract, semanticContract);
  if (!entry || !closed(entry, ['schema', 'consumerIdentity', 'buildReceipt', 'mappingKinds', ...(Object.hasOwn(entry ?? {}, 'planActivation') ? ['planActivation'] : [])]) || entry.schema !== 'pii-evidence-reviewed-candidate-runtime/1' ||
      (!semanticRuntime && !same(pin.executionEngine, CONSUMER_PIN.executionEngine)) || !same(pin.evidenceConsumer.canonicalLinux, CONSUMER_PIN.evidenceConsumer.canonicalLinux) ||
      pin.schema !== CONSUMER_PIN.schema || pin.state !== 'candidate' || pin.supportClaims !== false ||
      pin.source.repository !== CONSUMER_PIN.source.repository || !/^[a-f0-9]{40}$/.test(pin.source.commit) ||
      (!semanticRuntime && !same({ ...pin.contract, mapping: CONSUMER_PIN.contract.mapping }, CONSUMER_PIN.contract)) ||
      pin.contract.mapping.id !== CONSUMER_PIN.contract.mapping.id || !integer(pin.contract.mapping.revision) || pin.contract.mapping.revision < 2 ||
      pin.preservedPopulationPinsSha256 !== CONSUMER_PIN.preservedPopulationPinsSha256 ||
      pin.evidenceConsumer.localVerification.canonical !== false || pin.evidenceConsumer.localVerification.platform !== 'darwin-arm64' ||
      !hex(pin.evidenceConsumer.localVerification.binarySha256) ||
      Object.entries(pin.source).filter(([key]) => !['repository', 'commit'].includes(key)).some(([, value]) => !hex(value))) refuse('candidate-runtime-not-reviewed');
  if (entry.planActivation !== undefined && (!semanticRuntime || !Array.isArray(entry.planActivation) ||
      entry.planActivation.length < 1 || entry.planActivation.length > 256 ||
      entry.planActivation.some(value => typeof value !== 'string' || !/^[a-z][a-z0-9:.-]{1,79}$/.test(value)) ||
      !same(entry.planActivation, [...new Set(entry.planActivation)].sort()))) refuse('candidate-runtime-activation-invalid');
  const receipt = entry.buildReceipt;
  if (!closed(receipt, ['schema', 'sourceCommit', 'sourceArchiveSha256', 'cargoLockSha256', 'rustToolchainFileSha256', 'rustc', 'command', 'platform', 'binarySha256']) ||
      receipt.schema !== 'pii-evidence-consumer-build-receipt/1' || receipt.sourceCommit !== pin.source.commit ||
      receipt.sourceArchiveSha256 !== pin.source.sourceArchiveSha256 || receipt.cargoLockSha256 !== pin.source.cargoLockSha256 ||
      receipt.rustToolchainFileSha256 !== pin.source.rustToolchainFileSha256 || receipt.rustc !== pin.evidenceConsumer.localVerification.rustc ||
      receipt.platform !== pin.evidenceConsumer.localVerification.platform || receipt.binarySha256 !== pin.evidenceConsumer.localVerification.binarySha256 ||
      receipt.command !== (semanticRuntime ? 'cargo build --locked --release -p pii-eval-cli --bin pii-eval-evidence -j 2'
        : 'cargo build --locked -p pii-eval-cli --bin pii-eval-evidence -j 2') ||
      !entry.mappingKinds || typeof entry.mappingKinds !== 'object' || Array.isArray(entry.mappingKinds) ||
      Object.entries(MAPPING_KINDS).some(([kind, family]) => entry.mappingKinds[kind] !== family) ||
      new Set(Object.values(entry.mappingKinds).flatMap(familiesOf)).size !== Object.values(entry.mappingKinds).flatMap(familiesOf).length ||
      Object.values(entry.mappingKinds).some(value => !familiesOf(value).length ||
        familiesOf(value).some(family => typeof family !== 'string' || !/^pii:(global|us|gb):[a-z0-9-]+$/.test(family)) ||
        new Set(familiesOf(value)).size !== familiesOf(value).length)) refuse('candidate-runtime-receipt-invalid');
  return entry;
}
function validateRuntimePin(pin, repoRoot) {
  if (!same(runtimeIdentity(pin), CONSUMER_PIN)) reviewedCandidateRuntime(pin, repoRoot);
}
export function mappingKindsOf(pin, { repoRoot } = {}) {
  return same(runtimeIdentity(pin), CONSUMER_PIN) ? MAPPING_KINDS : reviewedCandidateRuntime(pin, repoRoot).mappingKinds;
}
export function evidencePlanActivation(pin, { repoRoot } = {}) {
  return same(runtimeIdentity(pin), CONSUMER_PIN) ? null : reviewedCandidateRuntime(pin, repoRoot).planActivation ?? null;
}

export function validateEvidencePins(snapshotPin, consumerPin) {
  if (!same(snapshotPin, SNAPSHOT_PIN)) refuse('snapshot-pin-mismatch');
  if (!same(consumerPin, CONSUMER_PIN)) refuse('consumer-pin-mismatch');
  return { snapshotPin: structuredClone(snapshotPin), consumerPin: structuredClone(consumerPin) };
}

export function validateProposedSnapshotPin(pin) {
  if (!closed(pin, ['schema', 'contract', 'release', 'snapshot']) || pin.schema !== SNAPSHOT_PIN.schema ||
      !same(pin.contract, SNAPSHOT_PIN.contract) || !closed(pin.snapshot, Object.keys(SNAPSHOT_PIN.snapshot)) ||
      !closed(pin.release, Object.keys(SNAPSHOT_PIN.release)) || !closed(pin.release.archive, Object.keys(SNAPSHOT_PIN.release.archive)) ||
      pin.release.repository !== SNAPSHOT_PIN.release.repository || !/^[a-f0-9]{40}$/.test(pin.release.commit ?? '') ||
      !/^public-pii-phi\/\d{4}-\d{2}-\d{2}\/[a-f0-9]{12}$/.test(pin.snapshot.id ?? '') ||
      !Object.entries(pin.snapshot).filter(([key]) => key !== 'id').every(([, value]) => hex(value)) ||
      pin.snapshot.id.split('/').at(-1) !== pin.snapshot.contentDigest.slice(0, 12) ||
      pin.release.tag !== `snapshot-${pin.snapshot.id.replaceAll('/', '-')}` ||
      pin.release.archive.name !== `pii-evidence-${pin.snapshot.id.replaceAll('/', '-')}.tar.gz` ||
      !hex(pin.release.archive.tarGzSha256) || !hex(pin.release.archive.tarSha256)) refuse('proposed-snapshot-pin-invalid');
  return structuredClone(pin);
}

export function validateProposedConsumerPin(pin, snapshotPin, { repoRoot } = {}) {
  validateProposedSnapshotPin(snapshotPin);
  if (!closed(pin, Object.keys(CONSUMER_PIN)) ||
      !closed(pin.importedPopulation, Object.keys(CONSUMER_PIN.importedPopulation)) ||
      pin.importedPopulation.id !== `pii-evidence-${snapshotPin.snapshot.id.replaceAll('/', '-')}` ||
      pin.importedPopulation.version !== pin.contract?.mapping?.revision || !hex(pin.importedPopulation.digest) || !hex(pin.importedPopulation.bindingDigest))
    refuse('proposed-consumer-pin-invalid');
  try { validateRuntimePin(pin, repoRoot); } catch { refuse('proposed-consumer-pin-invalid'); }
  return structuredClone(pin);
}

export function validateSourceBuiltConsumerReceipt(receipt, pin = CONSUMER_PIN) {
  validateRuntimePin(pin);
  if (!closed(receipt, ['schema', 'sourceCommit', 'sourceArchiveSha256', 'cargoLockSha256', 'rustToolchainFileSha256', 'rustc', 'command', 'platform', 'binarySha256']) ||
      receipt.schema !== 'pii-evidence-consumer-build-receipt/1' || receipt.platform !== 'linux-x64' ||
      receipt.sourceCommit !== pin.source.commit || receipt.sourceArchiveSha256 !== pin.source.sourceArchiveSha256 ||
      receipt.cargoLockSha256 !== pin.source.cargoLockSha256 || receipt.rustToolchainFileSha256 !== pin.source.rustToolchainFileSha256 ||
      receipt.rustc !== pin.evidenceConsumer.canonicalLinux.rustc || receipt.command !== pin.evidenceConsumer.canonicalLinux.command ||
      !hex(receipt.binarySha256)) refuse('consumer-build-receipt-invalid');
  return structuredClone(receipt);
}

export function verifyConsumerRuntime({ sourceCommit, cargoLock, fetchHelper, binary, platform, buildReceipt }, pin) {
  validateRuntimePin(pin);
  if (sourceCommit !== pin.source.commit || sha256(cargoLock) !== pin.source.cargoLockSha256 ||
      sha256(fetchHelper) !== pin.source.fetchHelperSha256) refuse('consumer-source-mismatch');
  if (platform === 'linux-x64') {
    validateSourceBuiltConsumerReceipt(buildReceipt, pin);
    if (sha256(binary) !== buildReceipt.binarySha256) refuse('consumer-binary-not-pinned');
    return;
  }
  // A Darwin verification never supplies the missing canonical Linux importer pin.
  if (platform !== pin.evidenceConsumer.localVerification.platform ||
      sha256(binary) !== pin.evidenceConsumer.localVerification.binarySha256) refuse('consumer-binary-not-pinned');
}

export function verifyImportDigests(outputs, population, corpusSchema = '1.4') {
  const snapshot = parseStrictJson(outputs['snapshot.json'].toString('utf8'));
  const binding = parseStrictJson(outputs['binding.json'].toString('utf8'));
  if (!['1.4', '1.5'].includes(corpusSchema) || snapshot.schema !== 'pii-eval.corpus-snapshot' || snapshot.schemaVersion !== corpusSchema ||
      binding.schema !== 'pii-eval-evidence-binding/1' ||
      snapshot.semanticDigest !== population.digest || semanticDigest(snapshot) !== snapshot.semanticDigest ||
      binding.semanticDigest !== population.bindingDigest ||
      semanticDigest({ schema: 'pii-eval.evidence-binding', schemaVersion: '1', semantic: binding.semantic }) !== binding.semanticDigest)
    refuse('import-output-mismatch');
  return { snapshot, binding };
}

export function preflightReport({ policy, snapshotPin, consumerPin, verified, imported, outputs, populationPins, proposed = false }) {
  validatePiiPopulationPolicy(policy);
  if (proposed) validateProposedConsumerPin(consumerPin, snapshotPin);
  else validateEvidencePins(snapshotPin, consumerPin);
  if (sha256(populationPins) !== consumerPin.preservedPopulationPinsSha256) refuse('existing-population-pins-changed');
  const sem = verified?.semantic, mapped = imported?.semantic;
  if (verified?.schema !== 'pii-eval-evidence-summary/1' || verified.command !== 'verify' || verified.state !== 'accepted' ||
      verified.exit?.code !== 0 || verified.engine?.version !== '0.0.0' ||
      sem?.population !== 'public' || sem.snapshotId !== snapshotPin.snapshot.id ||
      sem.contentDigest !== snapshotPin.snapshot.contentDigest || sem.manifestSha256 !== snapshotPin.snapshot.manifestSha256 ||
      !same(sem.contract, { name: snapshotPin.contract.name, version: snapshotPin.contract.version }) ||
      !closed(sem.counts, ['cases', 'fixtures', 'skipped']) || !Object.values(sem.counts).every(integer) ||
      (!proposed && !same(sem.counts, { cases: 49, fixtures: 139, skipped: 8 }))) refuse('verification-mismatch');
  if (imported?.schema !== 'pii-eval-evidence-summary/1' || imported.command !== 'import' || imported.state !== 'accepted' ||
      imported.exit?.code !== 0 || imported.engine?.version !== '0.0.0' ||
      mapped?.snapshotId !== sem.snapshotId || mapped.contentDigest !== sem.contentDigest || mapped.manifestSha256 !== sem.manifestSha256 ||
      !same(mapped.contract, sem.contract) || !same(mapped.counts, sem.counts) ||
      !same(mapped.population, { id: consumerPin.importedPopulation.id, version: consumerPin.importedPopulation.version, visibility: 'public-synthetic',
        schemaVersion: consumerPin.contract.corpusSchema, semanticDigest: consumerPin.importedPopulation.digest }) ||
      mapped.binding?.semanticDigest !== consumerPin.importedPopulation.bindingDigest ||
      (!proposed && (!same(mapped.binding.counts, COUNTS) || !same(mapped.binding.losses, LOSSES) ||
      !same(imported.outputs, IMPORT_OUTPUTS)))) refuse('import-mismatch');
  const losses = importLosses(mapped.binding.losses, consumerPin.contract.mapping.revision);
  validateMappingAccounting(mapped.binding.counts, losses);
  if (mapped.binding.counts.evidenceCases !== sem.counts.cases || mapped.binding.counts.evidenceFixtures !== sem.counts.fixtures ||
      mapped.binding.counts.evidenceSkipped !== sem.counts.skipped || !closed(imported.outputs, Object.keys(IMPORT_OUTPUTS))) refuse('import-mismatch');
  for (const [name, expected] of Object.entries(imported.outputs)) {
    if (!closed(expected, ['bytes', 'sha256']) || !integer(expected.bytes) || !hex(expected.sha256)) refuse('import-output-mismatch');
    if (!outputs[name] || outputs[name].length !== expected.bytes || sha256(outputs[name]) !== expected.sha256) refuse('import-output-mismatch');
  }
  const { snapshot, binding } = verifyImportDigests(outputs, consumerPin.importedPopulation, consumerPin.contract.corpusSchema);
  if (!same(binding.semantic?.mappingRule, consumerPin.contract.mapping) || !same(binding.semantic?.counts, mapped.binding.counts) ||
      !same(binding.semantic?.losses, mapped.binding.losses) ||
      snapshot.semantic?.cases?.length !== mapped.binding.counts.corpusCases ||
      snapshot.semantic.cases.reduce((sum, row) => sum + row.variants.length, 0) !== mapped.binding.counts.corpusVariants ||
      binding.semantic.rows?.length !== mapped.binding.counts.occurrences) refuse('import-output-mismatch');
  const families = Object.keys(binding.semantic.byFamily ?? {});
  const mappingKinds = mappingKindsOf(consumerPin);
  if (families.some(family => !Object.values(mappingKinds).flatMap(familiesOf).includes(family))) refuse('mapping-kind-unknown');
  const mappedKinds = Object.keys(mappingKinds).filter(kind => familiesOf(mappingKinds[kind]).some(family => families.includes(family))).sort();
  return expectedPreflightReport(policy, { snapshotPin, consumerPin, counts: mapped.binding.counts,
    losses, outputs: imported.outputs, mappedKinds, mappedFamilies: binding.semantic.byFamily });
}

function importLosses(losses, revision) {
  if (revision !== 3) return losses;
  // Revision 3 omits zero classes in the binding. Preserve its original bytes;
  // the benchmark report still names all five axes, including verified zeros.
  if (!losses || typeof losses !== 'object' || Array.isArray(losses) ||
      Object.keys(losses).some(key => !Object.hasOwn(LOSSES, key))) refuse('mapping-accounting-invalid');
  return Object.fromEntries(Object.keys(LOSSES).map(key => [key, Object.hasOwn(losses, key) ? losses[key] : 0]));
}

function validateMappingAccounting(counts, losses) {
  if (!closed(counts, Object.keys(COUNTS)) || !Object.values(counts).every(integer) ||
      counts.evidenceCasesCarried + counts.evidenceCasesWithoutFixtures !== counts.evidenceCases ||
      counts.evidenceFixtures !== counts.corpusVariants || counts.corpusVariants !== counts.occurrences ||
      counts.locatedOccurrences + counts.rangeLessOccurrences !== counts.occurrences ||
      counts.corpusCases > counts.corpusVariants ||
      !closed(losses, Object.keys(LOSSES)) || !Object.values(losses).every(value => integer(value) && value <= counts.occurrences))
    refuse('mapping-accounting-invalid');
}

export function expectedPreflightReport(policy, { snapshotPin = SNAPSHOT_PIN, consumerPin = CONSUMER_PIN,
  counts = COUNTS, losses = LOSSES, outputs = IMPORT_OUTPUTS, mappedKinds = MAPPED_KINDS, mappedFamilies = MAPPED_FAMILIES, repoRoot } = {}) {
  validatePiiPopulationPolicy(policy);
  validateProposedConsumerPin(consumerPin, snapshotPin, { repoRoot });
  validateMappingAccounting(counts, losses);
  const mappingKinds = mappingKindsOf(consumerPin, { repoRoot });
  if (!Array.isArray(mappedKinds) || !same(mappedKinds, [...new Set(mappedKinds)].sort()) ||
      mappedKinds.some(kind => !Object.hasOwn(mappingKinds, kind))) refuse('mapping-kind-unknown');
  const familyKeys = Object.keys(mappedFamilies);
  if (familyKeys.some(family => !mappedKinds.some(kind => familiesOf(mappingKinds[kind]).includes(family))) ||
      mappedKinds.some(kind => !familiesOf(mappingKinds[kind]).some(family => familyKeys.includes(family))) ||
      Object.values(mappedFamilies).some(row => !closed(row, ['cases', 'variants']) || !integer(row.cases) || !integer(row.variants)) ||
      Object.values(mappedFamilies).reduce((sum, row) => sum + row.cases, 0) !== counts.corpusCases ||
      Object.values(mappedFamilies).reduce((sum, row) => sum + row.variants, 0) !== counts.corpusVariants) refuse('mapping-accounting-invalid');
  return {
    schema: 'pii-evidence-preflight/1', state: 'compatible-candidate', runnable: false,
    supportClaims: false, authorityChanged: false, activePinsChanged: false,
    evidence: structuredClone(snapshotPin), consumer: structuredClone(consumerPin),
    population: structuredClone(consumerPin.importedPopulation), counts: structuredClone(counts), losses: structuredClone(losses),
    outputs: structuredClone(outputs), mappedKinds: [...mappedKinds], mappedFamilies: structuredClone(mappedFamilies),
    excludedKinds: Object.keys(mappingKinds).filter(kind => !mappedKinds.includes(kind)).sort(),
    excludedKindsMeaning: 'known mapping kinds absent from imported binding; not scanner support',
    verification: { platform: 'darwin-arm64', canonical: false, scannersLaunched: 0, commands: ['verify', 'import'] },
    adoption: { state: 'proposed', active: false, lostAxisClaims: 'pending-until-faithfully-represented',
      upstreamIssue: policy.mapping.upstreamIssue, unknownKindOrJurisdiction: 'refuse-not-guess' },
    blockers: ['canonical-linux-evidence-consumer-build-receipt-pending', 'fresh-exact-execution-cost-decision-required',
      ...(consumerPin.contract.mapping.revision === 3 ? ['immutable-snapshot-release-verification-required',
        'schema-1.5-measurement-path-review-required', 'explicit-maintainer-adoption-acceptance-required'] : [])],
  };
}

export function validatePreflightReport(report, policy, { snapshotPin = SNAPSHOT_PIN, consumerPin = CONSUMER_PIN, repoRoot } = {}) {
  const options = { snapshotPin, consumerPin, repoRoot };
  if (!same(snapshotPin, SNAPSHOT_PIN)) {
    options.counts = report.counts; options.losses = report.losses; options.outputs = report.outputs;
    options.mappedKinds = report.mappedKinds; options.mappedFamilies = report.mappedFamilies;
    if (!closed(report.outputs, Object.keys(IMPORT_OUTPUTS)) || Object.values(report.outputs).some(output =>
      !closed(output, ['bytes', 'sha256']) || !integer(output.bytes) || !hex(output.sha256))) refuse('preflight-report-mismatch');
  }
  if (!same(report, expectedPreflightReport(policy, options))) refuse('preflight-report-mismatch');
  return structuredClone(report);
}
