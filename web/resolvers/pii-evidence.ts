import type { PiiEvidenceComparison } from '../../benchmarks/evaluation/domains/pii/evidence-comparison.mjs';
import type { CoverageCell, CoverageTable, DomainViewData, StatusGroup } from '../components/evaluation/domain/types';
import { int } from './format';

const REPO = 'https://github.com/redact-secret/redact-secret-benchmarks';
const DIRECTORY = 'benchmarks/pii-evidence-comparison';
type Recorded = Extract<PiiEvidenceComparison, { state: 'recorded' }>;
type Metric = Recorded['metrics'][number]['baseline'];
type Outcome = Recorded['outcomes'][number]['baseline'];
const fixed = (value: { mantissa: number; scale: number }) => (value.mantissa / 10 ** value.scale).toFixed(value.scale);

export function evidenceMetricText(metric: Metric): string {
  const value = metric.value.state === 'measured'
    ? `point ${fixed(metric.value.point)}; bound ${fixed(metric.value.bound)}`
    : `Withheld: ${metric.value.reason}`;
  const c = metric.counts;
  return `${metric.status}; ${value}. Numerator ${int(c.numerator)}; measured ${int(c.measured)}; eligible ${int(c.eligible)}; effective N ${int(metric.effectiveN)}; unresolved ${int(c.unresolved)}; not measured ${int(c.notMeasured)}; not applicable ${int(c.notApplicable)}; total ${int(c.total)}.`;
}

export function evidenceOutcomeText(outcome: Outcome): string {
  const action = outcome.action.state === 'output-verified' ? `${outcome.action.state}: ${outcome.action.verification}` : outcome.action.state;
  return `Type: ${outcome.typeIdentity}; range: ${outcome.range}; sensitivity: ${outcome.sensitivityContext}; action: ${action}.`;
}

