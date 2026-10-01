/**
 * Synthetic release-candidate evidence for the tests: valid against schemas/candidate-report-v1.json, made of
 * invented hashes, fixture ids and outcomes. No test asserts a value from the committed ledger or a real run;
 * the evidence a test reads is the one it wrote.
 */
export const CANDIDATE_COMMIT = 'c'.repeat(40);
export const RELEASE_COMMIT = 'd'.repeat(40);
export const RELEASE_VERSION = '9.9.9-synthetic';

export interface Row { fixtureId: string; section?: 'fixed-corpus' | 'expanded-corpus'; kind: 'must-redact' | 'must-not-flag' | 'policy'; tier: 'T0' | 'T1' | 'T2' | 'T3'; before: string | null; after: string | null; baselineVersion?: string }

/** One row per kind of move, so a test can count them without reading any ledger. */
export const ROWS: Row[] = [
  { fixtureId: 'suite-a--regress-miss', kind: 'must-redact', tier: 'T1', before: 'EXACT', after: 'MISS' },
  { fixtureId: 'suite-a--regress-alarm', kind: 'must-not-flag', tier: 'T2', before: 'clean', after: 'flagged:1' },
  { fixtureId: 'suite-a--improve', kind: 'must-redact', tier: 'T1', before: 'PARTIAL', after: 'EXACT' },
  { fixtureId: 'suite-a--shape-only', kind: 'must-redact', tier: 'T2', before: 'EXACT', after: 'COVERED' },
  { fixtureId: 'suite-b--policy-moved', kind: 'policy', tier: 'T3', before: 'EXACT', after: 'MISS' },
  { fixtureId: 'suite-b--pending', kind: 'must-not-flag', tier: 'T0', before: 'observed:0', after: 'observed:1' },
  { fixtureId: 'suite-b--same-1', kind: 'must-redact', tier: 'T1', before: 'EXACT', after: 'EXACT' },
  { fixtureId: 'suite-b--same-2', kind: 'must-not-flag', tier: 'T2', before: 'clean', after: 'clean' },
  { fixtureId: 'suite-b--added', section: 'expanded-corpus', kind: 'must-redact', tier: 'T1', before: null, after: 'EXACT' },
];

export interface EvidenceOptions {
  rows?: Row[];
  status?: 'complete' | 'incomplete' | 'failed';
  filter?: string | null;
  sourceState?: 'clean' | 'dirty';
  failures?: { phase: string; code: string }[];
  baselineVersion?: string;
}

export function candidateEvidence(options: EvidenceOptions = {}): Record<string, unknown> {
  const rows = options.rows ?? ROWS;
  const hash = 'a'.repeat(64);
  return {
    schemaVersion: 1,
    reportType: 'candidate',
    runId: '12345678-1234-1234-1234-123456789abc',
    startedAt: '2030-01-02T03:04:05.000Z',
    finishedAt: '2030-01-02T03:14:05.000Z',
    status: options.status ?? 'complete',
    supportClaims: false,
    candidate: {
      sourceCommit: CANDIDATE_COMMIT, sourceState: options.sourceState ?? 'clean', packageName: '@synthetic/core', declaredVersion: '9.9.10-synthetic',
      artifactSha256: hash, expectedArtifactSha256: null,
      artifacts: [{ role: 'package', sha256: hash }, { role: 'node', sha256: hash }, { role: 'wasm', sha256: hash }],
    },
    benchmark: { sourceCommit: 'e'.repeat(40), dirty: false, lockfileSha256: hash },
    corpus: { protocol: 'measurement-v4', hash, categories: [] },
    scanner: { id: 'redact-secret-candidate', configuration: {}, configurationHash: hash },
    runtime: { node: 'v22.0.0', os: 'linux', arch: 'x64' },
    command: ['node', 'candidate.ts'],
    selection: { scope: options.filter ? 'filtered-development' : 'full-suite', filter: options.filter ?? null },
    completeness: { selectedFixtures: rows.length, scannedFixtures: rows.length, writtenFixtures: rows.length },
    failures: options.failures ?? [],
    results: rows.map(r => ({
      fixtureId: r.fixtureId, corpusSection: r.section ?? 'fixed-corpus', kind: r.kind, tier: r.tier, expectedSpans: 1, actualFindings: 1,
      outcome: r.after, baseline: { version: r.baselineVersion ?? options.baselineVersion ?? RELEASE_VERSION, outcome: r.before },
    })),
  };
}

/** A pin manifest and a saved baseline for the synthetic release, so the last release is one the test wrote. */
export const syntheticRelease = {
  'benchmarks/pin-manifest.json': JSON.stringify({ pins: { redactSecretVersion: RELEASE_VERSION, releaseSourceRevision: RELEASE_COMMIT } }),
  [`baselines/${RELEASE_VERSION}.json`]: JSON.stringify({ version: RELEASE_VERSION, runId: '2030-01-01T00:00:00.000Z-abcdef', savedAt: '2030-01-01T00:00:10.000Z', revision: 'f'.repeat(40) }),
};
