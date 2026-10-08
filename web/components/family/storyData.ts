/**
 * Synthetic data for the family blocks' stories. The names, prefixes and counts are made up for the stories;
 * no real credential, no value from a fixture.
 */
import type { FamilyBenchmarkData, FamilyNoteItem, FamilyResearchRecordData, FamilyRulesData, FamilySourcesData } from './types';

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

// ---- Research record (#591): synthetic, from a made-up release ----------------------------------------

const PROVENANCE = 'credential-evidence snapshot-2099.01.01 · records at 0123456 · schema 1.8.0';

export const researchRecord: FamilyResearchRecordData = {
  provenance: PROVENANCE,
  facts: [
    { label: 'Review state', value: 'Draft, not reviewed' },
    { label: 'Format revision', value: '2 · current' },
    { label: 'Research', value: 'Researched' },
    { label: 'Researched', value: '2099-01-02' },
  ],
  revisions: [
    { id: 'acme:personal-token@1', label: 'Revision 1', detail: 'historical · draft, not reviewed · superseded by @2 · issued until 2098-12-31', current: false },
    { id: 'acme:personal-token@2', label: 'Revision 2', detail: 'current · draft, not reviewed · supersedes @1 · issued from 2099-01-01 · the family\'s current revision', current: true },
  ],
  blockers: [
    { ref: 'Issuance-gated', text: 'The body length and alphabet are not documented; one issued token would settle them.' },
    { ref: 'Documentation-gated', text: 'Whether the self-hosted product issues the same body is not stated by the pages read.' },
  ],
  rulings: [{ ref: 'review-acme-personal-token#3', at: '2099-01-03', text: 'The maintainer decided that a provider staff answer in the community forum counts as a provider statement for the prefix only.' }],
  review: '4 events in the review history: 1 authored, 2 observed, 1 decided. Latest: decided on 2099-01-03 by maintainer, project maintainer. Project-maintained review is not independent validation.',
  recordHref: 'https://github.com/example/evidence/blob/0123456789abcdef0123456789abcdef01234567/records/families/acme/personal-token.json',
};

/** One revision, nothing blocking, nothing ruled: the bar and the review line only. */
export const researchRecordSimple: FamilyResearchRecordData = {
  ...researchRecord,
  facts: [researchRecord.facts[0], { label: 'Format revision', value: '1 · current' }, ...researchRecord.facts.slice(2)],
  revisions: [], blockers: [], rulings: [],
  review: '1 event in the review history: 1 authored. Latest: authored on 2099-01-02 by author, project maintainer. Project-maintained review is not independent validation.',
};

const NOT_RECORDED = (label: string) => ({ label, value: 'Not recorded', tone: 'not-measured' as const });

/** The release holds no record of the family: every cell dashed, and the reason. */
export const researchRecordAbsent: FamilyResearchRecordData = {
  provenance: PROVENANCE,
  facts: [NOT_RECORDED('Review state'), NOT_RECORDED('Format revision'), NOT_RECORDED('Research'), NOT_RECORDED('Researched')],
  revisions: [], blockers: [], rulings: [],
  absent: { title: 'No research record for this family', text: 'snapshot-2099.01.01 has no family record for acme:new-token, so its review state, format revision and format facts are not recorded here.' },
};
