/**
 * `/evaluation/pii/` and `/evaluation/credential/` (#611): the ledger's facts for each domain, shaped into one set of block props so the
 * two pages read as a pair. Pure: raw data in, text out. No filesystem, no service import (only their types).
 *
 * Rules the copy keeps (boundary rule in AGENTS.md): it states what the ledger records, names the mode of every status count,
 * never orders scanners or says what a product outputs, and shows a missing fact as "Not recorded" with the issue that owns it.
 */
import type { CoverageNotRecorded, CoverageRow, CoverageTable, DefinitionRow, DomainViewData, GlanceItem, StatusGroup, StatusRowData } from '../components/evaluation/domain';
import type { CredentialEvaluation, PiiEvaluation, PiiFamilyRecord, PiiViewCounts, PiiViewId, SupportRecord } from '../services/domains';
import { count, int, isoDate } from './format';
import { modeText } from './report';

export type DomainId = 'pii' | 'credential';
export const DOMAIN_HREF: Record<DomainId, string> = { credential: '/evaluation/credential/', pii: '/evaluation/pii/' };

const REPO = 'https://github.com/redact-secret/redact-secret-benchmarks';
const blob = (path: string): string => `${REPO}/blob/develop/${path}`;
const issue = (number: number) => ({ number, href: `${REPO}/issues/${number}` });
const ISSUES = { activation: 615, population: 616, methods: 617, metrics: 618, policyHoldout: 619, accuracyCorpus: 576 } as const;

const pair = [{ label: 'Credential', href: DOMAIN_HREF.credential }, { label: 'PII', href: DOMAIN_HREF.pii }];
/** The first crumb is the Evaluation hub (#614). */
const breadcrumb = (label: string) => [{ label: 'Evaluation', href: '/evaluation/' }, { label }];

/** "5 provisional, 1 pending": the states with a count, in the order stable, provisional, pending, unsupported. */
export function distributionText(distribution: Record<string, number>): string {
  const parts = (['stable', 'provisional', 'pending', 'unsupported'] as const).filter(key => distribution[key] > 0).map(key => `${int(distribution[key])} ${key}`);
  return parts.length ? parts.join(', ') : 'none classified';
}

const modeWord = (mode: 'candidate' | 'published'): string => (mode === 'candidate' ? 'Candidate' : 'Published');

// ---- Shared prose ---------------------------------------------------------------------------------

const READING_COMMON: DefinitionRow[] = [
  { term: 'N of M', text: 'A numerator over its own denominator. Two metrics never share a denominator, so there is no total.' },
  { term: 'Not measured is not zero', text: 'A dashed mark means nothing was recorded. A zero is a recorded count of none.' },
  { term: 'Status words', text: 'Pending, provisional, stable and unsupported are classifications by published rules. Every artifact says supportClaims is false: they are not claims about a product.' },
  { term: 'Mode', text: 'Published means a release. Candidate means an unreleased build. A count that depends on the build always names one.' },
];

const RECORDED_COMMON = 'The ledger records each outcome against the expected answer. It never turns outcomes into a score, a rank or a verdict about a product.';

// ---- PII ------------------------------------------------------------------------------------------

export const PII_TYPE_MEANING: Record<string, string> = {
  correct: 'Found as the expected type.',
  miss: 'Not found.',
  'invalid-correct': 'A deliberately invalid look-alike was rejected.',
  'invalid-accepted': 'A deliberately invalid look-alike was accepted.',
  'wrong-family': 'Found as another family.',
  'wrong-jurisdiction': 'Found under another jurisdiction.',
  'not-measured': 'No outcome was recorded.',
};

export const PII_SENSITIVITY_MEANING: Record<string, string> = {
  correct: 'Flagged when sensitive, left alone when not.',
  miss: 'A sensitive value was not flagged.',
  'false-positive': 'A non-sensitive value was flagged.',
  unresolved: 'Needs review. Stays in the denominator and never counts as a pass.',
  'not-measured': 'No outcome was recorded.',
};

