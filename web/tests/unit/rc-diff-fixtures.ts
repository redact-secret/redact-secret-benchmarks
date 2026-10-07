/**
 * Synthetic candidate diffs for the `new` authority's release-candidate page (#658): the shape `qualification:candidate-diff` writes, made of invented ids,
 * hashes, versions and counts, and a synthetic registry that pins an invented release. No test reads a candidate from the ledger, a replay or a real run, and none
 * asserts a value from them: the diff a test reads is the one it wrote.
 */
import { CANDIDATE_COMMIT } from './rc-fixtures';

/** Where the publication writes the projection; the service reads it from the root of the repository. */
export const DIFF_FILE = 'results-output/candidate-diff-from-artifacts.json';
const digest = (c: string) => `sha256:${c.repeat(64)}`;

/** The pinned release of the synthetic registry, and the candidate build after it. */
export const PINNED_RELEASE = '9.9.9-beta.3';
export const DIFF_CANDIDATE_VERSION = '9.9.9-beta.4';
const RUN_KEYS = ['public-evidence-snapshot', 'public-evidence-snapshot+methods', 'regression-corpus', 'policy-corpus'] as const;
type RunKey = (typeof RUN_KEYS)[number];
/** One canonical run per key, as the registry records them; a diff is current when its control carries these digests. */
const CONTROL_DIGEST: Record<RunKey, string> = { 'public-evidence-snapshot': digest('1'), 'public-evidence-snapshot+methods': digest('2'), 'regression-corpus': digest('3'), 'policy-corpus': digest('4') };

/** A registry that pins the synthetic release and holds one canonical run per key. Only `scanners` and `runs` are read. */
export const syntheticRegistry = {
  'benchmarks/official-runs.json': JSON.stringify({
    scanners: [{ id: 'redact-secret', version: PINNED_RELEASE }],
    runs: RUN_KEYS.map(key => ({ id: `${key}@linux-x64`, canonical: true, platform: 'linux-x64', artifact: { semanticDigest: CONTROL_DIGEST[key] } })),
  }),
};

export interface DiffPopulation { population: string; cases: number; fixed: number; regressed: number; changed: number; unchanged: number; stillFailing: number }
export const DIFF_POPULATIONS: DiffPopulation[] = [
  { population: 'public-evidence-snapshot', cases: 10, fixed: 2, regressed: 1, changed: 3, unchanged: 4, stillFailing: 5 },
  { population: 'regression-corpus', cases: 6, fixed: 0, regressed: 0, changed: 0, unchanged: 6, stillFailing: 0 },
  { population: 'policy-corpus', cases: 4, fixed: 1, regressed: 0, changed: 0, unchanged: 3, stillFailing: 1 },
];

export interface DiffOptions {
  populations?: DiffPopulation[];
  controlVersion?: string;
  candidateVersion?: string;
  controlDigests?: Partial<Record<RunKey, string>>;
  publication?: string;
}

/** A candidate diff, one differing row per differing count. */
export function candidateDiff(options: DiffOptions = {}): Record<string, unknown> {
  const populations = (options.populations ?? DIFF_POPULATIONS).map(p => {
    const differing = [
      ...Array.from({ length: p.fixed }, (_, i) => ({ case_id: `case-fixed-${i}`, direction: 'fixed' })),
      ...Array.from({ length: p.regressed }, (_, i) => ({ case_id: `case-regressed-${i}`, direction: 'regressed' })),
      ...Array.from({ length: p.changed }, (_, i) => ({ case_id: `case-changed-${i}`, direction: 'changed' })),
    ].map(d => ({ ...d, family: null, kind: 'must-redact', tier: 'T1', baseline: 'MISS', candidate: 'EXACT' }));
    const key = p.population as RunKey;
    const baseline = options.controlDigests?.[key] ?? CONTROL_DIGEST[key] ?? digest('9');
    return { ...p, semanticDigest: { baseline, candidate: digest('7') }, families: [{ family: 'synthetic-family', cases: p.cases, passBaseline: 1, passCandidate: 1 }], differing };
  });
  return {
    schema: 'redact-secret/candidate-diff-from-artifacts/v1',
    publication: options.publication ?? 'internal',
    runClass: 'exploratory',
    candidate: { id: 'synthetic-candidate', commit: CANDIDATE_COMMIT, version: options.candidateVersion ?? DIFF_CANDIDATE_VERSION, tarballs: [{ name: '@synthetic/core', sha256: 'b'.repeat(64) }] },
    baseline: { archive: { release: 'official-runs-1', sha256: digest('a') }, productVersion: options.controlVersion ?? PINNED_RELEASE },
    methods: { baselineSemanticDigest: options.controlDigests?.['public-evidence-snapshot+methods'] ?? CONTROL_DIGEST['public-evidence-snapshot+methods'], candidateSemanticDigest: digest('8'), note: 'synthetic' },
    worsened: populations.some(p => p.regressed > 0),
    populations,
  };
}
