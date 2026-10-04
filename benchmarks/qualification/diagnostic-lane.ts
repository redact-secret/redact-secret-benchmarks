import { bindingProblems, OUTCOMES, type EvidencePin, type Outcome, type RunArtifact } from './run-artifact.ts';

/**
 * The fast product-candidate diagnostic lane (#705), beside the full official run (docs/specs/official-runs.md, "The diagnostic lane").
 *
 * A diagnostic run answers "what did this product candidate do on the product populations" without waiting for the slow peers. It is an
 * EXPLORATORY engine run (`run_class: exploratory`, so `publication: internal`) over a configuration that names only the selected scanners,
 * with the evidence binding still verified by the engine. It cannot pass `bindingProblems` (which reads official artifacts only), is never
 * recorded in `runs[]`, never archived and never read by the qualification adapter. Whatever needs a scanner that did not run is stated as
 * unavailable here, never inferred.
 */
export const DIAGNOSTIC_SCHEMA = 'redact-secret-benchmarks/diagnostic-summary/v1';
export const DIAGNOSTIC_PRODUCT_SCANNER = 'redact-secret';
/** Methods the full run makes for the floors population, and what each needs. Differential compares the product with its peers. */
export const METHOD_REQUIREMENTS: Record<string, { needsPeers: boolean; reason: string }> = {
  differential: { needsPeers: true, reason: 'compares the product with the peer scanners; no peer ran' },
  metamorphic: { needsPeers: false, reason: 'not run: the diagnostic lane measures the plain populations only' },
  mutation: { needsPeers: false, reason: 'not run: the diagnostic lane measures the plain populations only' },
};

interface RunConfig { scanners: { id: string }[]; [key: string]: unknown }

/** The pinned configuration restricted to the selected scanners. Everything else, including each scanner's pin, is the engine's own. */
export function selectedScannerConfig<C extends RunConfig>(config: C, selected: string[]): C {
  const known = config.scanners.map(s => s.id);
  const unknown = selected.filter(id => !known.includes(id));
  if (unknown.length) throw new Error(`the configuration has no scanner ${unknown.join(', ')}`);
  if (!selected.includes(DIAGNOSTIC_PRODUCT_SCANNER)) throw new Error(`a diagnostic run selects the product scanner ${DIAGNOSTIC_PRODUCT_SCANNER}`);
  return { ...config, scanners: config.scanners.filter(s => selected.includes(s.id)) };
}

/** `--scanners a,b` parsed and checked against the registry's scanners; the product scanner is always part of it. */
export function parseSelectedScanners(value: string | undefined, registryIds: string[]): string[] {
  const ids = [...new Set((value ?? DIAGNOSTIC_PRODUCT_SCANNER).split(',').map(s => s.trim()).filter(Boolean))].sort();
  const unknown = ids.filter(id => !registryIds.includes(id));
  if (unknown.length) throw new Error(`unknown scanner ${unknown.join(', ')}; the registry pins ${registryIds.join(', ')}`);
  if (!ids.includes(DIAGNOSTIC_PRODUCT_SCANNER)) throw new Error(`--scanners must include ${DIAGNOSTIC_PRODUCT_SCANNER}`);
  return ids;
}

export interface ProductPin { id: string; version: string; integrity?: string }

/**
 * Binding of a diagnostic artifact. The evidence, engine, protocol and completeness checks are the official ones; what differs is the class
 * (exploratory and internal, never official) and the scanner set (exactly the selected ones, and the product is the pinned candidate build:
 * a wrong candidate tarball, engine or evidence still fails).
 */
export function diagnosticBindingProblems(artifact: RunArtifact, pin: EvidencePin, options: { engineVersion: string; protocol: string; selected: string[]; product: ProductPin }): string[] {
  const m = artifact.manifest;
  const problems = bindingProblems(artifact, pin, { engineVersion: options.engineVersion, protocol: options.protocol })
    .filter(p => !p.startsWith('run_class is '));
  if (m.run_class !== 'exploratory') problems.push(`run_class is ${m.run_class ?? 'absent'}, a diagnostic run is exploratory`);
  if (m.publication !== 'internal') problems.push(`publication is ${m.publication ?? 'absent'}, a diagnostic artifact is internal`);
  const ran = m.scanners.map(s => s.id).sort().join(',');
  if (ran !== [...options.selected].sort().join(',')) problems.push(`the artifact has scanners ${ran}, the selection is ${[...options.selected].sort().join(',')}`);
  if (m.methods.length) problems.push('the artifact ran methods; the diagnostic lane measures none');
  const product = m.scanners.find(s => s.id === options.product.id);
  if (!product) problems.push(`the artifact has no ${options.product.id} scanner`);
  else {
    if (product.version !== options.product.version) problems.push(`${options.product.id} is ${product.version ?? 'unversioned'}, the registry pins ${options.product.version}`);
    const integrity = product.provenance?.components?.find(c => c.kind === 'npm-package')?.integrity;
    if (options.product.integrity && integrity !== options.product.integrity) problems.push(`${options.product.id} package integrity ${integrity ?? 'absent'} differs from the registry pin`);
  }
  return problems;
}

