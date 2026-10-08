/**
 * Synthetic story data shaped like the ledger/report outputs (see types.ts).
 * Counts echo the mockups' preview run; slugs and ids are invented or public
 * taxonomy ids. No credential values anywhere.
 */
import type {
  AnswerData,
  EvidenceLevelLink,
  FamilyAboutData,
  FamilyRowData,
  FindingData,
  FixtureCounts,
  FixtureRowData,
  HubTileData,
  PeerScannerNotes,
  PeerScannerRow,
  ProviderGroupData,
} from './types';

export const hubTiles: HubTileData[] = [
  { href: '/report/providers', label: 'Providers', figure: '82', figureUnit: 'providers', emphasis: '81', text: 'with fixtures in this corpus. Each opens its families and rows.', action: 'By provider →' },
  { href: '/report/families', label: 'Families', figure: '158', figureUnit: 'families', emphasis: '139', text: 'with fixtures. Rows and outcomes for every family, in one list.', action: 'All families →' },
  { href: '/coverage?show=detectors', label: 'Detectors', figure: '92', figureUnit: 'detectors', emphasis: '92', text: 'exercised by 5,034 fixtures. Sample size and rows per detector.', action: 'By detector →' },
  { href: '#news', label: 'News', figure: '9', figureUnit: 'changes', text: 'Latest on 2026-09-28: findings from this benchmark and where each one stands.', action: 'What changed →' },
];

export const levels: EvidenceLevelLink[] = [
  { label: 'Provider-documented', shortLabel: 'Provider', href: '/report' },
  { label: 'Tool-corroborated', shortLabel: 'Tool', href: '/report?level=T2' },
  { label: 'Project policy', shortLabel: 'Policy', href: '/report?level=T3' },
];

export const answers: AnswerData[] = [
  {
    id: 'miss',
    question: 'Does it miss real secrets?',
    qualifier: 'at most',
    value: '3.6%',
    href: '#rows',
    interval: { ariaLabel: 'Observed 2.4%. Published bound: at most 3.6%. Axis 0% to 5%.', observed: 0.4883, bound: 0.7106, range: [0.4883, 0.7106], axisMin: '0%', axisMax: '5%' },
    observation: { strong: '26 of 1,065', rest: 'secret spans leaked' },
    definition: 'Leaked span rate. Lower is better. 95% pessimistic bound, corpus-relative.',
  },
  {
    id: 'flag',
    question: 'Does it flag safe values?',
    qualifier: 'at most',
    value: '27.8%',
    href: '#rows',
    interval: { ariaLabel: 'Observed 0.0%. Published bound: at most 27.8%. Axis 0% to 50%.', observed: 0, bound: 0.5551, range: [0, 0.5551], axisMin: '0%', axisMax: '50%' },
    observation: { strong: '0 of 10', rest: 'controls flagged' },
    status: { status: 'withheld', label: 'Few samples' },
    definition: 'False alarm rate on provider-documented controls. Lower is better. Few controls keep the bound wide.',
  },
  {
    id: 'twins',
    question: 'Does it tell near-twins apart?',
    qualifier: 'at least',
    value: '95.9%',
    href: '#rows',
    interval: { ariaLabel: 'Observed 97.4%. Published bound: at least 95.9%. Axis 0% to 100%.', observed: 0.9735, bound: 0.9585, range: [0.9585, 0.9735], axisMin: '0%', axisMax: '100%' },
    observation: { strong: '662 of 680', rest: 'pairs discriminated' },
    definition: 'Twin discrimination: the secret is covered and its one-character fake stays quiet. Higher is better.',
  },
];

export const answerMeta = [
  { label: 'Run', value: '2026-09-30' },
  { value: 'Same 5,034 inputs for 4 scanners' },
  { label: 'Accounting', value: 'v1.1' },
  { label: 'Mode', value: 'published' },
];

