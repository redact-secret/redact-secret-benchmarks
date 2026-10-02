/** Synthetic story data: made-up populations, families, digests and counts. Nothing here is a ledger value. */
import type { CaseRowProps, CaseSection, CountsRow, QualificationCasesProps, FamilyRow, GapRow, PopulationRow, QualificationFamilyProps, QualificationOverviewProps, QualificationUnavailableProps, ScannerRow } from './types';

export const populationRows: PopulationRow[] = [
  { id: 'evidence-population', role: 'floors and gates', runClass: 'public', evidence: 'example-evidence · snapshot-0000.00.00', corpusDigest: 'sha256:aaaaaaaaaaaa', configHash: 'sha256:cccccccccccc', semanticDigest: 'sha256:111111111111', engine: 'example-eval 0.0.1 · protocol 1', methods: 'None run', cases: '120' },
  { id: 'regression-population', role: 'gates', runClass: 'public', evidence: 'example-regression · regression-bbbbbbbbbbbb', corpusDigest: 'sha256:bbbbbbbbbbbb', configHash: 'sha256:cccccccccccc', semanticDigest: 'sha256:222222222222', engine: 'example-eval 0.0.1 · protocol 1', methods: 'None run', cases: '14' },
  { id: 'policy-population', role: 'policy route', runClass: 'public', evidence: 'example-policy · policy-dddddddddddd', corpusDigest: 'sha256:dddddddddddd', configHash: 'sha256:cccccccccccc', semanticDigest: 'sha256:333333333333', engine: 'example-eval 0.0.1 · protocol 1', methods: 'metamorphic, mutation', cases: '6' },
];

export const scannerRows: ScannerRow[] = ['alpha-lib', 'beta-scan'].flatMap(scanner => populationRows.map(p => ({
  key: `${p.id}/${scanner}`, population: p.id, scanner, version: scanner === 'alpha-lib' ? '1.2.3' : '4.5.6', build: 'released', mode: 'Directory scan · default rules',
})));

export const familyRows: FamilyRow[] = [
  { family: 'alpha-token', href: '/evaluation/qualification/families/alpha-token/', provider: 'Alpha', status: { word: 'Stable', tone: 'info' }, route: 'documented', tier: 'T1', basis: 'provider-documented', heldBy: [], cases: ['evidence-population 60', 'regression-population 4', 'policy-population 0'] },
  { family: 'beta-key', href: '/evaluation/qualification/families/beta-key/', provider: 'Beta', status: { word: 'Provisional', tone: 'review' }, route: 'No route', tier: 'T2', basis: 'independently-corroborated', heldBy: ['methods not run'], cases: ['evidence-population 31', 'regression-population 0', 'policy-population 0'] },
  { family: 'gamma-secret-with-a-very-long-detector-family-identifier-that-keeps-going', href: '/evaluation/qualification/families/gamma-secret-with-a-very-long-detector-family-identifier-that-keeps-going/', provider: 'Gamma', status: { word: 'Pending', tone: 'none' }, route: 'No route', tier: 'T0', basis: 'none', heldBy: ['no positive fixture has cleared review'], cases: ['evidence-population 0', 'regression-population 0', 'policy-population 0'] },
];

export const gapRows: GapRow[] = [
  { id: 'product-1', title: 'A synthetic known gap', status: 'fixed', kind: 'false-positive', matched: ['regression-population 1 of 2 fixtures'], fixtures: [{ fixture: 'suite-a--case-1', matches: ['regression-population · control · not flagged'] }, { fixture: 'suite-b--case-2', matches: [] }] },
  { id: 'product-2', title: 'A gap whose fixtures are not in any population', status: 'open', kind: 'missed-secret', matched: [], fixtures: [{ fixture: 'suite-c--case-3', matches: [] }] },
];

