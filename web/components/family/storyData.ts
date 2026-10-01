/**
 * Synthetic data for the family blocks' stories. The names, prefixes and counts are made up for the stories;
 * no real credential, no value from a fixture.
 */
import type { FamilyBenchmarkData, FamilyNoteItem, FamilyRulesData, FamilySourcesData } from './types';

export const notes: FamilyNoteItem[] = [
  { term: 'Shape', parts: ['prefix ', { code: 'acme_pat_' }, ', then 22 alphanumeric characters, ', { code: '_' }, ', and 59 alphanumeric characters. No checksum is claimed.'] },
  {
    term: 'Basis',
    parts: [
      'The prefix is in the provider\'s ', { href: 'https://docs.example.com/auth#token-formats', text: 'token formats' },
      ' table; the 22 + 59 split is a community regex that a staff member endorsed. The provider documents no length, alphabet or segment split.',
    ],
  },
  { term: 'Issuance', parts: ['Settings, Developer settings, Tokens. Not attempted: a leaked token is revoked by its owner.'] },
];

export const openQuestions: FamilyNoteItem[] = [
  { term: 'Blocked by', parts: ['A provider statement of the body grammar, or one issued token to read.'] },
  { term: 'Open caveat', parts: ['Only the prefix is provider-documented in prose; the rest rests on tool rules and one community thread.'] },
];

export const lookAlikes: FamilyNoteItem[] = [
  { term: 'Collisions', parts: ['The classic ', { code: 'acme_' }, ' token and the app token are separate families, not near-twins. Snake_case identifiers that contain ', { code: 'acme_pat_' }, ' trip open-ended rules.'] },
];

export const longNotes: FamilyNoteItem[] = [
  {
    term: 'Shape',
    parts: [{ code: 'acme_pat_acme_pat_acme_pat_acme_pat_acme_pat_acme_pat_acme_pat_acme_pat_acme_pat_acme_pat_acme_pat_' }, ' repeated in a note that goes on and on without a break, so the block has to wrap it inside its column rather than push the page sideways. '.repeat(3)],
  },
  ...notes.slice(1),
];

export const benchmark: FamilyBenchmarkData = {
  mode: 'published · redact-secret 0.1.0-beta.11',
  facts: [{ term: 'Fixtures', value: '25' }, { term: 'Left readable', value: '1' }, { term: 'Redacted too much', value: '0' }, { term: 'False alarms', value: '2' }],
  kinds: '25 fixtures: 11 expect a redaction, 14 must stay quiet.',
  levels: [
    { id: 'T1', label: 'T1', detail: 'Provider-documented', fixtures: '4', leftReadable: '0', tooMuch: '0', falseAlarms: '0' },
    { id: 'T2', label: 'T2', detail: 'Tool-corroborated', fixtures: '17', leftReadable: '1', tooMuch: '0', falseAlarms: '2' },
    { id: 'T3', label: 'T3', detail: 'Project policy', fixtures: '4', leftReadable: '0', tooMuch: '0', falseAlarms: '0' },
  ],
  scanners: [
    { id: 'redact-secret', label: 'redact-secret', kind: 'Product measured here', detail: '0.1.0-beta.11 · Published package', rules: '1 detector mapped', fixtures: '25', leftReadable: '1', tooMuch: '0', falseAlarms: '2' },
    { id: 'gitleaks', label: 'gitleaks', kind: 'Repository scanner', detail: '8.30.1 · Directory scan', rules: '1 rule targets it', fixtures: '25', leftReadable: '3', tooMuch: '0', falseAlarms: '0' },
    { id: 'trufflehog', label: 'trufflehog', kind: 'Repository scanner', detail: '3.97.4 · Verification off', rules: '1 rule targets it', fixtures: '25', leftReadable: '4', tooMuch: '0', falseAlarms: '1' },
    { id: 'flare-redact', label: 'flare-redact', kind: 'Runtime library', detail: '1.6.1 · Secrets only', rules: 'No rule maps to it', fixtures: '25', leftReadable: '11', tooMuch: '0', falseAlarms: '0' },
    { id: 'openredaction', label: 'openredaction', kind: 'Runtime library', detail: 'core 1.1.5 · Defaults', rules: 'No rule maps to it', fixtures: '25', leftReadable: '—', tooMuch: '—', falseAlarms: '—', notMeasured: '25' },
  ],
  rowsHref: '#family-rows',
};