export const findings: FindingData[] = [
  { id: '949', href: '#finding-949', title: '#949 · generic-token warns on provider-prefixed placeholders', detail: 'Flagged a safe value · 3 fixtures', date: '2026-09-28', status: { status: 'pass', label: 'Verified' } },
  { id: '936', href: '#finding-936', title: '#936 · Policy: keyword co-occurrence spans warn instead of redact', detail: 'Left a secret readable · 8 fixtures', date: '2026-09-28', status: { status: 'withheld', label: 'Policy' } },
  { id: '935', href: '#finding-935', title: '#935 · connection-string misses the password in dialect+driver:// URLs', detail: 'Left a secret readable · 1 fixture', date: '2026-09-28', status: { status: 'pass', label: 'Verified' } },
  { id: '934', href: '#finding-934', title: '#934 · repeated-filler documentation placeholders are redacted', detail: 'Flagged a safe value · 2 fixtures', date: '2026-09-28', status: { status: 'review', label: 'In review' } },
];

export const longFinding: FindingData = {
  id: '999',
  href: '#finding-999',
  title: '#999 · Context-gated legacy keys missed when the provider context is on the previous line (heroku authorizations:info, Schema Registry basic.auth.user.info, twilio profiles:list, a_very_long_unbroken_identifier_that_keeps_going_and_going_without_a_break)',
  detail: 'Left a secret readable · 3 fixtures',
  date: '2026-09-28',
  status: { status: 'fail', label: 'Open' },
};

export const peerRows: PeerScannerRow[] = [
  {
    name: 'Gitleaks', version: '8.30.1', role: 'Repository scanner · Directory scan', blurb: 'Built to find secrets in git history and files before they are committed.',
    targeted: { count: '361', of: '1,068', note: '78 of its 222 rules match a family here' },
    leftReadable: { count: '58', of: '361', unit: 'spans', note: 'redact-secret, same inputs: 0 of 361' },
    elsewhere: { count: '290', of: '704', unit: 'spans', note: 'No rule of its own targets these' },
    safeFlagged: { count: '0', of: '10', note: 'Too few controls to tell apart' },
  },
  {
    name: 'TruffleHog', version: '3.97.4', role: 'Repository scanner · Filesystem scan', blurb: 'Built to find and verify secrets in repositories; verification is off here.',
    targeted: { count: '429', of: '1,068', note: '76 of its 892 rules match a family here' },
    leftReadable: { count: '68', of: '427', unit: 'spans', note: 'redact-secret, same inputs: 0 of 427' },
    elsewhere: { count: '463', of: '638', unit: 'spans', note: 'No rule of its own targets these' },
    safeFlagged: { count: '0', of: '10', note: 'Too few controls to tell apart' },
  },
  {
    name: 'flare-redact', version: '1.6.1', role: 'Runtime library · Published npm package', blurb: 'Built to redact text at runtime. Run secrets-only: its PII and generic-assignment detectors are off.',
    targeted: { count: '277', of: '1,068', note: '30 of its 81 rules match a family here' },
    leftReadable: { count: '36', of: '274', unit: 'spans', note: 'redact-secret, same inputs: 0 of 274' },
    elsewhere: { count: '599', of: '791', unit: 'spans', note: 'No rule of its own targets these' },
    safeFlagged: { count: '0', of: '10', note: 'Too few controls to tell apart' },
  },
];

export const peerRowsMissing: PeerScannerRow[] = [
  ...peerRows,
  { name: 'A-newly-added-scanner-with-a-very-long-name', version: '0.0.1-rc.1', role: 'Runtime library · Not yet run', blurb: 'Added to the matrix; no results recorded yet.', targeted: null, leftReadable: null, elsewhere: null, safeFlagged: null },
];

export const peerNotes: PeerScannerNotes = {
  caveatsTitle: 'Read this before the numbers',
  caveats: [
    { lead: 'Our inputs, our answer key.', text: "The redact-secret team wrote every input and every expected span, using redact-secret's own definition of a secret." },
    { lead: 'redact-secret was tuned on these inputs.', text: '49 of 57 findings from this corpus were fixed in redact-secret. The other scanners were never tuned against it.' },
    { lead: 'Different jobs.', text: "Most inputs fall outside at least one scanner's rules. A readable span there shows where its rules end, not that it failed." },
  ],
  source: 'Results from 2026-09-29, reused because the inputs have not changed since. Listed in run order; a new scanner adds a row. Rules are matched to families from each scanner’s pinned rule file.',
  quoteTitle: 'Quoting these numbers',
  quoteDont: '“redact-secret leaks far fewer secrets than gitleaks.”',
  quoteDo: "“On 361 inputs that match Gitleaks 8.30.1's default rules, in a corpus written and used for tuning by the redact-secret team, Gitleaks left 58 of 361 secret spans readable.”",
  quoteNote: 'Any quote names the input slice, the version, the date, and who wrote the inputs.',
};