export interface PopulationOutcomes {
  population: string; cases: number;
  /** Span outcomes of the product scanner over must-redact and policy cases, plus controls it flagged. Counts only; no value of any case. */
  outcomes: Record<Outcome, number>; controlsFlagged: number; pending: number; notMeasured: number;
  /** Case ids (synthetic fixture ids, never values) with a leaking or overbroad outcome, or a flagged control. */
  nonExactCases: string[];
}

export function outcomesOf(artifact: RunArtifact, population: string, scannerId = DIAGNOSTIC_PRODUCT_SCANNER): PopulationOutcomes {
  const run = artifact.scanners.find(s => s.scanner === scannerId);
  const out: PopulationOutcomes = { population, cases: 0, outcomes: Object.fromEntries(OUTCOMES.map(o => [o, 0])) as Record<Outcome, number>, controlsFlagged: 0, pending: 0, notMeasured: 0, nonExactCases: [] };
  for (const c of run?.cases ?? []) {
    out.cases++;
    const me = c.measurement;
    if (me.type === 'positive') {
      for (const o of me.span_outcomes) out.outcomes[o]++;
      if (me.span_outcomes.some(o => o !== 'EXACT' && o !== 'COVERED')) out.nonExactCases.push(c.case_id);
    } else if (me.type === 'control') {
      if (me.flagged) { out.controlsFlagged++; out.nonExactCases.push(c.case_id); }
    } else if (me.type === 'pending') out.pending++;
    else out.notMeasured++;
  }
  out.nonExactCases.sort();
  return out;
}

export interface DiagnosticScope {
  populations: string[]; selected: string[]; registryScanners: string[]; engine: string; evidence: Record<string, string>;
}

/** The scope a reader needs before any number: what ran, what did not, and what is therefore unavailable. */
export function diagnosticSummary(scope: DiagnosticScope, outcomes: PopulationOutcomes[], methodIds: string[]) {
  const missing = scope.registryScanners.filter(id => !scope.selected.includes(id));
  const unavailable = methodIds.map(id => ({
    method: id,
    state: 'unavailable' as const,
    reason: METHOD_REQUIREMENTS[id]?.needsPeers && missing.length ? `${METHOD_REQUIREMENTS[id].reason} (missing: ${missing.join(', ')})` : (METHOD_REQUIREMENTS[id]?.reason ?? 'not run by the diagnostic lane'),
  }));
  return {
    schema: DIAGNOSTIC_SCHEMA,
    mode: 'diagnostic' as const,
    classification: { runClass: 'exploratory', publication: 'internal', promotion: 'disallowed', officialAcceptance: 'never', note: 'Exploratory and internal. Not an official run: it is never recorded in the registry, archived, read by the qualification adapter or promoted.' },
    scope: { ...scope, missingScanners: missing },
    comparison: missing.length
      ? { state: 'unavailable', reason: `No peer ran (${missing.join(', ')}); a peer-dependent or differential result is not inferred.` }
      : { state: 'available', reason: 'Every registry scanner ran.' },
    methods: unavailable,
    populations: outcomes,
  };
}

export type DiagnosticSummary = ReturnType<typeof diagnosticSummary>;

export function renderDiagnosticSummary(s: DiagnosticSummary): string {
  const lines = [
    `### Diagnostic run (${s.scope.populations.join(', ')})`,
    '',
    '**Exploratory and internal. Not an official run; promotion is disallowed.**',
    '',
    `- Engine: ${s.scope.engine}`,
    `- Scanners run: ${s.scope.selected.join(', ')}`,
    `- Scanners not run: ${s.scope.missingScanners.join(', ') || 'none'}`,
    `- Peer comparison: ${s.comparison.state}. ${s.comparison.reason}`,
    ...s.methods.map(m => `- Method ${m.method}: ${m.state}. ${m.reason}`),
    '',
    '| Population | Cases | EXACT | COVERED | OVERBROAD | PARTIAL | MISS | Controls flagged | Pending | Not measured |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...s.populations.map(p => `| ${p.population} | ${p.cases} | ${OUTCOMES.map(o => p.outcomes[o]).join(' | ')} | ${p.controlsFlagged} | ${p.pending} | ${p.notMeasured} |`),
    '',
  ];
  for (const p of s.populations) if (p.nonExactCases.length) lines.push(`${p.population}: ${p.nonExactCases.length} case(s) to look at: ${p.nonExactCases.slice(0, 50).join(', ')}${p.nonExactCases.length > 50 ? ', …' : ''}`, '');
  return `${lines.join('\n')}\n`;
}

/** A run record of a diagnostic run is never an official run record. */
export function diagnosticRecordProblem(record: { schema?: string; mode?: string }): string | null {
  return record.mode === 'diagnostic' || record.schema === 'redact-secret-benchmarks/diagnostic-record/v1'
    ? 'a diagnostic record is exploratory and internal; it is never recorded in the official run registry'
    : null;
}