const PII_VIEWS: { id: PiiViewId; column: string; meaning: string }[] = [
  { id: 'oracle-plan', column: 'Oracle plan', meaning: 'Authored identity and sensitivity labels, one per plan case.' },
  { id: 'qualification-plan', column: 'Qualification plan', meaning: 'The frozen plan of each family.' },
  { id: 'diagnostic-balanced', column: 'Diagnostic-balanced', meaning: 'A tuning view. It does not decide a release.' },
  { id: 'benign-heavy-stress', column: 'Benign-heavy', meaning: 'An evaluation view dominated by non-sensitive values.' },
];

const viewCell = (counts: PiiViewCounts | undefined) => (counts
  ? { figure: int(counts.cases), detail: `${int(counts.sensitive)} · ${int(counts.nonSensitive)} · ${int(counts.notEstablished)}` }
  : { figure: null });

function piiCoverageRow(family: PiiFamilyRecord): CoverageRow {
  const protectedCell = { figure: family.protectedRun.cases === null ? null : int(family.protectedRun.cases) };
  return {
    id: family.id,
    label: family.name,
    detail: family.coverage,
    cells: [...PII_VIEWS.map(view => viewCell(family.views?.[view.id])), protectedCell],
  };
}

const piiStatic = {
  steps: [
    { title: 'Author', text: 'A case is made-up text with one value in it. The expected answer is written before any scanner runs, from a public authority such as an RFC, ISO 13616, the SSA rules or the NANP plan.' },
    { title: 'Run', text: 'Every scanner reads the same bytes. The run keeps ranges and actions, never the matched text.' },
    { title: 'Compare', text: 'Each result is checked on two axes: what kind of value it is, and whether it is sensitive where it sits. The reported range is checked against the authored range.' },
    { title: 'Record', text: 'Each metric keeps its own numerator and denominator. Nothing is added across metrics, families or domains.' },
  ],
  oracle: [
    { term: 'Identity', text: 'A reference validator (Luhn, ISO 13616 mod-97, SSA allocation, NANP structure, IP syntax) runs on the authored range, never on scanner output.' },
    { term: 'Sensitive', text: 'Needs a context rule from the family contract. A validator hit or a keyword alone is rejected as a basis.' },
    { term: 'Non-sensitive', text: 'Needs a reserved value from an authority: RFC 2606 and 6761 names, IANA ranges, published test cards, NANPA 555-0100 to 555-0199.' },
    { term: 'Not established', text: 'The contract does not decide it. It counts as review required and never as a pass.' },
  ],
  methods: [
    { term: 'type-validation', text: 'Checks the validator state against the authored expectation.' },
    { term: 'context-discrimination', text: 'The same value in sensitive, neutral and non-sensitive context.' },
    { term: 'pii-benign', text: 'Reserved, documentation, test, public, placeholder and context-negative values.' },
    { term: 'jurisdiction-collision', text: 'A value that validates in more than one family.' },
    { term: 'mutation', text: 'Invalidates the final digit and checks the result.' },
    { term: 'reference-differential', text: 'Compares with a reference. The reference is an observation, not truth.' },
  ],
  reading: [
    ...READING_COMMON,
    { term: 'Two populations', text: 'Diagnostic-balanced and benign-heavy stay apart, so a local change is not hidden by an average.' },
    { term: 'Language is not jurisdiction', text: 'Reading Korean labels says nothing about a Korean national identifier.' },
  ],
  sources: [
    { label: 'Identity oracle', path: 'docs/specs/pii-identity-oracle.md' },
    { label: 'Benign and collision evidence', path: 'docs/specs/pii-benign-collision-evidence.md' },
    { label: 'Population views', path: 'docs/specs/pii-populations.md' },
    { label: 'Metric profile', path: 'qualification/pii-v1.json' },
  ],
};

const vocabulary = (title: string, meanings: Record<string, string>) => ({ title, rows: Object.entries(meanings).filter(([word]) => word !== 'not-measured').map(([word, meaning]) => ({ word, meaning })) });

