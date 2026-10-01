/**
 * Pure resolvers for the qualification pages (#606): the raw view (`services/qualification.ts`) in, block props out. All
 * formatting is here. Nothing is summed across populations or scanners, a population with no case for a family says so, and
 * a gate that did not run is "not measured", never a zero. The support status is the adapter's: it is displayed, never derived.
 */
import type { QualificationOverviewProps, QualificationFamilyProps, QualificationUnavailableProps, StatusWord, CountsRow, FamilyRow, GapRow } from '../components/qualification/types';
import type { FamilyView, PopulationSlice, QualificationLoad, QualificationView, ScannerCounts } from '../services/qualification';
import { QUALIFICATION_COMMANDS, QUALIFICATION_FILE } from '../lib/qualification';
import { int } from './format';

export const QUALIFICATION_HREF = '/evaluation/qualification/';
export const qualificationFamilyHref = (family: string): string => `${QUALIFICATION_HREF}families/${family}/`;

const PRODUCT = 'redact-secret';
const shortDigest = (digest: string): string => {
  const [algorithm, hex] = digest.split(':');
  return hex ? `${algorithm}:${hex.slice(0, 12)}` : digest.slice(0, 19);
};
/** `rs-policy-1:sha256:<64 hex>` as `rs-policy-1:sha256:<12 hex>`. */
const shortRevision = (revision: string): string => {
  const [prefix, algorithm, hex] = revision.split(':');
  return hex ? `${prefix}:${algorithm}:${hex.slice(0, 12)}` : revision;
};
const ROLE: Record<string, string> = { 'floors-and-gates': 'floors and gates', gates: 'gates', 'policy-route': 'policy route' };
const role = (id: string): string => ROLE[id] ?? id;
const sentence = (word: string): string => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;

const STATUS_TONE: Record<string, StatusWord['tone']> = { stable: 'info', provisional: 'review', pending: 'none', unsupported: 'none' };
const statusWord = (value: string): StatusWord => ({ word: sentence(value), tone: STATUS_TONE[value] ?? 'none' });

/** The code of a status reason (the text before the first colon or dash), in words where the adapter's own code is a known one. */
const reasonCode = (reason: string): string => reason.split(/\s[—-]\s|:/)[0].trim();
const holdLabel = (code: string): string => (code === 'methods.notRun' ? 'methods not run' : code);

const providerOf = (family: FamilyView): string => family.taxonomyFamilies.find(t => t.provider)?.provider ?? 'No provider';
const productCounts = (slice: PopulationSlice): ScannerCounts | undefined => slice.scanners.find(s => s.scanner === PRODUCT)?.counts;

function modeLine(view: QualificationView): string {
  const builds = view.populations.map(p => p.artifact.scanners.find(s => s.id === PRODUCT));
  const version = [...new Set(builds.map(b => b?.version).filter(Boolean))].join(' / ') || 'version not recorded';
  const released = builds.length > 0 && builds.every(b => b?.build === 'released');
  const candidate = builds.some(b => b?.build === 'candidate');
  const mode = released ? 'Published release' : candidate ? 'Candidate build' : 'Build not recorded';
  return `${mode} · ${PRODUCT} ${version} · ${view.publication === 'public' ? 'public view' : 'internal view'}`;
}