/** This population has its own denominators, including unresolved and withheld axes. */
export function resolvePiiEvidenceView(comparison: PiiEvidenceComparison): DomainViewData {
  const record = comparison.state === 'recorded' ? comparison : null;
  const columns = record?.candidate ? ['Published baseline', 'Candidate build'] : ['Published baseline'];
  const tables: CoverageTable[] = record ? [
    { id: 'evidence-metrics', caption: 'Scanner-neutral metrics for this population only', rowHeader: 'Metric', columns, rows: record.metrics.map(row => ({
      id: row.metric.id, label: row.metric.id, detail: 'Its own denominator; never pooled with another metric or population.',
      cells: [row.baseline, ...(row.candidate ? [row.candidate] : [])].map((metric): CoverageCell => ({ unavailableLabel: metric.status === 'not-measured' ? 'Not measured' : metric.status === 'not-applicable' ? 'Not applicable' : 'Withheld', figure: metric.value.state === 'measured' ? fixed(metric.value.point) : null, detail: evidenceMetricText(metric) })),
    })), note: 'A withheld value is not zero. Unresolved, not measured and not applicable remain separate recorded counts.' },
    { id: 'evidence-family-inventory', caption: 'Imported family membership, not family qualification', rowHeader: 'Mapped family', columns: ['Imported cases', 'Public variants'], rows: Object.entries(record.mappedFamilies).map(([family, counts]) => ({
      id: family, label: family, cells: [{ figure: int(counts.cases) }, { figure: int(counts.variants) }],
    })), note: 'These are import membership counts. Family metric projections are unavailable in this unprojected schema; no family support status follows.' },
    { id: 'evidence-losses', caption: 'Semantics the import did not preserve', rowHeader: 'Loss class', columns: ['Affected records'], rows: Object.entries(record.losses).map(([loss, number]) => ({ id: loss, label: loss, cells: [{ figure: int(number) }] })),
      note: 'Loss classes overlap. Do not add their counts; PHI and context claims stay pending until their semantics are faithfully represented.' },
    { id: 'evidence-outcomes', caption: record.candidate ? 'Paired public outcomes, one imported variant at a time' : 'Public outcomes, one imported variant at a time', rowHeader: 'Imported case', columns, rows: record.outcomes.map(row => ({
      id: row.variantId, label: row.caseId, detail: `${row.variantId}; ${row.family}; ${row.changed ? 'Recorded outcome differs' : 'Recorded outcome unchanged'}`,
      cells: [row.baseline, ...(row.candidate ? [row.candidate] : [])].map(outcome => ({ figure: evidenceOutcomeText(outcome) })),
    })), note: record.candidate ? 'Both sides read the same authored population. A changed outcome is descriptive, not a regression or promotion decision.' : 'The published product reads this authored population. No comparison or support promotion is implied.' },
  ] : [];
  const groups: StatusGroup[] = [{ title: 'Measurement record', rows: [{ id: 'evidence-record', label: 'Independent public population',
    status: record ? 'info' : 'not-measured', statusWord: record ? `${record.mode} measurement` : comparison.state === 'invalid' ? 'Unusable' : 'Not recorded',
    detail: record ? `Population ${record.population.id}; digest ${record.population.digest}; binding ${record.population.bindingDigest}; snapshot ${record.evidence.snapshot.id} (${record.evidence.snapshot.contentDigest}).` : comparison.state === 'recorded' ? '' : comparison.reason,
  }] }, { title: 'Qualification and unresolved semantics', rows: [
    { id: 'evidence-qualification', label: 'Product qualification', status: 'not-measured', statusWord: 'Not qualified', detail: 'This public measurement can be cited by its own population identity. It grants no support status and does not satisfy protected qualification.' },
    { id: 'evidence-family-metrics', label: 'Family metric projection', status: 'not-measured', statusWord: 'Unavailable', detail: record?.familyMetrics.reason ?? 'No verified artifact is recorded. No family rates are inferred from case outcomes.' },
    { id: 'evidence-phi-context', label: 'PHI and context claims', status: 'not-measured', statusWord: 'Pending', detail: 'Imported personal-data labels do not establish preserved PHI or context semantics. Lost axes remain pending.' },
    { id: 'evidence-protected', label: 'Protected evidence', status: 'not-measured', statusWord: 'Not operational', detail: 'The protected path does not gate this public population. No protected execution or membership is implied.' },
  ] }];
  if (record) groups.push({ title: 'Exact scanner and run identities', rows: [
    { id: 'evidence-baseline', label: 'Published baseline', status: 'info', statusWord: 'Recorded', detail: `${record.baseline.version}; source ${record.baseline.sourceCommit}; package tree ${record.baseline.packageTreeSha256}; artifact ${record.baseline.artifactDigest}; bytes ${record.baseline.artifactSha256}. Published npm provenance.` },
    ...(record.candidate ? [{ id: 'evidence-candidate', label: 'Candidate build artifact', status: 'info' as const, statusWord: 'Recorded', detail: `${record.candidate.version}; source ${record.candidate.sourceCommit}; package tree ${record.candidate.packageTreeSha256}; artifact ${record.candidate.artifactDigest}; bytes ${record.candidate.artifactSha256}. Artifact qualification is distinct from PII support qualification.` } ] : []),
    { id: 'evidence-engine', label: 'Measurement engine', status: 'info', statusWord: 'Recorded', detail: `Engine ${record.engine.commit}; binary ${record.engine.binarySha256}; importer ${record.importer.binarySha256}; platform ${record.engine.platform}. Mode ${record.mode}.` },
    { id: 'evidence-scanner', label: 'Scanner contract', status: 'info', statusWord: 'Validated', detail: `Protocol ${record.protocol.id} revision ${int(record.protocol.revision)}; artifact schema ${record.protocol.artifactSchema}; adapter ${record.scanner.adapter.id} ${record.scanner.adapter.version}, normalization ${int(record.scanner.adapter.normalizationVersion)}; configuration ${record.scanner.configurationDigest}; activation ${record.scanner.activationDigest}, selectors ${record.scanner.activation.join(', ')}.` },
    { id: 'evidence-historical', label: 'Historical bootstrap', status: 'info', statusWord: 'Descriptive only', detail: `${record.historical.version}, ${record.historical.platform}. ${record.historical.verdict}. No before/after verdict is inferred across platforms or packages.` },
  ] });
  if (record && 'workflow' in record.provenance) {
    const p = record.provenance;
    groups.push({ title: 'Canonical run provenance', rows: [{ id: 'evidence-run', label: 'Recorded execution', status: 'info', statusWord: 'Validated',
      detail: `Run ${String(p.workflow.runId)}, attempt ${String(p.workflow.runAttempt)}, head ${String(p.workflow.headSha)}; archive ${String(p.actionsArtifact.archiveSha256)}; receipt ${String(p.receipt.sha256)}.`,
      link: { label: 'Measurement workflow run', href: `${REPO}/actions/runs/${String(p.workflow.runId)}`, external: true },
    }] });
  }
  return {
    head: { domain: 'pii', eyebrow: 'Evaluation · Independent public population', title: 'PII evidence as its own population',
      lede: 'Public pii-evidence-derived measurement, separate from the four benchmark-owned populations. Every metric retains its own denominator.',
      meta: [{ label: 'Measurement', value: record ? record.mode : comparison.state === 'invalid' ? 'Unusable record' : 'Not recorded' }, { label: 'Qualification', value: 'Not qualified' }],
      pair: [{ label: 'Benchmark-owned PII', href: '/evaluation/pii/' }, { label: 'Independent evidence', href: '/evaluation/pii/evidence/' }], currentHref: '/evaluation/pii/evidence/', pairLabel: 'PII population source',
      breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Personal data', href: '/evaluation/pii/' }, { label: 'Independent evidence' }], },
    glance: [
      { label: 'Public variants', value: record ? int(record.counts.corpusVariants) : null, detail: 'Imported variants, one public evidence population. No benchmark-owned cases are added.' },
      { label: 'Authored source and import', value: record ? `${int(record.counts.evidenceCases)} source cases / ${int(record.counts.corpusCases)} imported cases` : null, detail: 'Source cases and imported cases are different grains, not a combined denominator.' },
      { label: 'Without a located range', value: record ? int(record.counts.rangeLessOccurrences) : null, detail: 'Recorded import limitations remain explicit, never treated as a resolved range.' },
    ],
    method: { title: 'How this population is read', steps: [
      { title: 'Bind', text: 'The strict consumer verifies the released source snapshot, imported population, scanner packages and artifact byte digests.' },
      { title: 'Measure', text: record && !record.candidate ? 'The published baseline reads the exact imported variants. Scanner identity and replay agreement are verified.' : 'Published baseline and candidate build read the same imported variants. Scanner identity and replay agreement are verified.' },
      { title: 'Preserve', text: 'Each metric retains its numerator, denominator, interval bound and withheld states. Authored expectations do not come from scanner output.' },
    ], vocabularies: [{ title: 'Withheld and unresolved states', rows: [
      { word: 'Unresolved', meaning: 'The authored assertion is unresolved; its own recorded count remains visible.' },
      { word: 'Not measured', meaning: 'The axis was not measured. No zero or support conclusion is supplied.' },
      { word: 'Not applicable', meaning: 'The metric or axis does not apply to that authored input.' },
    ] }], oracle: [{ term: 'Independent authorship', text: 'The pinned pii-evidence source supplies authored truth. The import records its representational losses.' }],
      methods: [{ term: 'One population', text: 'The imported population remains independently addressable. It is never pooled with the four benchmark-owned populations.' }],
      metrics: { summary: 'Scanner-neutral metric cells', text: 'Each metric defines its own denominator; no total or percentage combines populations.', rows: [] },
      recorded: { title: 'Measurement does not qualify support', text: 'supportClaims is false and qualified is false. Product qualification may cite this evidence explicitly, while unmet protected and semantic gates remain pending.' }, },
    coverage: { title: 'Recorded public evidence', mode: record ? `${record.mode}; this pii-evidence-derived population only.` : 'No verified comparison is recorded, so no measurement count is shown.',
      tables: record ? tables : [{ id: 'evidence-unavailable', caption: 'Independent public evidence', text: comparison.state === 'invalid' ? 'The record failed identity validation. No partial measurements are shown.' : 'No verified comparison record is present.', issue: { number: 839, href: `${REPO}/issues/839` } }],
      columnKey: [], scope: [{ term: 'Population boundary', text: 'Source cases, imported cases, variants, occurrences and metric denominators are distinct grains. Counts from other populations are never added.' }], },
    status: { title: 'Where this population stands', groups, links: [{ label: 'Benchmark-owned PII populations', href: '/evaluation/pii/' }] },
    reading: { title: 'How to read this record', items: [
      { term: 'Independent denominator', text: 'Every displayed value belongs only to this pinned population and its scanner. There is no cross-population total.' },
      { term: 'Import losses', text: 'Loss classes can overlap. A mapped family is an import label, not proof that all of its original PHI or context semantics survived.' },
      { term: 'Absent and invalid', text: 'Absent means not recorded. Invalid means unusable. Neither state supplies measurement values.' },
    ], sources: ['plan', 'population-index', ...(record ? ['receipt'] : []), ...(record?.mode === 'official' ? ['record'] : [])].map(name => ({ label: `${name} source`, path: `${DIRECTORY}/${name}.json`, href: `${REPO}/blob/develop/${DIRECTORY}/${name}.json` })), },
  };
}

/** Change and unresolved counts overlap: an unresolved result can also change. */
export function resolvePiiOutcomeSummary(comparison: PiiEvidenceComparison) {
  if (comparison.state !== 'recorded' || !comparison.candidate) return null;
  const unresolved = (outcome: Outcome) => [outcome.typeIdentity, outcome.range, outcome.sensitivityContext, outcome.action.state].includes('unresolved');
  const project = (outcome: Outcome) => ({ typeIdentity: outcome.typeIdentity, range: outcome.range, sensitivityContext: outcome.sensitivityContext, action: { state: outcome.action.state, ...(outcome.action.verification ? { verification: outcome.action.verification } : {}) } });
  const names: Record<string, string> = { 'pii:global:email': 'Email address', 'pii:us:ssn': 'US Social Security number', 'pii:global:phone': 'Phone number' };
  const rows = comparison.outcomes.map((row, index) => ({
    id: row.variantId,
    label: `${names[row.family] ?? row.family.replace(/^pii:/, '').split(':').reverse().join(' · ')} · variant ${index + 1}`,
    changed: row.changed,
    unresolved: unresolved(row.baseline) || (row.candidate ? unresolved(row.candidate) : false),
    caseId: row.caseId,
    variantId: row.variantId,
    baseline: project(row.baseline),
    candidate: project(row.candidate!),
  }));
  return {
    total: int(rows.length), changed: int(rows.filter(row => row.changed).length),
    unchanged: int(rows.filter(row => !row.changed).length), unresolved: int(rows.filter(row => row.unresolved).length),
    baselineVersion: comparison.baseline.version, candidateVersion: comparison.candidate.version,
    baselineRevision: comparison.baseline.sourceCommit.slice(0, 12), candidateRevision: comparison.candidate.sourceCommit.slice(0, 12), rows,
  };
}