export function resolvePiiView(pii: PiiEvaluation): DomainViewData {
  const recorded = pii.state === 'recorded' ? pii : null;
  const modeLine = recorded ? `${modeWord(recorded.mode)}, core ${recorded.core.commit.slice(0, 7)}` : 'Not recorded';
  const families = recorded?.families ?? [];
  const jurisdictional = families.filter(f => f.jurisdiction !== null);
  const protectedTotal = families.length > 0 && families.every(f => f.protectedRun.cases !== null) ? families.reduce((sum, f) => sum + (f.protectedRun.cases ?? 0), 0) : null;

  const glance: GlanceItem[] = [
    {
      label: 'Covered',
      value: recorded ? count(families.length, 'family', 'families') : null,
      detail: recorded
        ? `${int(families.length - jurisdictional.length)} global, ${int(jurisdictional.length)} jurisdictional (${jurisdictional.map(f => f.jurisdiction).join(', ') || 'none'}).`
        : 'The PII evidence did not validate, so no family is listed.',
    },
    {
      label: 'Recorded status',
      value: recorded ? distributionText(recorded.distribution) : null,
      detail: recorded
        ? `${modeWord(recorded.mode)} record, core ${recorded.core.commit.slice(0, 7)}${recorded.mode === 'candidate' ? ', unreleased' : ''}. A classification by published rules, not a claim about the product.`
        : 'No record is bound to a build.',
    },
    {
      label: 'Held apart',
      value: protectedTotal === null ? null : `${int(protectedTotal)} protected cases`,
      detail: protectedTotal === null ? 'No protected run is recorded.' : 'Sealed and run once per family. Never mixed with the public views.',
    },
  ];

  const coverageTable: CoverageTable | CoverageNotRecorded = recorded
    ? {
        id: 'by-family',
        caption: 'Cases by family and view',
        rowHeader: 'Family',
        columns: [...PII_VIEWS.map(v => v.column), 'Protected'],
        rows: families.map(piiCoverageRow),
        note: 'Under each count: the cases split by what the author expects, sensitive · non-sensitive · not established.',
      }
    : { id: 'by-family', caption: 'Cases by family and view', text: pii.state === 'not-recorded' ? pii.reason : 'No PII record is bound.' };

  const status: StatusGroup[] = [];
  if (recorded) {
    const pending = families.filter(f => f.status === 'pending');
    const gates = families.map(f => f.publicGates);
    const sameGates = gates.every(g => g && g.met === gates[0]?.met && g.acceptedTradeoffs === gates[0]?.acceptedTradeoffs && g.notMet === 0 && g.unresolved === 0);
    const protectedMet = families.filter(f => f.protectedRun.state === 'met').length;
    const recordedRows: StatusRowData[] = [
      {
        id: 'family-status', label: 'Family status', status: 'info', statusWord: 'Recorded', value: distributionText(recorded.distribution),
        detail: `${modeLine}${recorded.mode === 'candidate' ? ', unreleased' : ''}. ${pending.length ? `Pending: ${pending.map(f => `${f.name} (${f.reasonCodes.join(', ') || 'no reason code'})`).join('; ')}. ` : ''}The route gives ${recorded.route.maximumStatus} at most.`,
        link: { label: 'Evidence record', href: blob(recorded.route.record), external: true },
      },
      sameGates && gates[0]
        ? {
            id: 'public-gates', label: 'Public gates', status: 'info', statusWord: 'Recorded',
            value: `${int(gates[0].met)} met${gates[0].acceptedTradeoffs ? `, ${int(gates[0].acceptedTradeoffs)} accepted as a tradeoff` : ''}, per family`,
            detail: recorded.costAcceptance
              ? `The accepted tradeoff is profile-cost: the frozen report scores it not met (${int(recorded.costAcceptance.cells)} cells and ${int(recorded.costAcceptance.sizeRows)} size rows), the maintainer accepted it, and the protected route counts it as met.`
              : 'Each gate is met or accepted in the reviewed disposition.',
            link: { label: 'Acceptance', href: blob('benchmarks/accepted-pii-profile-cost.json'), external: true },
          }
        : { id: 'public-gates', label: 'Public gates', status: 'not-measured', statusWord: 'Not recorded', detail: 'The reviewed disposition is not bound, or the families do not agree.' },
      {
        id: 'protected-runs', label: 'Protected runs', status: 'info', statusWord: 'Recorded',
        value: `${int(protectedMet)} of ${int(families.length)} met`,
        detail: `One attempt per family, kept apart from the public views.${families.filter(f => f.protectedRun.state !== 'met').map(f => ` ${f.name}: ${f.protectedRun.reason}.`).join('')}`,
        link: { label: 'Evidence record', href: blob(recorded.route.record), external: true },
      },
    ];
    status.push({ title: 'Recorded', rows: recordedRows });
    status.push({
      title: 'Not measured yet',
      rows: [
        recorded.productActivation === 'trusted'
          ? { id: 'activation', label: 'Product activation', status: 'info', statusWord: 'Recorded', detail: 'A trusted product record is bound.' }
          : { id: 'activation', label: 'Product activation', status: 'not-measured', statusWord: 'Not measured', detail: 'No product activation record matches the build this page shows.', link: { label: `#${ISSUES.activation}`, href: issue(ISSUES.activation).href, external: true } },
        { id: 'validator', label: 'Validator evidence', status: 'not-measured', statusWord: 'Not recorded', detail: 'No validator observation is committed.', link: { label: `#${ISSUES.population}`, href: issue(ISSUES.population).href, external: true } },
        recorded.populationComparisons.every(c => c.verdict === 'not-measured')
          ? { id: 'population', label: 'Population comparison', status: 'not-measured', statusWord: 'Not measured', detail: 'No bound baseline and candidate bundle is published.', link: { label: `#${ISSUES.population}`, href: issue(ISSUES.population).href, external: true } }
          : { id: 'population', label: 'Population comparison', status: 'info', statusWord: 'Recorded', value: recorded.populationComparisons.map(c => `${c.id}: ${c.verdict}`).join(', '), detail: 'A bound comparison is published.' },
        { id: 'stable', label: 'Stable', status: recorded.distribution.stable > 0 ? 'info' : 'not-measured', statusWord: recorded.distribution.stable > 0 ? 'Recorded' : 'None recorded', value: `${int(recorded.distribution.stable)} ${recorded.distribution.stable === 1 ? 'family' : 'families'}`, detail: `The ${recorded.route.id} route cannot give stable.` },
      ],
    });
  } else {
    status.push({
      title: 'Not measured yet',
      rows: [{ id: 'evidence', label: 'PII evidence', status: 'not-measured', statusWord: 'Not recorded', detail: pii.state === 'not-recorded' ? pii.reason : 'No PII record is bound.' }],
    });
  }
  status.push({
    title: 'Known gaps',
    rows: [
      { id: 'sensitive-namespace', label: 'Non-sensitive SSN and IBAN', status: 'info', statusWord: 'Recorded', value: 'No oracle row', detail: 'No structurally valid non-sensitive namespace exists for either.', link: { label: 'Contract note', href: blob('docs/specs/pii-benign-collision-evidence.md'), external: true } },
      ...(recorded ? [{ id: 'scope', label: 'Narrow scope', status: 'info' as const, statusWord: 'Recorded', value: families.filter(f => f.coverage !== 'Global').map(f => `${f.name}: ${f.coverage}`).join('; ') || 'None', detail: 'No other national identifier or numbering plan is registered.' }] : []),
      { id: 'accuracy-corpus', label: 'Personal-data accuracy corpus', status: 'info', statusWord: 'Recorded', value: 'In progress', detail: 'Peer runs for the accuracy pair page.', link: { label: `#${ISSUES.accuracyCorpus}`, href: issue(ISSUES.accuracyCorpus).href, external: true } },
    ],
  });

  return {
    head: {
      domain: 'pii',
      eyebrow: 'Evaluation · PII',
      title: 'How PII is evaluated',
      lede: 'The benchmark checks whether a value is found as the right kind of personal data, and whether a value that looks like personal data is sensitive where it sits. It records what happened. It does not grade a product.',
      meta: [
        { label: 'Evaluation profile', value: recorded?.profile.evaluationProfile ?? 'Not recorded' },
        { label: 'Accounting', value: recorded?.profile.domainAccountingVersion ?? 'Not recorded' },
        { label: 'Mode', value: modeLine },
        { label: 'Support claims', value: 'None' },
      ],
      pair, currentHref: DOMAIN_HREF.pii, pairLabel: 'Evaluation domain', breadcrumb: breadcrumb('PII'),
    },
    glance,
    method: {
      title: 'How a case is judged',
      steps: piiStatic.steps,
      vocabularies: [vocabulary('Type identity', PII_TYPE_MEANING), vocabulary('Sensitivity in context', PII_SENSITIVITY_MEANING)],
      oracle: piiStatic.oracle,
      methods: piiStatic.methods,
      metrics: {
        summary: `The ${int(recorded?.metrics.length ?? 10)} pii-v1 metrics`,
        text: `Each metric is read against its own population. None is combined with another or with a credential metric. Their values are not on this page (#${ISSUES.metrics}).`,
        rows: (recorded?.metrics ?? []).map(m => ({ id: m.id, population: m.population, counts: `${m.numerator}, of ${m.denominator}`, better: m.direction === 'upper' ? 'Lower' : 'Higher' })),
      },
      recorded: {
        title: 'Recorded, not graded',
        text: `${RECORDED_COMMON} A family's status is a classification by published rules: each metric's interval bound has to be on the right side of its threshold and the protected run has to be met. The protected route gives provisional at most, and every artifact says supportClaims is false.`,
      },
    },
    coverage: {
      title: 'What is covered',
      mode: recorded
        ? `Counts are from the frozen report bound by the reviewed protected binding ${recorded.route.id}. Mode: ${modeLine.toLowerCase()}${recorded.mode === 'candidate' ? ', unreleased' : ''}.`
        : 'No PII record is bound, so no count is shown.',
      tables: [coverageTable, { id: 'by-method', caption: 'Cases and variants by method', text: 'The ledger holds no per-method counts for this domain; the credential page shows them.', issue: issue(ISSUES.methods) }],
      columnKey: [...PII_VIEWS.map(v => ({ term: v.column, text: v.meaning })), { term: 'Protected', text: 'A sealed corpus, run once. Only its size is public.' }],
      scope: [
        { term: 'Languages with context evidence', text: `${(recorded?.languages ?? []).join(', ') || 'Not recorded'}. Language is not jurisdiction.` },
        { term: 'Jurisdictions', text: recorded ? `${int(jurisdictional.length)} registered${jurisdictional.length ? ` (${jurisdictional.map(f => f.jurisdiction).join(', ')})` : ''}. The ${recorded.jurisdictionStandard.id} list of ${int(recorded.jurisdictionStandard.codeCount)} codes checks an identity; its size is not a coverage target.` : 'Not recorded.' },
      ],
    },
    status: { title: 'Where this stands', groups: status, links: [{ label: 'Accuracy comparison, PII view', href: '/comparison/accuracy/?data=pii' }, { label: 'Runtime comparison, PII', href: '/comparison/runtime/?domain=pii' }] },
    reading: {
      title: 'How to read the numbers',
      items: piiStatic.reading,
      sources: [
        ...(recorded ? [{ label: 'Evidence record', path: recorded.route.record, href: blob(recorded.route.record) }] : []),
        ...piiStatic.sources.map(s => ({ ...s, href: blob(s.path) })),
      ],
    },
  };
}