const c = (leftReadable: string, tooMuch: string, falseAlarms: string, notMeasured?: string): FixtureCounts => ({ leftReadable, tooMuch, falseAlarms, notMeasured });

export const providers: ProviderGroupData[] = [
  {
    id: 'aws', name: 'Amazon Web Services', familiesLabel: '5 families', fixturesLabel: '31 fixtures', counts: c('2', '0', '1'),
    families: [
      { id: 'aws:iam-user-access-key', name: 'IAM user access key', href: '/report/providers?family=aws:iam-user-access-key', fixturesLabel: '24 fixtures', counts: c('0', '0', '1'), research: 'Draft, not reviewed · format revision 1 · current' },
      { id: 'aws:sts-temporary-access-key', name: 'STS temporary access key', href: '/report/providers?family=aws:sts-temporary-access-key', fixturesLabel: '7 fixtures', counts: c('2', '0', '0', '3'), research: 'Draft, not reviewed · format revision 2 · proposed, none current' },
      { id: 'aws:sts-service-bearer-token', name: 'STS service bearer token', href: '/report/providers?family=aws:sts-service-bearer-token', fixturesLabel: '0 fixtures', counts: null, research: 'Research record not recorded' },
    ],
  },
  {
    id: 'github', name: 'GitHub', familiesLabel: '6 families', fixturesLabel: '58 fixtures', counts: c('0', '0', '0'),
    families: [
      { id: 'github:classic-personal-access-token', name: 'Classic personal access token', href: '/report/providers?family=github:classic-personal-access-token', fixturesLabel: '22 fixtures', counts: c('0', '0', '0') },
      { id: 'github:fine-grained-personal-access-token', name: 'Fine-grained personal access token', href: '/report/providers?family=github:fine-grained-personal-access-token', fixturesLabel: '19 fixtures', counts: c('0', '0', '0') },
    ],
  },
  {
    id: 'vercel', name: 'Vercel', familiesLabel: '7 families', fixturesLabel: '0 fixtures', counts: null,
    families: [
      { id: 'vercel:personal-access-token', name: 'Personal access token', href: '/report/providers?family=vercel:personal-access-token', fixturesLabel: '0 fixtures', counts: null },
      { id: 'vercel:integration-token', name: 'Integration token', href: '/report/providers?family=vercel:integration-token', fixturesLabel: '0 fixtures', counts: null },
    ],
  },
  {
    id: 'not-provider-specific', name: 'Not provider-specific', familiesLabel: '6 families', fixturesLabel: '112 fixtures', counts: c('3', '1', '0'),
    families: [
      { id: 'generic:jwt', name: 'JSON Web Token', href: '/report/providers?family=generic:jwt', fixturesLabel: '38 fixtures', counts: c('1', '0', '0') },
      { id: 'generic:private-key', name: 'PEM-encoded private key', href: '/report/providers?family=generic:private-key', fixturesLabel: '44 fixtures', counts: c('2', '1', '0') },
    ],
  },
];

export const manyProviders: ProviderGroupData[] = Array.from({ length: 40 }, (_, i) => ({
  id: `provider-${i}`,
  name: i === 3 ? 'HashiCorp Terraform Cloud/Enterprise with an especially long provider display name' : `Provider ${i + 1}`,
  familiesLabel: '2 families',
  fixturesLabel: `${i + 4} fixtures`,
  counts: i % 7 === 0 ? null : c(String(i % 3), '0', String(i % 2)),
  families: [
    { id: `provider-${i}:api-token`, name: 'API token', href: `#provider-${i}-api-token`, fixturesLabel: '3 fixtures', counts: c('0', '0', '0') },
    { id: `provider-${i}:oauth-access-token-with-an-unbroken-long-identifier-segment`, name: 'OAuth access token', href: `#provider-${i}-oauth`, fixturesLabel: '1 fixture', counts: null },
  ],
}));