const spansOf = (c: ScannerCounts): number => c.positives['must-redact'].spans + c.positives.policy.spans;
const outcomesOf = (c: ScannerCounts): string => {
  const total: Record<string, number> = {};
  for (const kind of ['must-redact', 'policy'] as const) for (const [outcome, n] of Object.entries(c.positives[kind].outcomes)) total[outcome] = (total[outcome] ?? 0) + n;
  const parts = ['EXACT', 'COVERED', 'OVERBROAD', 'PARTIAL', 'MISS'].filter(o => (total[o] ?? 0) > 0).map(o => `${o} ${int(total[o])}`);
  return parts.length ? parts.join(' · ') : 'No positive span';
};
const unmeasuredOf = (c: ScannerCounts): string => {
  const parts = [c.pending ? `${int(c.pending)} pending` : '', c.notMeasured ? `${int(c.notMeasured)} not measured` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'None';
};

export function resolveQualificationOverview(view: QualificationView): QualificationOverviewProps {
  const methodsNotRun = [...new Set(view.families.flatMap(f => f.status.methodsNotRun))].sort();
  const populationNames = view.populations.map(p => p.population);
  const familyRows: FamilyRow[] = view.families.map(f => {
    const codes = [...new Set(f.status.reasons.map(reasonCode))];
    const shown = codes.slice(0, 3).map(holdLabel);
    return {
      family: f.family,
      href: qualificationFamilyHref(f.family),
      provider: providerOf(f),
      status: statusWord(f.status.value),
      route: f.status.qualificationProfile ?? 'No route',
      tier: f.status.evidenceTier ?? 'Not recorded',
      basis: f.status.evidenceBasis ?? 'Not recorded',
      heldBy: codes.length > 3 ? [...shown, `${int(codes.length - 3)} more`] : shown,
      cases: f.populations.map(slice => { const c = productCounts(slice); return `${slice.population} ${c ? int(c.cases) : 'not recorded'}`; }),
    };
  });
  const gapRows: GapRow[] = view.knownGaps.map(g => ({
    id: g.id,
    title: g.number ? `Issue #${int(g.number)}` : 'No issue number',
    status: g.status,
    kind: g.kind ?? 'Not recorded',
    matched: populationNames.map(population => ({ population, hit: g.fixtures.filter(f => f.matches.some(m => m.population === population)).length })).filter(x => x.hit > 0).map(x => `${x.population} ${int(x.hit)} of ${int(g.fixtures.length)} fixtures`),
    fixtures: g.fixtures.map(f => ({ fixture: f.fixture, matches: f.matches.map(m => `${m.population} · ${m.measurement}${m.flagged === null ? '' : m.flagged ? ' · flagged' : ' · not flagged'}${m.outcomes ? ` · ${m.outcomes.join(', ')}` : ''}`) })),
  }));
  return {
    breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Qualification' }],
    eyebrow: 'redact-secret · Evaluation',
    title: 'Qualification from the official runs',
    lede: 'The support status the adapter derived from one official evaluation run per population. It is built beside the existing report, which stays the reference until cutover.',
    meta: [{ label: 'Publication', value: view.publication }, { label: 'Policy revision', value: shortRevision(view.policy.revision) }],
    boundary: {
      title: 'Read this before the numbers',
      paragraphs: [
        'The evaluation engine measures and records; it emits no support status. The status shown here is this benchmark’s own qualification of the product, derived from the engine’s results by the adapter. A scanner’s observation is shown on its own and carries no status.',
        'Every count carries its population. No figure is a sum across populations or scanners, and a gate that did not run is shown as not measured, never as zero.',
      ],
    },
    summary: {
      title: 'Support status of the detector families',
      description: 'One count per recorded status, over the families the product qualification scores.',
      mode: modeLine(view),
      tiles: [
        { label: 'Stable', value: int(view.distribution.stable ?? 0), definition: 'Every stable floor holds in this view.' },
        { label: 'Provisional', value: int(view.distribution.provisional ?? 0), definition: 'A detector exists and a floor, or a required method, does not hold yet.' },
        { label: 'Pending', value: int(view.distribution.pending ?? 0), definition: 'No positive fixture has cleared review.' },
        { label: 'Unsupported', value: int(view.distribution.unsupported ?? 0), definition: 'Recorded as unsupported.' },
      ],
      routes: [
        { label: 'Stable by documented route', value: int(view.stableDistribution.documented ?? 0), definition: 'Provider-documented format.' },
        { label: 'Stable by empirical route', value: int(view.stableDistribution.empirical ?? 0), definition: 'Independently corroborated format.' },
        { label: 'Stable by policy-qualified route', value: int(view.stableDistribution['policy-qualified'] ?? 0), definition: 'Project policy with a protected holdout.' },
      ],
      methodsNote: methodsNotRun.length ? `The official configuration did not run ${methodsNotRun.join(', ')}. A family whose floors all hold stays provisional until every required method has run, so the stable count here is not comparable with a run that executed them.` : null,
    },
    identity: {
      title: 'Identity of this view',
      items: [
        { term: 'View schema', value: view.schema, code: true },
        { term: 'Adapter', value: `${view.adapter.id} v${view.adapter.version}` },
        { term: 'Product policy revision', value: view.policy.revision, code: true },
        { term: 'Methods the policy requires', value: view.policy.methodsRequired.join(', ') || 'None' },
        { term: 'Policy inputs', value: `${int(view.policy.components.length)} benchmark-owned files and tables, each digested in the revision` },
        { term: 'Source file', value: QUALIFICATION_FILE, code: true },
      ],
    },
    populations: {
      title: 'Populations',
      description: 'Each population is its own run with its own denominator, evidence and run identity. Counts are never added together.',
      rows: view.populations.map(p => ({
        id: p.population,
        role: role(p.role),
        runClass: p.runClass,
        evidence: `${p.artifact.evidence.source}${p.artifact.evidence.release ? ` · ${p.artifact.evidence.release.tag}` : ''}`,
        corpusDigest: shortDigest(p.artifact.evidence.corpus_digest),
        configHash: shortDigest(p.artifact.configHash),
        semanticDigest: shortDigest(p.artifact.semanticDigest),
        engine: `${p.artifact.engine.name} ${p.artifact.engine.version} · ${p.artifact.protocolVersion}`,
        methods: p.artifact.methods.length ? p.artifact.methods.join(', ') : 'None run',
        cases: int(p.artifact.caseCount),
      })),
    },
    scanners: {
      title: 'Scanners',
      description: 'The scanners each population ran with, as the run artifact recorded them.',
      rows: view.populations.flatMap(p => p.artifact.scanners.map(s => ({ key: `${p.population}/${s.id}`, population: p.population, scanner: s.id, version: s.version ?? 'Not recorded', build: s.build ?? 'Not recorded', mode: s.mode }))),
    },
    families: {
      title: 'Detector families',
      description: 'One row per family the product qualification scores. Open one for its evidence and what each scanner recorded.',
      rows: familyRows,
      undetected: {
        title: 'Taxonomy families with no detector',
        text: view.undetected.length ? `${int(view.undetected.length)} families in the taxonomy have no detector, so no status is derived for them.` : 'Every taxonomy family has a detector.',
        items: view.undetected.map(u => u.id),
      },
    },
    gaps: { title: 'Known-gap inputs', description: 'Each record’s fixtures matched to cases by id, per population. A public fixture keeps its legacy id until the re-key, so it matches nothing here.', rows: gapRows },
  };
}

/** Every family the view scores, for the static export to pre-render. */
export const qualificationSlugs = (view: QualificationView): string[] => view.families.map(f => f.family);

const fact = (term: string, value: string, code = false) => ({ term, value, ...(code ? { code } : {}) });
const measured = (family: FamilyView, field: string, method?: string): string => {
  if (method && family.status.methodsNotRun.includes(method)) return 'Not measured';
  const value = family.evidence[field];
  return typeof value === 'number' ? int(value) : 'Not recorded';
};

export function resolveQualificationFamily(view: QualificationView, slug: string): QualificationFamilyProps | null {
  const family = view.families.find(f => f.family === slug);
  if (!family) return null;
  const floors = view.populations.find(p => p.role === 'floors-and-gates')?.population;
  const profile = family.fixtureProfile;
  const rows: CountsRow[] = family.populations.flatMap(slice => slice.scanners.map(({ scanner, counts: c }) => {
    const none = c.cases === 0;
    return {
      key: `${slice.population}/${scanner}`,
      population: slice.population,
      role: role(slice.role),
      scanner,
      cases: int(c.cases),
      positives: none ? 'No case' : int(spansOf(c)),
      outcomes: none ? 'No case in this population' : outcomesOf(c),
      leaked: none || spansOf(c) === 0 ? 'No positive span' : `${int(c.positives['must-redact'].leakedSpans + c.positives.policy.leakedSpans)} spans · ${int(c.positives['must-redact'].leakedBytes + c.positives.policy.leakedBytes)} bytes`,
      benign: c.benign.cases === 0 ? 'No control' : `${int(c.benign.flagged)} of ${int(c.benign.cases)}`,
      twins: c.twins.pairs === 0 ? 'No pair' : `${int(c.twins.discriminated)} of ${int(c.twins.pairs)}`,
      unmeasured: unmeasuredOf(c),
    };
  }));
  return {
    breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Qualification', href: QUALIFICATION_HREF }, { label: family.family }],
    eyebrow: 'redact-secret · Evaluation · Qualification',
    title: family.family,
    lede: `Taxonomy families: ${family.taxonomyFamilies.map(t => `${t.provider ?? 'No provider'} · ${t.name}`).join('; ') || 'none'}. The status and its evidence, then what each scanner recorded per population.`,
    meta: [{ label: 'View', value: view.publication }, { label: 'Policy revision', value: shortRevision(view.policy.revision) }],
    status: {
      title: 'Support status of the product',
      note: 'The product’s qualification, derived by the adapter. It is not a scanner observation.',
      value: statusWord(family.status.value),
      facts: [
        fact('Route', family.status.qualificationProfile ?? 'No route'),
        fact('Evidence tier', family.status.evidenceTier ?? 'Not recorded'),
        fact('Evidence basis', family.status.evidenceBasis ?? 'Not recorded'),
        fact('Contract tier', family.contract.tier ?? 'Not recorded'),
        fact('Fixture profile claimed', profile?.claimed ?? 'Not recorded'),
        fact('Fixture profile cells met', profile?.cellsMet.length ? profile.cellsMet.join(', ') : 'None'),
      ],
      reasons: family.status.reasons,
      methodsNotRun: family.status.methodsNotRun,
    },
    evidence: {
      title: 'Evidence the status was judged on',
      description: floors ? `Floors and fixture-profile cells are read from ${floors} alone; a gate reads each gate-bearing population on its own.` : 'No population in this view carries floors.',
      facts: [
        fact('Scored cases', measured(family, 'totalFixtures')),
        fact('Positive cases', measured(family, 'positiveCases')),
        fact('Positive context axes', measured(family, 'positiveAxes')),
        fact('Benign controls', measured(family, 'benignCases')),
        fact('Benign control axes', measured(family, 'benignAxes')),
        fact('Twin pairs', measured(family, 'twinPairs')),
        fact('Metamorphic critical failures', measured(family, 'metamorphicCriticalFailures', 'metamorphic')),
        fact('Mutation unresolved critical', measured(family, 'mutationUnresolvedCritical', 'mutation')),
        fact('Differential unresolved disagreements', measured(family, 'differentialUnresolvedContractDisagreements', 'differential')),
      ],
    },
    gates: {
      title: 'Zero-tolerance gates',
      description: 'The classifier receives the worst gate-bearing population, never a sum. Each population is shown on its own.',
      rows: family.gates.map(g => ({
        key: g.population,
        population: g.population,
        twins: g.twinPairs === 0 ? 'No pair' : `${int(g.twinFailures)} of ${int(g.twinPairs)}`,
        benign: g.benignCases === 0 ? 'No control' : `${int(g.benignFalseAlarms)} of ${int(g.benignCases)}`,
      })),
    },
    observations: {
      title: 'Scanner observations',
      description: 'What each scanner recorded for this family, per population. These are counts and carry no support status; a case that is pending or not measured is not a miss.',
      rows,
      empty: 'No scanner recorded a case for this family.',
    },
  };
}

/** The page for a view that cannot be shown: which state, why, and the commands that produce a usable one. */
export function resolveQualificationUnavailable(load: Exclude<QualificationLoad, { state: 'ready' }>): QualificationUnavailableProps {
  const heading = { 'not-built': 'Not measured: no qualification view was built', incompatible: 'Not shown: the qualification view cannot be read', stale: 'Not shown: the qualification view was not built from this checkout' }[load.state];
  return {
    breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Qualification' }],
    eyebrow: 'redact-secret · Evaluation',
    title: 'Qualification from the official runs',
    lede: 'The support status the adapter derived from one official evaluation run per population. This build has no usable view, so it shows no number.',
    state: load.state,
    heading,
    reason: load.reason,
    commands: QUALIFICATION_COMMANDS,
  };
}
