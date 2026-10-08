import { createHash } from 'node:crypto';
import { consume, loadPins, parseStrictJson, canonicalize } from './pii-eval-artifact-consumer.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const same = (a, b) => canonicalize(a) === canonicalize(b);
const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === allowed.length && allowed.every(k => Object.hasOwn(value, k));
const FAMILY = name => `pii:global:${name}`;
export const LOCAL_PEER_ENGINE_SHA256 = '3bb255edc4775cfd7f92ab937f126c478d8aaa9c2437ea88c59236202e98d4d9';
export const PEER_RELEASE_INTEGRITIES = {
  'flare-redact': 'sha512-13Htu6VPk2ttxcoVOP909pXao6orrIBAMS/qWdhQn3/BS5AxSB5fpyqaPZnRGJhfBAM2M9T+RE662hxEpv6nGQ==',
  openredaction: 'sha512-SpQTBhVV4p3rmge818NH6iJiL/fvwFlDvhGaejoL0wbzY7jRHIhU5vEf3KzNARsIZmpCJV1eHdiavIjQyN1hXQ==',
};
export const PEER_TYPES = {
  'flare-redact': { email: FAMILY('email'), obfuscated_email: FAMILY('email'), credit_card: FAMILY('payment-card') },
  openredaction: { EMAIL: FAMILY('email'), CREDIT_CARD: FAMILY('payment-card'), IBAN: FAMILY('iban'), PHONE_UK_MOBILE: FAMILY('phone'), PHONE_UK: FAMILY('phone'), PHONE_US: FAMILY('phone'), PHONE_INTERNATIONAL: FAMILY('phone'), SSN: 'pii:us:ssn', IPV4: FAMILY('network-address'), IPV6: FAMILY('network-address') },
};
export const PEER_CAPABILITIES = { action: 'unavailable', families: [], familyClassification: 'supported', jurisdictionReporting: 'supported', jurisdictions: [], ranges: 'supported', sensitivityClassification: 'unsupported' };
export const PEER_LIMITATIONS = {
  'flare-redact': ['default-email-obfuscated-email-payment-card', 'default-phone-network-disabled', 'iban-ssn-detectors-absent', 'undeclared-families-retain-authored-denominators'],
  openredaction: ['default-context-analysis-and-false-positive-filter', 'international-phone-scope-compared-with-authored-nanp-truth', 'original-reported-spans-retained', 'undeclared-families-retain-authored-denominators'],
};
export const peerConfiguration = peer => ({ constructor: 'default', ...(peer === 'flare-redact' ? { includeValues: false } : {}), mapping: PEER_TYPES[peer], normalization: 'utf16-exclusive-to-utf8/1' });
export const peerManifestConfiguration = peer => ({ activation: [], parameters: [{ key: 'constructor', value: 'default' }, { key: 'mappingSha256', value: hash(canonicalize(PEER_TYPES[peer])) }, { key: 'normalization', value: 'utf16-exclusive-to-utf8/1' }, ...(peer === 'flare-redact' ? [{ key: 'includeValues', value: false }] : [])].sort((a, b) => a.key.localeCompare(b.key)) });
export const peerConfigDigest = (domain, value) => hash(`pii-eval-semantic-digest/1\n${domain}\n${canonicalize(value)}`);
const unavailable = (state, reason) => ({ state, reason, mode: 'exploratory', publicOnly: true, qualified: false, supportClaims: false });
export function loadPiiPeerComparison({ record, populationPins, populationPlan, pins = [], artifacts = [] } = {}) {
  if (!record) return unavailable('absent', 'local-peer-comparison-not-recorded');
  try {
    if (!keys(record, ['schema', 'mode', 'publicOnly', 'qualified', 'supportClaims', 'engine', 'peers']) || !keys(record.engine, ['commit', 'binarySha256', 'platform']) || record.schema !== 'pii-peer-local-comparison/1' || record.mode !== 'exploratory' || record.publicOnly !== true || record.qualified !== false || record.supportClaims !== false || record.engine?.platform !== 'darwin-arm64' || record.engine.binarySha256 !== LOCAL_PEER_ENGINE_SHA256 || record.engine.commit !== populationPins?.build?.commit || record.peers?.length !== 2 || populationPins.populations.length !== 4 || populationPlan?.populations?.length !== 4 || pins.length !== 2 || artifacts.length !== 8) return unavailable('invalid', 'local-peer-contract-mismatch');
    const outputs = [];
    for (const [peer, version] of [['flare-redact', '1.6.1'], ['openredaction', '1.1.5']]) {
      const rows = record.peers.filter(p => p.peer === peer), pinInputs = pins.filter(p => p.peer === peer), ownArtifacts = artifacts.filter(p => p.peer === peer);
      if (rows.length !== 1 || pinInputs.length !== 1 || ownArtifacts.length !== 4) return unavailable('invalid', 'local-peer-membership-mismatch');
      const row = rows[0], input = pinInputs[0], own = loadPins(input.text);
      if (!keys(row, ['peer', 'version', 'npmIntegrity', 'npmArchiveSha256', 'installedTreeSha256', 'configuration', 'limitations', 'capabilities', 'results', 'pinsSha256'])) return unavailable('invalid', 'local-peer-record-malformed');
      if (row.version !== version || !same(row.configuration, peerConfiguration(peer)) || !same(row.capabilities, PEER_CAPABILITIES) || !same(row.limitations, PEER_LIMITATIONS[peer]) || !same(own.build, { ...populationPins.build, binarySha256: record.engine.binarySha256 }) || row.pinsSha256 !== hash(input.text) || !/^[a-f0-9]{64}$/.test(row.npmArchiveSha256) || row.npmIntegrity !== PEER_RELEASE_INTEGRITIES[peer] || !/^[a-f0-9]{64}$/.test(row.installedTreeSha256) || row.results?.length !== 4) return unavailable('invalid', 'local-peer-provenance-mismatch');
      for (const frozen of populationPins.populations) {
        const bound = own.populations.filter(p => p.label === frozen.label), reported = row.results.filter(p => p.view === frozen.label), files = ownArtifacts.filter(p => p.view === frozen.label);
        if (bound.length !== 1 || reported.length !== 1 || files.length !== 1) return unavailable('invalid', 'local-peer-population-incomplete');
        const pin = bound[0], result = reported[0], doc = parseStrictJson(files[0].text);
        const authored = populationPlan.populations.filter(p => p.view === frozen.label);
        if (authored.length !== 1 || authored[0].snapshotDigest !== frozen.population.populationDigest || authored[0].rosterDigest !== frozen.projection.rosterDigest || result.memberships !== authored[0].memberships || result.unresolved !== authored[0].unresolvedRange) return unavailable('invalid', 'local-peer-authored-accounting-mismatch');
        const config = peerManifestConfiguration(peer), identity = pin.scanners[0];
        if (!keys(result, ['view', 'memberships', 'unresolved', 'snapshotDigest', 'unmappedTypes', 'artifactSha256']) || !Number.isSafeInteger(result.memberships) || !Number.isSafeInteger(result.unresolved) || result.unresolved < 0 || result.unresolved > result.memberships || !result.unmappedTypes || Array.isArray(result.unmappedTypes) || typeof result.unmappedTypes !== 'object' || Object.entries(result.unmappedTypes).some(([label, count]) => !/^[A-Za-z][A-Za-z0-9_:-]{0,79}$/.test(label) || !Number.isSafeInteger(count) || count < 1) || identity?.configurationDigest !== peerConfigDigest('pii-eval.scanner-parameters/1', config.parameters) || identity?.activationDigest !== peerConfigDigest('pii-eval.scanner-activation/1', config.activation) || !same(identity?.adapter, { adapterId: 'benchmarks-pii-peer', adapterVersion: '1.0.0', normalizationVersion: 1 }) || !same(identity?.product, { kind: 'released' }) || doc.semantic?.scanners?.length !== 1 || doc.semantic.scanners.some(s => s.status !== 'complete' || !same(s.replays, { agreed: true, count: 2 }))) return unavailable('invalid', 'local-peer-observation-contract-mismatch');
        if (!same(pin.population, frozen.population) || pin.projection.mode !== 'exploratory' || pin.projection.rosterDigest !== frozen.projection.rosterDigest || !same(pin.projection.requiredViews, frozen.projection.requiredViews) || result.snapshotDigest !== frozen.population.populationDigest || result.artifactSha256 !== hash(files[0].text) || doc.semantic?.scanners?.some(s => !same(s.capabilities, PEER_CAPABILITIES)) || pin.scanners.length !== 1 || pin.scanners[0].scannerId !== peer || pin.scanners[0].scannerVersion !== version || pin.scanners[0].artifactDigest !== row.installedTreeSha256 || pin.scanners[0].product.kind !== 'released') return unavailable('invalid', 'local-peer-artifact-binding-mismatch');
      }
      const measurement = consume(own, ownArtifacts.map(p => ({ name: `${peer}.${p.view}`, text: p.text })));
      if (!measurement.complete) return unavailable('invalid', 'local-peer-artifact-refused');
      for (const result of row.results) {
        const observed = measurement.populations.find(p => p.label === result.view);
        if (observed.productProjection.rows.reduce((n, p) => n + p.counts.authoredCases, 0) !== result.memberships) return unavailable('invalid', 'local-peer-accounting-mismatch');
      }
      outputs.push({ peer, version, limitations: row.limitations, configuration: row.configuration, identity: own.populations[0].scanners[0], measurement });
    }
    return { state: 'recorded', mode: 'exploratory', publicOnly: true, qualified: false, supportClaims: false, scope: 'local-default-family-type-and-range-only', engine: record.engine, withheld: ['sensitivity', 'action', 'context-discrimination', 'independent-diversity-qualification'], peers: outputs };
  } catch { return unavailable('invalid', 'local-peer-record-malformed'); }
}