// ---- Credential -----------------------------------------------------------------------------------

export const CREDENTIAL_OUTCOME_MEANING: Record<string, string> = {
  EXACT: 'The reported range equals the secret.',
  COVERED: 'Inside the allowed envelope around the secret.',
  OVERBROAD: 'Redacts more than the envelope allows.',
  PARTIAL: 'Part of the secret is left readable.',
  MISS: 'Not reported.',
};

const LEVEL_MEANING: Record<string, string> = { T1: 'Provider-documented.', T2: 'Tool-corroborated.', T3: 'Project policy.', T0: 'Pending review. Observed, never scored.' };

const METHOD_TEXT: Record<string, string> = {
  twin: 'Authored positive and negative pairs.',
  benign: 'Controls that must stay silent.',
  metamorphic: 'The same secret in another context or encoding.',
  mutation: 'Seeded edits with a stated effect.',
  differential: 'Compares scanners. Disagreements go to review.',
  holdout: 'Isolated frozen cases, aggregate output only.',
};
const titleCase = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

const KIND_ROWS: { kind: 'must-redact' | 'must-not-flag' | 'policy'; label: string }[] = [
  { kind: 'must-redact', label: 'Must redact' },
  { kind: 'must-not-flag', label: 'Must not flag' },
  { kind: 'policy', label: 'Project policy' },
];
const TIERS = ['T1', 'T2', 'T3', 'T0'] as const;

