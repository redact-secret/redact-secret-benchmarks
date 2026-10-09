import { createHash } from 'node:crypto';
import { candidateConfiguration } from '../../scanners/candidate.mjs';
import { piiBindingArtifactCommitment } from '../../benchmarks/evaluation/domains/pii/product-binding.ts';

// Authored contract inputs only. These invented identities are never repository-sanctioned measurement receipts.
export function syntheticPiiProduct(family = 'pii:global:network-address', { conformance = false } = {}) {
  const sourceCommit = 'a'.repeat(40), artifactCommitment = 'b'.repeat(64);
  const candidateEvidence = {
    schemaVersion: 1, reportType: 'candidate', runId: '00000000-0000-4000-8000-000000000001',
    startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:00:00.000Z', status: 'complete', supportClaims: false,
    candidate: { sourceCommit, sourceState: 'clean', packageName: '@redact-secret/core', declaredVersion: '0.0.0-synthetic-contract',
      artifactSha256: artifactCommitment, expectedArtifactSha256: artifactCommitment,
      artifacts: ['package', 'node', 'wasm'].map(role => ({ role, sha256: 'c'.repeat(64) })) },
    benchmark: { sourceCommit: 'd'.repeat(40), dirty: false, lockfileSha256: 'e'.repeat(64) },
    corpus: { protocol: 'measurement-v4', hash: 'f'.repeat(64), categories: [{ id: 'common-formats', sha256: '0'.repeat(64) }] },
    scanner: { id: 'redact-secret-candidate', configuration: candidateConfiguration, configurationHash: '1'.repeat(64) },
    runtime: { node: process.version, os: process.platform, arch: process.arch }, command: ['node', 'synthetic-contract-test'],
    selection: { scope: 'full-suite', filter: null }, completeness: { selectedFixtures: 1, scannedFixtures: 1, writtenFixtures: 1 }, failures: [],
    results: [{ fixtureId: 'common-formats--synthetic-contract-control', corpusSection: 'fixed-corpus', kind: 'must-redact', tier: 'T2',
      expectedSpans: 1, actualFindings: 1, outcome: 'EXACT', baseline: { version: '0.0.0-synthetic', outcome: 'EXACT' } }],
  };
  const product = { repository: 'redact-secret/redact-secret', sourceCommit, artifactCommitment,
    candidateEvidenceCommitment: createHash('sha256').update(JSON.stringify(candidateEvidence)).digest('hex') };
  const identity = selectors => `credentials=full;selectors=${selectors.join(',')};families=${family};vocabulary=pii-context/v1`;
  const requestedSelectors = ['pii:global'];
  const checks = [requestedSelectors, [`pii:family:global:${family.split(':').at(-1)}`]].map(selectors =>
    ({ selectors, activationIdentity: identity(selectors), availableFamilies: [family] }));
  const activationArtifact = { schemaVersion: 1, reportType: 'pii-activation-evidence', supportClaims: false, product,
    profile: { id: 'pii-v1', version: 1 }, requestedSelectors, activationIdentity: identity(requestedSelectors), availableFamilies: [family],
    selectorChecks: checks, surfaces: ['node-addon', 'node-wasm'].map(id => ({ id, status: 'pass', activationChecks: checks })),
    offSurfaces: ['node-addon', 'node-wasm'].map(id => ({ id, status: 'pass' })) };
  activationArtifact.artifactCommitment = piiBindingArtifactCommitment(activationArtifact);
  const gates = [{ id: 'installed-artifact', status: 'met' }, { id: 'identity-only-classification', status: 'unresolved' },
    { id: 'diagnostic-population-not-measured', status: 'unresolved' }, { id: 'protected-partition', status: 'unresolved' }];
  const qualification = { schemaVersion: 1, reportType: 'pii-family-qualification', supportClaims: false, family, product,
    activationArtifactCommitment: activationArtifact.artifactCommitment, planCommitment: '2'.repeat(64), profile: { id: 'pii-v1', version: 1 },
    gates, classAccounting: [{ id: 'synthetic-positive', status: 'measured', observations: 2 }, { id: 'identity-only', status: 'unresolved', observations: 0 }],
    status: 'not-qualified', reasonCodes: gates.filter(row => row.status !== 'met').map(row => row.id).sort() };
  if (conformance) {
    const label = family.split(':').at(-1);
    const text = '📧 mail: a@example.test', address = 'a@example.test', start = text.indexOf(address);
    const row = { id: 'synthetic-astral-offset', publicFinding: true, type: `pii_${label.replaceAll('-', '_')}`, action: 'redact',
      nativeOffsetUnit: 'utf16-code-unit', nativeRange: { start, end: start + address.length },
      canonicalRange: { start: Buffer.byteLength(text.slice(0, start)), end: Buffer.byteLength(text.slice(0, start + address.length)) } };
    qualification.installedArtifactConformance = { canonicalOffsetUnit: 'utf8-byte', lanes: ['node-addon', 'node-wasm'].map(id =>
      ({ id, status: 'pass', nativeOffsetUnit: 'utf16-code-unit', observations: [row] })) };
    qualification.installedArtifactConformance.artifactCommitment = piiBindingArtifactCommitment(qualification.installedArtifactConformance);
    qualification.sourceConformance = { sourceCommit, sourceState: 'clean', lanes: ['cli', 'python', 'rust-native'].map(prefix =>
      ({ id: `${prefix}-${label}-conformance`, status: 'pass', fixture: `conformance/fixtures/pii-${label}-v1.json`,
        fixtureCommitment: '3'.repeat(64), commandDefinitionCommitment: '4'.repeat(64), toolchain: [{ executable: prefix, version: 'synthetic-contract' }] })) };
    qualification.sourceConformance.artifactCommitment = piiBindingArtifactCommitment(qualification.sourceConformance);
    gates.push({ id: 'exact-source-conformance', status: 'met' });
  }
  qualification.artifactCommitment = piiBindingArtifactCommitment(qualification);
  return { candidateEvidence, activationArtifact, qualificationArtifacts: [qualification] };
}