export const overview: QualificationOverviewProps = {
  breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Qualification' }],
  eyebrow: 'redact-secret · Evaluation',
  title: 'Qualification from the official runs',
  lede: 'The support status the adapter derived from one official evaluation run per population. It is built beside the existing report, which stays the reference until cutover.',
  meta: [{ label: 'Publication', value: 'public' }, { label: 'Policy revision', value: 'rs-policy-1:sha256:0123456789ab' }],
  boundary: {
    title: 'Read this before the numbers',
    paragraphs: [
      'The evaluation engine measures and records; it emits no support status. The status shown here is this benchmark’s own qualification of the product, derived from the engine’s results by the adapter.',
      'Every count carries its population. No figure is a sum across populations or scanners, and a gate that did not run is shown as not measured, never as zero.',
    ],
  },
  summary: {
    title: 'Support status of the detector families',
    description: 'One count per recorded status, over the families the product qualification scores.',
    mode: 'Published release · redact-secret 1.0.0 (released build)',
    tiles: [
      { label: 'Stable', value: '1', definition: 'Every stable floor holds in this view.' },
      { label: 'Provisional', value: '1', definition: 'A detector exists and a floor does not hold yet.' },
      { label: 'Pending', value: '1', definition: 'No positive fixture has cleared review.' },
      { label: 'Unsupported', value: '0', definition: 'Recorded as unsupported.' },
    ],
    routes: [
      { label: 'Stable by documented route', value: '1', definition: 'Provider-documented format.' },
      { label: 'Stable by empirical route', value: '0', definition: 'Independently corroborated format.' },
      { label: 'Stable by policy-qualified route', value: '0', definition: 'Project policy with a holdout.' },
    ],
    methodsNote: 'The official configuration ran no metamorphic, mutation or differential method. A family whose floors all hold stays provisional until those methods run.',
  },
  identity: {
    title: 'Identity of this view',
    items: [
      { term: 'View schema', value: 'redact-secret/qualification-view/v1', code: true },
      { term: 'Adapter', value: 'credential-eval-run-artifact v1' },
      { term: 'Product policy revision', value: 'rs-policy-1:sha256:0123456789ab', code: true },
      { term: 'Methods the policy requires', value: 'metamorphic, mutation, differential' },
    ],
  },
  populations: { title: 'Populations', description: 'Each population is its own run with its own denominator. Counts are never added together.', rows: populationRows },
  scanners: { title: 'Scanners', description: 'The scanners every population ran with.', rows: scannerRows },
  families: {
    title: 'Detector families',
    description: 'One row per family the product qualification scores. Open one for its evidence and the scanners’ counts.',
    rows: familyRows,
    undetected: { title: 'Taxonomy families with no detector', text: '2 families in the taxonomy have no detector, so no status is derived for them.', items: ['alpha:legacy-key', 'beta:session-id'] },
  },
  unattributed: { title: 'Cases no detector family claims', description: 'Each population keeps its own cases that no detector family claims.', href: '/evaluation/qualification/unattributed/1/', label: 'Open the unattributed cases' },
  gaps: { title: 'Known-gap inputs', description: 'Each record’s fixtures matched to cases by id, per population.', rows: gapRows },
};

export const countsRows: CountsRow[] = [
  { key: 'e/alpha', population: 'evidence-population', role: 'floors and gates', scanner: 'alpha-lib', cases: '60', positives: '40', outcomes: 'EXACT 38 · COVERED 1 · MISS 1', leaked: '1 span · 12 bytes', benign: '0 of 14', twins: '5 of 5', unmeasured: 'None' },
  { key: 'e/beta', population: 'evidence-population', role: 'floors and gates', scanner: 'beta-scan', cases: '60', positives: '40', outcomes: 'EXACT 20 · MISS 20', leaked: '20 spans · 640 bytes', benign: '3 of 14', twins: '1 of 5', unmeasured: 'None' },
  { key: 'p/alpha', population: 'policy-population', role: 'policy route', scanner: 'alpha-lib', cases: '0', positives: '0', outcomes: 'No case in this population', leaked: 'No case', benign: 'No case', twins: 'No case', unmeasured: 'None' },
  { key: 'r/alpha', population: 'regression-population', role: 'gates', scanner: 'alpha-lib', cases: '4', positives: '2', outcomes: 'EXACT 2', leaked: '0 spans', benign: '0 of 1', twins: 'No pair', unmeasured: '1 pending' },
];