const credentialStatic = {
  steps: [
    { title: 'Author', text: 'A fixture is made-up text with the secret’s byte range marked. The expected answer comes from provider documentation, tool corroboration or project policy, never from a scanner.' },
    { title: 'Run', text: 'Every scanner reads the same bytes. Another scanner is never the oracle.' },
    { title: 'Compare', text: 'Each secret span gets one outcome. A control file is flagged or not.' },
    { title: 'Record', text: 'A rate carries a Wilson interval and is withheld under a minimum count. There is no overall score.' },
  ],
  oracle: [
    { term: 'T1', text: 'The provider’s own documentation states the format.' },
    { term: 'T2', text: 'A tool or a structural check corroborates it.' },
    { term: 'T3', text: 'The project states a policy, with its rationale.' },
    { term: 'Peers', text: 'Another scanner’s output is a comparison, never the truth.' },
  ],
  metrics: [
    { id: 'leaked-span-rate', population: 'scanner × expected secret span', counts: 'span is PARTIAL or MISS, of expected spans', better: 'Lower' },
    { id: 'false-alarm-rate', population: 'scanner × must-not-flag file', counts: 'file is flagged, of control files', better: 'Lower' },
    { id: 'collateral-ratio', population: 'scanner × secret byte', counts: 'bytes redacted outside the envelope, of secret bytes', better: 'Lower' },
  ],
  reading: [
    ...READING_COMMON,
    { term: 'Levels stay apart', text: 'T1, T2 and T3 are different evidence. They are shown side by side and never merged.' },
    { term: 'An interval describes the corpus', text: 'A Wilson bound says how sure the count is on these fixtures, not what happens in production.' },
  ],
  sources: [
    { label: 'Measurement protocol', path: 'docs/specs/measurement-v4.md' },
    { label: 'Evaluation engine', path: 'docs/specs/evaluation-engine-v1.md' },
    { label: 'Support status criteria', path: 'docs/specs/support-status.md' },
    { label: 'Taxonomy', path: 'docs/specs/taxonomy.md' },
  ],
};