export const families: FamilyRowData[] = [
  { id: 'aws:iam-user-access-key', name: 'IAM user access key', href: '/report/providers?family=aws:iam-user-access-key', provider: 'Amazon Web Services', fixtures: '24', counts: c('0', '0', '1') },
  { id: 'aws:sts-service-bearer-token', name: 'STS service bearer token', href: '/report/providers?family=aws:sts-service-bearer-token', provider: 'Amazon Web Services', fixtures: '0', counts: null },
  { id: 'github:classic-personal-access-token', name: 'Classic personal access token', href: '/report/providers?family=github:classic-personal-access-token', provider: 'GitHub', fixtures: '22', counts: c('0', '0', '0') },
  { id: 'stripe:webhook-signing-secret', name: 'Webhook signing secret', href: '/report/providers?family=stripe:webhook-signing-secret', provider: 'Stripe', fixtures: '12', counts: c('4', '0', '0', '2') },
  { id: 'generic:private-key', name: 'PEM-encoded private key', href: '/report/providers?family=generic:private-key', provider: 'Not provider-specific', fixtures: '44', counts: c('2', '1', '0') },
  { id: 'confluent:cloud-api-secret-legacy', name: 'Cloud API secret (unprefixed, pre-2025-07-30)', href: '/report/providers?family=confluent:cloud-api-secret-legacy', provider: 'Confluent Cloud', fixtures: '5', counts: c('0', '0', '0') },
];

export const manyFamilies: FamilyRowData[] = Array.from({ length: 60 }, (_, i) => ({
  id: `provider-${i}:family-${i}`,
  name: i === 5 ? 'HRKU-prefixed OAuth access token in two documented prefixed generations of differing length' : `Family ${i + 1}`,
  href: `#family-${i}`,
  provider: `Provider ${(i % 12) + 1}`,
  fixtures: String((i * 3) % 17),
  counts: i % 4 === 0 ? null : c(String(i % 5), String(i % 3), String(i % 2)),
}));

export const familyAbout: FamilyAboutData = {
  description: 'Fine-grained PAT, repository- and permission-scoped, prefixed github_pat_.',
  note: 'Only the github_pat_ prefix is provider-documented; the body shape is community evidence kept provisional. Scored as an arrival family with its own contract, profile and ledger rows.',
  sources: [{ href: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github', host: 'docs.github.com' }],
};

export const fixtureRows: FixtureRowData[] = [
  { slug: 'pat-in-env-file', group: 'github', kind: 'Must redact', evidence: 'T1', outcome: { status: 'pass', label: 'Redacted' } },
  { slug: 'pat-in-curl-header', group: 'github', alsoIn: 'also in 1 other family', kind: 'Must redact', evidence: 'T1', outcome: { status: 'fail', label: 'Left readable' } },
  { slug: 'pat-look-alike-one-char-off', group: 'github', kind: 'Must not flag', evidence: 'T2', outcome: { status: 'pass', label: 'Quiet' } },
  { slug: 'pat-in-shell-history', group: 'github', kind: 'Must redact', evidence: 'T2', outcome: { status: 'review', label: 'Too much' } },
  { slug: 'pat-placeholder-in-docs', group: 'github', kind: 'Project policy', evidence: 'T3', outcome: { status: 'info', label: 'Redacted' } },
  { slug: 'pat-unscored-variant', group: 'github', kind: 'Pending review', outcome: { status: 'not-measured', label: 'Not measured' } },
];

export const manyFixtureRows: FixtureRowData[] = Array.from({ length: 50 }, (_, i) => ({
  slug: i === 2 ? 'pat-in-a-very-long-nested-fixture-slug-that-has-no-natural-break-points-at-all-0123456789' : `pat-fixture-${i + 1}`,
  group: 'github',
  alsoIn: i % 5 === 0 ? `also in ${(i % 3) + 1} other families` : undefined,
  kind: i % 4 === 0 ? 'Project policy' : 'Must redact',
  evidence: `T${(i % 3) + 1}`,
  outcome: i % 6 === 0 ? { status: 'fail', label: 'Left readable' } : { status: 'pass', label: 'Redacted' },
}));

export const familyFacts = [
  { term: 'Fixtures', value: '19' },
  { term: 'Left readable', value: '0' },
  { term: 'Redacted too much', value: '0' },
  { term: 'False alarms', value: '0' },
];