export const family: QualificationFamilyProps = {
  breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Qualification', href: '/evaluation/qualification/' }, { label: 'alpha-token' }],
  eyebrow: 'redact-secret · Evaluation · Qualification',
  title: 'alpha-token',
  lede: 'Taxonomy families: Alpha · API key. The status and its evidence, then what each scanner recorded per population.',
  meta: [{ label: 'View', value: 'public' }, { label: 'Policy revision', value: 'rs-policy-1:sha256:0123456789ab' }],
  status: {
    title: 'Support status of the product',
    note: 'The product’s qualification, derived by the adapter. It is not a scanner observation.',
    value: { word: 'Provisional', tone: 'review' },
    facts: [
      { term: 'Route', value: 'No route' },
      { term: 'Evidence tier', value: 'T1' },
      { term: 'Evidence basis', value: 'provider-documented' },
      { term: 'Fixture profile claimed', value: 'documented' },
    ],
    reasons: ['methods.notRun: metamorphic, mutation and differential did not run, so the family stays provisional.'],
    methodsNotRun: ['metamorphic', 'mutation', 'differential'],
  },
  evidence: {
    title: 'Evidence the status was judged on',
    description: 'Floors are read from the evidence population alone.',
    facts: [
      { term: 'Positive cases', value: '40' },
      { term: 'Positive context axes', value: '6' },
      { term: 'Benign controls', value: '14' },
      { term: 'Twin pairs', value: '5' },
    ],
  },
  gates: {
    title: 'Zero-tolerance gates',
    description: 'Each gate-bearing population is read on its own; the classifier receives the worst, never a sum.',
    rows: [{ key: 'e', population: 'evidence-population', twins: '0 of 5', benign: '0 of 14' }, { key: 'r', population: 'regression-population', twins: 'No pair', benign: '0 of 1' }],
  },
  observations: {
    title: 'Scanner observations',
    description: 'What each scanner recorded for this family, per population. These are counts, not a status.',
    rows: countsRows,
    empty: 'No scanner recorded a case for this family.',
  },
  cases: { title: 'Cases', description: 'Each case of the family, per population, with every scanner’s own word.', href: '/evaluation/qualification/families/alpha-token/cases/1/', label: 'Open the cases of alpha-token' },
};

export const unavailable: QualificationUnavailableProps = {
  breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Qualification' }],
  eyebrow: 'redact-secret · Evaluation',
  title: 'Qualification from the official runs',
  lede: 'The support status the adapter derived from one official evaluation run per population.',
  state: 'not-built',
  heading: 'Not measured: no qualification view was built',
  reason: 'public/results/qualification-v1.json is absent: no qualification view was built for this checkout.',
  commands: ['npm run official-runs:check', 'npm run qualification:view -- --artifacts <dir>'],
};

const identity = (population: string) => [
  { term: 'Evidence', value: 'example-evidence · snapshot-0000.00.00' },
  { term: 'Corpus digest', value: 'sha256:aaaaaaaaaaaa', code: true },
  { term: 'Semantic digest', value: 'sha256:bbbbbbbbbbbb', code: true },
  { term: 'Run class', value: 'public' },
  { term: 'Population', value: population },
];