/** "7 provisional, 1 pending", or the words that say there are none. */
function othersText(record: SupportRecord): string {
  const rest = distributionText({ ...record.distribution, stable: 0 });
  return rest === 'none classified' ? 'No family is in another state' : rest;
}

function supportValue(record: SupportRecord): string {
  return `${int(record.distribution.stable)} of ${int(record.familyCount)} stable`;
}

export function resolveCredentialView(input: CredentialEvaluation): DomainViewData {
  const { run, catalog, findings, support, qualification, profiles } = input;
  const measured = run.state === 'measured' ? run : null;
  const fixtures = catalog.fixtures;
  const familiesWithFixtures = catalog.taxonomy.families.filter(f => (catalog.fixturesByFamily.get(f.id)?.length ?? 0) > 0).length;
  const holdout = qualification?.methods.find(m => m.method === 'holdout');
  const tierCount = (kind: string, tier: string): number => fixtures.filter(f => f.kind === kind && f.tier === tier).length;
  const pendingFixtures = fixtures.filter(f => f.tier === 'T0').length;

  const glance: GlanceItem[] = [
    {
      label: 'Covered',
      value: count(catalog.taxonomy.families.length, 'family', 'families'),
      detail: `In ${int(catalog.taxonomy.providers.length)} providers, with ${int(fixtures.length)} fixtures in ${int(catalog.suites.length)} suites. ${int(familiesWithFixtures)} families have at least one fixture.`,
    },
    {
      label: 'Recorded status',
      value: support ? supportValue(support) : null,
      detail: support
        ? `${modeWord(support.mode)}, ${support.version}, recorded ${isoDate(support.generatedAt)}. ${othersText(support)}. A classification by published rules, not a claim about the product.`
        : 'No support record matches the mode and build of the run, so no stable count is shown.',
    },
    {
      label: 'Held apart',
      value: holdout ? `${int(holdout.cases)} public holdout cases` : null,
      detail: holdout ? 'Public conformance controls, run once, aggregate output only. Protected corpora are never committed.' : 'No qualification record is committed.',
    },
  ];

  const kindTable: CoverageTable = {
    id: 'by-kind',
    caption: 'Fixtures by kind and level',
    rowHeader: 'Kind',
    columns: [...TIERS],
    rows: KIND_ROWS.map(row => ({ id: row.kind, label: row.label, cells: TIERS.map(tier => ({ figure: int(tierCount(row.kind, tier)) })) })),
    note: 'A fixture is counted once, under the kind and level the corpus assigns it.',
  };
  const methodTable: CoverageTable | CoverageNotRecorded = qualification
    ? {
        id: 'by-method', caption: 'Cases and variants by method', rowHeader: 'Method', columns: ['Cases', 'Variants'],
        rows: qualification.methods.map(m => ({ id: m.method, label: titleCase(m.method), cells: [{ figure: int(m.cases) }, { figure: int(m.variants) }] })),
        note: `Engine qualification run, ${isoDate(qualification.finishedAt)}.`,
      }
    : { id: 'by-method', caption: 'Cases and variants by method', text: 'No qualification record is committed.' };

  const recordedRows: StatusRowData[] = [];
  const notMeasuredRows: StatusRowData[] = [];
  if (measured) {
    recordedRows.push({
      id: 'run', label: 'Benchmark run', status: 'info', statusWord: 'Recorded', value: `${int(measured.suiteCount)} of ${int(catalog.suites.length)} suites`,
      detail: `${modeText(measured)}, ${count(measured.scanners.length, 'scanner')}, run ${isoDate(measured.generatedAt)}.`, link: { label: 'Report', href: '/report/' },
    });
  } else {
    notMeasuredRows.push({ id: 'run', label: 'Benchmark run', status: 'not-measured', statusWord: 'Not measured', detail: 'No usable run was written for this checkout, so no scanner result is shown. Fixture counts above are the corpus.' });
  }
  if (support) {
    recordedRows.push({
      id: 'support', label: 'Support classification', status: 'info', statusWord: 'Recorded', value: distributionText(support.distribution),
      detail: `Of ${int(support.familyCount)} scored families: ${int(support.stable.documented)} documented, ${int(support.stable.empirical)} empirical, ${int(support.stable.policyQualified)} policy-qualified. ${modeWord(support.mode)}, ${support.version}.`,
      link: { label: 'Evidence record', href: blob(support.path), external: true },
    });
  } else {
    notMeasuredRows.push({ id: 'support', label: 'Support classification', status: 'not-measured', statusWord: 'Not recorded', detail: 'No support record matches the mode and build of the run.' });
  }
  if (qualification) {
    recordedRows.push({
      id: 'qualification', label: 'Engine qualification', status: 'info', statusWord: 'Recorded', value: titleCase(qualification.status),
      detail: `The infrastructure ran ${int(qualification.methods.length)} methods. It says nothing about a detector. Run ${isoDate(qualification.finishedAt)}.`,
      link: { label: 'Record', href: blob(qualification.path), external: true },
    });
  }
  const byStatus = new Map<string, number>();
  for (const record of findings.issues) byStatus.set(record.status, (byStatus.get(record.status) ?? 0) + 1);
  recordedRows.push({
    id: 'findings', label: 'Findings handed to the product', status: 'info', statusWord: 'Recorded', value: count(findings.issues.length, 'record'),
    detail: `${[...byStatus].map(([state, n]) => `${int(n)} ${state.replace(/-/g, ' ')}`).join(', ') || 'None'}. Snapshot reviewed ${findings.reviewedAt} against ${findings.measuredVersion}.`,
    link: { label: 'Findings', href: '/report/findings/' },
  });
  notMeasuredRows.push(
    {
      id: 'policy-qualified', label: 'Policy-qualified profile', status: 'not-measured', statusWord: 'Not measured',
      detail: 'The profile needs a protected holdout on a frozen candidate, and none is committed.', link: { label: `#${ISSUES.policyHoldout}`, href: issue(ISSUES.policyHoldout).href, external: true },
    },
    { id: 'validity', label: 'Live validity', status: 'not-measured', statusWord: 'Not measured', detail: 'Fixtures are made up, so no credential is checked against its provider.' },
    { id: 'real-world', label: 'Real-world rate', status: 'not-measured', statusWord: 'Not measured', detail: 'An interval describes the corpus, not production traffic.' },
  );

  return {
    head: {
      domain: 'credential',
      eyebrow: 'Evaluation · Credential',
      title: 'How credentials are evaluated',
      lede: 'The benchmark checks whether a secret in a file is found and covered exactly, and whether text that only looks like a secret stays unflagged. It records what happened. It does not grade a product.',
      meta: [
        { label: 'Evaluation profile', value: profiles?.evaluationProfile ?? 'Not recorded' },
        { label: 'Accounting', value: profiles?.domainAccountingVersion ?? 'Not recorded' },
        { label: 'Mode', value: measured ? modeText(measured) : 'Not recorded' },
        { label: 'Support claims', value: 'None' },
      ],
      pair, currentHref: DOMAIN_HREF.credential, pairLabel: 'Evaluation domain', breadcrumb: breadcrumb('Credential'),
    },
    glance,
    method: {
      title: 'How a case is judged',
      steps: credentialStatic.steps,
      vocabularies: [vocabulary('Outcome of a secret span', CREDENTIAL_OUTCOME_MEANING), vocabulary('Level of evidence', LEVEL_MEANING)],
      oracle: credentialStatic.oracle,
      methods: (qualification?.methods ?? Object.keys(METHOD_TEXT).map(method => ({ method }))).map(m => ({ term: m.method, text: METHOD_TEXT[m.method] ?? 'Recorded in the qualification run.' })),
      metrics: {
        summary: `The ${int(credentialStatic.metrics.length)} headline rates`,
        text: 'Each rate is read against its own population and carries a Wilson bound. None is combined with another or with a PII metric.',
        rows: credentialStatic.metrics,
      },
      recorded: {
        title: 'Recorded, not graded',
        text: `${RECORDED_COMMON} A family's status is a classification by published rules and floors (documented, empirical or policy-qualified profile), and every artifact says supportClaims is false. Engine qualification says the infrastructure ran, not that a detector passed.`,
      },
    },
    coverage: {
      title: 'What is covered',
      mode: `Counts are fixtures as the corpus assigns them (index of ${int(fixtures.length)}). They do not depend on a run. Scanner results, and so the stable count, name their mode.`,
      tables: [kindTable, methodTable],
      columnKey: TIERS.map(tier => ({ term: tier, text: LEVEL_MEANING[tier] })),
      scope: [
        { term: 'Families', text: `${int(catalog.taxonomy.families.length)} in the taxonomy${support ? `; the support record scores ${int(support.familyCount)}` : ''}. ${int(familiesWithFixtures)} have a fixture and ${int(catalog.taxonomy.families.length - familiesWithFixtures)} have none.` },
        { term: 'Detail', text: 'Every provider, family and fixture has its page under the report.' },
      ],
    },
    status: {
      title: 'Where this stands',
      groups: [
        { title: 'Recorded', rows: recordedRows },
        { title: 'Not measured yet', rows: notMeasuredRows },
        {
          title: 'Known gaps',
          rows: [
            { id: 'pending', label: 'Fixtures pending review', status: 'info', statusWord: 'Recorded', value: count(pendingFixtures, 'fixture'), detail: 'Observed and never scored (level T0).' },
            { id: 'kept-apart', label: 'Other evidence, kept apart', status: 'info', statusWord: 'Recorded', value: 'Blind, score evasion, parity', detail: 'Custodian-blind evaluation, score evasion and mixed parity are separate classes and are not merged into one number.', link: { label: 'Blind evaluation', href: blob('docs/specs/blind-evaluation.md'), external: true } },
          ],
        },
      ],
      links: [{ label: 'Accuracy comparison', href: '/comparison/accuracy/' }, { label: 'Runtime comparison, credentials', href: '/comparison/runtime/?domain=credentials' }, { label: 'Report', href: '/report/' }],
    },
    reading: {
      title: 'How to read the numbers',
      items: credentialStatic.reading,
      sources: credentialStatic.sources.map(s => ({ ...s, href: blob(s.path) })),
    },
  };
}