/** A single evidence level: the per-level table is left out and the sentence names the level. */
export const benchmarkOneLevel: FamilyBenchmarkData = {
  ...benchmark,
  facts: [{ term: 'Fixtures', value: '6' }, { term: 'Left readable', value: '0' }, { term: 'Redacted too much', value: '0' }, { term: 'False alarms', value: '0' }],
  kinds: '6 fixtures: 4 expect a redaction, 2 must stay quiet. All at the T1 level, provider-documented.',
  levels: [benchmark.levels[0]],
  scanners: benchmark.scanners.slice(0, 3),
};

export const benchmarkNoFixtures: FamilyBenchmarkData = { mode: 'published · redact-secret 0.1.0-beta.11', facts: [], kinds: '', levels: [], scanners: [] };

export const benchmarkNoRun: FamilyBenchmarkData = {
  mode: null,
  facts: [{ term: 'Fixtures', value: '25' }, { term: 'Left readable', value: '—' }, { term: 'Redacted too much', value: '—' }, { term: 'False alarms', value: '—' }, { term: 'Not measured', value: '25' }],
  kinds: benchmark.kinds,
  levels: benchmark.levels.map(l => ({ ...l, leftReadable: '—', tooMuch: '—', falseAlarms: '—', notMeasured: l.fixtures })),
  scanners: [],
  runNote: 'No benchmark run is published, so every count is not measured.',
  rowsHref: '#family-rows',
};

export const benchmarkCandidate: FamilyBenchmarkData = { ...benchmark, mode: 'candidate · redact-secret main 1a2b3c4 · unreleased' };

export const rules: FamilyRulesData = {
  rules: [
    { scanner: 'gitleaks · rules 8.30.1', rule: 'acme-fine-grained-pat', basis: 'acme_pat_ + 82 characters' },
    { scanner: 'trufflehog · rules 3.97.4', rule: 'acme/v2', basis: 'acme_, acmo_ or acme_pat_ + 36-255 characters' },
    { scanner: 'flare-redact · rules 1.6.1', rule: 'acme_token', basis: 'acme_ + 36 or acme_pat_ + 82 characters' },
  ],
  withoutRules: ['openredaction'],
  reviewed: 'Mapped by hand (reviewed 2026-09-30) from each scanner\'s pinned rule file, never from what a scanner found on the fixtures.',
};

export const rulesNone: FamilyRulesData = { rules: [], withoutRules: [], reviewed: rules.reviewed };

export const sources: FamilySourcesData = {
  sources: [
    { href: 'https://docs.example.com/auth#token-formats', label: 'docs.example.com', detail: '/auth#token-formats' },
    { href: 'https://github.com/example/docs/blob/0123456789abcdef0123456789abcdef01234567/src/credentials.json#L29', label: 'github.com', detail: '/example/docs/blob/0123456789abcdef0123456789abcdef01234567/src/credentials.json#L29' },
    { href: 'https://community.example.com/discussions/36441#discussioncomment-3951965', label: 'community.example.com', detail: '/discussions/36441#discussioncomment-3951965' },
  ],
  log: [
    { href: 'https://github.com/redact-secret/redact-secret-benchmarks/issues/223', label: 'redact-secret/redact-secret-benchmarks#223', detail: 'Research issue' },
    { href: 'https://github.com/redact-secret/redact-secret/issues/726', label: 'redact-secret/redact-secret#726', detail: 'Research issue' },
    { href: 'https://github.com/redact-secret/redact-secret/blob/0123456789abcdef0123456789abcdef01234567/docs/audits/evidence/1013/example.md', label: 'Final evidence, pinned to a commit', detail: '/redact-secret/redact-secret/blob/0123456789abcdef0123456789abcdef01234567/docs/audits/evidence/1013/example.md' },
  ],
  researched: 'Researched 2026-09-29.',
};

export const sourcesEmpty: FamilySourcesData = { sources: [], log: [] };

export const manySources: FamilySourcesData = {
  ...sources,
  sources: [...sources.sources, ...Array.from({ length: 11 }, (_, i) => ({
    href: `https://example.com/very/long/path/segments/that/keep/going/${'segment-'.repeat(8)}${i}`, label: 'example.com', detail: `/very/long/path/segments/that/keep/going/${'segment-'.repeat(8)}${i}`,
  }))],
};