const caseDetail = [
  { term: 'Path', value: 'alpha/alpha-token-in-prose/alpha-token-in-prose.md', code: true },
  { term: 'Corpus family', value: 'alpha:api-key' },
  { term: 'Taxonomy', value: 'Not recorded' },
  { term: 'Targets', value: 'None named' },
  { term: 'Twin of', value: 'Not a twin' },
  { term: 'Attribution', value: 'Named by the evidence snapshot' },
  { term: 'Product detector families', value: 'alpha-token' },
  { term: 'Expected spans', value: 'secret 61 to 101 (envelope 26 to 304)' },
  { term: 'alpha-lib', value: '1 span: EXACT · leaked 0 bytes · collateral 0 bytes · 1 finding reported' },
  { term: 'beta-scan', value: '1 span: MISS · leaked 40 bytes · collateral 0 bytes · 0 findings reported' },
];

export const caseRows: CaseRowProps[] = [
  { key: 'evidence-population/alpha--positive-1', id: 'alpha--positive-1', kind: 'must-redact', tier: 'T1', group: 'config-file', evidenceClass: 'provider-documented',
    cells: [{ scanner: 'alpha-lib', word: 'EXACT', state: 'measured' }, { scanner: 'beta-scan', word: 'MISS', state: 'measured' }], detail: caseDetail },
  { key: 'evidence-population/alpha--control-1', id: 'alpha--control-1', kind: 'must-not-flag', tier: 'T2', group: 'format-near-miss', evidenceClass: 'tool-corroborated',
    cells: [{ scanner: 'alpha-lib', word: 'Not flagged', state: 'measured' }, { scanner: 'beta-scan', word: 'Flagged · co-detected', state: 'measured' }], detail: caseDetail },
  { key: 'evidence-population/alpha--pending-1', id: 'alpha--pending-1', kind: 'must-redact', tier: 'T0', group: 'config-file', evidenceClass: 'Not recorded',
    cells: [{ scanner: 'alpha-lib', word: 'Pending', state: 'pending' }, { scanner: 'beta-scan', word: 'Not measured', state: 'not-measured' }], detail: caseDetail },
  { key: 'evidence-population/alpha--a-very-long-case-identifier-that-keeps-going-without-a-break-point-anywhere-at-all-0123456789', id: 'alpha--a-very-long-case-identifier-that-keeps-going-without-a-break-point-anywhere-at-all-0123456789', kind: 'policy', tier: 'T3', group: 'long-group-name-with-no-break', evidenceClass: 'Not recorded',
    cells: [{ scanner: 'alpha-lib', word: 'EXACT 2 · MISS 1', state: 'measured' }], detail: caseDetail },
];

export const caseSections: CaseSection[] = [
  { id: 'evidence-population', role: 'floors and gates', range: 'cases 1 to 4 of this population', identity: identity('evidence-population'), rows: caseRows },
  { id: 'regression-population', role: 'gates', range: 'cases 1 to 1 of this population', identity: identity('regression-population'), rows: [{ ...caseRows[0], key: 'regression-population/alpha--positive-1' }] },
];

export const cases: QualificationCasesProps = {
  breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Qualification', href: '/evaluation/qualification/' }, { label: 'alpha-token', href: '/evaluation/qualification/families/alpha-token/' }, { label: 'Cases' }],
  eyebrow: 'redact-secret · Evaluation · Qualification',
  title: 'Cases of alpha-token',
  lede: 'Every case the populations hold for this family, with what each scanner recorded.',
  meta: [{ label: 'View', value: 'public' }, { label: 'Policy revision', value: 'rs-policy-1:sha256:0123456789ab' }],
  note: { title: 'What these rows are', text: 'A row is one case of one population; the same id in two populations is two rows. The evidence class is the artifact’s own label and is not a support status.' },
  scanners: ['alpha-lib', 'beta-scan'],
  sections: caseSections,
  empty: 'No population holds a case in this scope.',
  pager: { page: 1, pageCount: 2, nextHref: '/evaluation/qualification/families/alpha-token/cases/2/' },
  back: { href: '/evaluation/qualification/families/alpha-token/', label: 'Back to alpha-token' },
};
