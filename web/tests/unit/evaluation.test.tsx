/**
 * The Evaluation section: the pure resolvers (hub and the six method pages), the blocks they feed and the
 * navigation. Every assertion is about structure or about what the resolver derives from the synthetic report in
 * `evaluation-data.ts`; none reads a count from the committed ledger or the run, so a repin cannot break them.
 */
import './next-mocks';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { EvaluationHub } from '../../components/evaluation/hub';
import { MethodPage } from '../../components/evaluation/methods';
import type { EvidenceCell, MethodPageProps, MethodRecordedData } from '../../components/evaluation/methods';
import { EVALUATION_PHASES, SECTIONS, isCurrentEntry } from '../../lib/routes';
import { METHOD_IDS, isMethodId, methodHref } from '../../lib/methods';
import { resolveEvaluationHub, resolvePhases } from '../../resolvers/evaluation-hub';
import { resolveMethodPage, type MethodInput } from '../../resolvers/evaluation-methods';
import { HUB_COPY, METHOD_COPY } from '../../resolvers/evaluation-copy';
import type { EvaluationReport } from '../../../benchmarks/shared/evaluation-types.ts';
import { evidenceOf, syntheticQualification, syntheticReport } from './evaluation-data';

const suites = new Map([['suite-a', 'Suite A']]);
/** A method page input from a full synthetic report; `report: undefined` is "no evaluation", as the service says it. */
const input = ({ report = syntheticReport(), ...over }: Partial<Omit<MethodInput, 'report' | 'casesOf' | 'peerReviews'>> & { report?: EvaluationReport } = {}, absent = false): MethodInput => ({
  ...(absent ? {} : evidenceOf(report)), qualification: { state: 'recorded', source: 'run', report: syntheticQualification() }, suites, ...over,
});
const recorded = (page: MethodPageProps): MethodRecordedData => {
  if (page.recorded.state !== 'recorded') throw new Error('this page has no recorded section: the input lacks what it reads');
  return page.recorded;
};
const rowsOf = (page: MethodPageProps) => recorded(page).groups.flatMap(g => g.rows);
const cell = (page: MethodPageProps, rowKey: string, scanner: string): EvidenceCell => {
  const col = recorded(page).columns.findIndex(c => c.id === scanner);
  const row = rowsOf(page).find(r => r.key === rowKey);
  if (col < 0 || !row) throw new Error(`no cell for ${rowKey} / ${scanner}`);
  return row.cells[col];
};

describe('method ids and routes', () => {
  test('the six methods have one page each, and the nav entry stands for all of them', () => {
    expect(METHOD_IDS).toHaveLength(6);
    expect(isMethodId('twin')).toBe(true);
    expect(isMethodId('nope')).toBe(false);
    const evaluation = SECTIONS.find(s => s.href === '/evaluation/')!;
    const methods = evaluation.entries.find(e => e.match === '/evaluation/method/')!;
    for (const id of METHOD_IDS) expect(isCurrentEntry(methods, methodHref(id))).toBe(true);
    expect(isCurrentEntry(methods, '/evaluation/')).toBe(false);
    expect(isCurrentEntry(evaluation.entries[0], '/evaluation')).toBe(true);
  });

  test('every method has copy, and the three steps are the same labels on every page', () => {
    for (const id of METHOD_IDS) {
      const page = resolveMethodPage(id, input());
      expect(page.how.steps.map(s => s.label)).toEqual(['Input', 'Change', 'Check']);
      expect(page.title).toBe(METHOD_COPY[id].name);
      expect(page.switcher.map(s => s.href)).toEqual(METHOD_IDS.map(methodHref));
      expect(page.currentHref).toBe(methodHref(id));
      expect(page.read.rules.length).toBeGreaterThan(0);
    }
  });
});

describe('twin', () => {
  const page = resolveMethodPage('twin', input());

  test('counts the pair and its two sides per scanner, with the scanner that did not run as not measured', () => {
    expect(recorded(page).columns.map(c => c.id)).toEqual(['redact-secret', 'peer-a', 'peer-b']);
    expect(rowsOf(page).map(r => r.key)).toEqual(['pair', 'positive', 'negative']);
    expect(cell(page, 'pair', 'redact-secret')).toEqual({ kind: 'count', value: '0', of: '1' });
    expect(cell(page, 'pair', 'peer-a')).toEqual({ kind: 'count', value: '1', of: '1', href: '/evaluation/method/twin/checks/?row=pair&scanner=peer-a&status=fail' });
    expect(cell(page, 'negative', 'peer-a')).toEqual({ kind: 'count', value: '1', of: '1', href: '/evaluation/method/twin/checks/?row=negative&scanner=peer-a&status=fail' });
    expect(cell(page, 'pair', 'peer-b')).toEqual({ kind: 'not-measured' });
  });

  test('a pair with a T0 side is counted apart, in no row', () => {
    expect(recorded(page).unscored?.text).toMatch(/^1 pair has a side/);
  });
});

describe('benign', () => {
  const page = resolveMethodPage('benign', input());

  test('splits targeted and untargeted controls and says which scanners report a policy action', () => {
    const groups = recorded(page).groups.map(g => g.label);
    expect(groups).toEqual(['Controls by family axis', 'Real-world shapes, untargeted', 'Untargeted, by policy action']);
    expect(rowsOf(page).map(r => r.label)).toEqual(['Near miss', 'Logs', 'Flagged with redact or block', 'Flagged with warn only']);
    expect(cell(page, 'gating', 'redact-secret')).toEqual({ kind: 'count', value: '1', of: '2' });
    expect(cell(page, 'warn', 'redact-secret')).toEqual({ kind: 'count', value: '1', of: '2' });
    expect(cell(page, 'gating', 'peer-a')).toEqual({ kind: 'none' });
    expect(cell(page, 'gating', 'peer-b')).toEqual({ kind: 'not-measured' });
  });

  test('without untargeted controls there is no action group', () => {
    const report = syntheticReport();
    report.cases = report.cases.filter(c => !c.taxonomy.startsWith('realworld-'));
    expect(recorded(resolveMethodPage('benign', input({ report }))).groups.map(g => g.label)).toEqual(['Controls by family axis']);
  });
});

describe('metamorphic and mutation', () => {
  test('metamorphic: one row per transform, then the transformed text on its own', () => {
    const page = resolveMethodPage('metamorphic', input());
    expect(recorded(page).groups.map(g => g.label)).toEqual(['Same detection after the transform', 'The transformed text on its own']);
    expect(cell(page, 'context.indent', 'peer-a')).toEqual({ kind: 'count', value: '1', of: '1', href: '/evaluation/method/metamorphic/checks/?row=context.indent&scanner=peer-a&status=fail' });
    expect(page.how.figures.map(f => f.term)).toEqual(['Source cases', 'Transformed texts', 'Operators']);
    const inputs = page.inputs.state === 'recorded' ? page.inputs : undefined;
    const operators = inputs?.tables.find(t => t.title === 'Operators')?.table;
    expect(operators?.rows.map(r => r.key)).toEqual(['context.indent', 'encoding.crlf']);
    // No operator raised an error in the synthetic report, so the column is left out.
    expect(operators?.columns.map(c => c.key)).not.toContain('error');
  });

  test('mutation: an operator whose values all break the format has a row that waits for review', () => {
    const page = resolveMethodPage('mutation', input());
    expect(cell(page, 'lexical.replace-last', 'redact-secret')).toEqual({ kind: 'count', value: '0', of: '1' });
    expect(cell(page, 'lexical.invalid-alphabet', 'redact-secret')).toEqual({ kind: 'unscored', of: '1', href: '/evaluation/method/mutation/checks/?row=lexical.invalid-alphabet&scanner=redact-secret&status=review-required' });
    expect(recorded(page).unscored?.text).toMatch(/^1 altered value no longer match/);
  });

  test('an operator that raised an error gets an Errors column', () => {
    const report = syntheticReport();
    report.cases.find(c => c.id === 'source-2')!.generation.push({ operator: 'lexical.replace-last', status: 'error' });
    const inputs = resolveMethodPage('mutation', input({ report })).inputs;
    if (inputs.state !== 'recorded') throw new Error('expected recorded inputs');
    expect(inputs.tables.find(t => t.title === 'Operators')?.table.columns.map(c => c.key)).toContain('error');
  });
});

describe('differential', () => {
  test('peers are the columns, rows are exclusive and a peer that did not complete is not measured', () => {
    const page = resolveMethodPage('differential', input());
    expect(recorded(page).columns.map(c => c.id)).toEqual(['peer-a', 'peer-b']);
    expect(cell(page, 'product-only', 'peer-a')).toEqual({ kind: 'count', value: '1', of: '2', href: '/evaluation/method/differential/checks/?row=product-only&scanner=peer-a&status=complete' });
    expect(cell(page, 'same', 'peer-a')).toEqual({ kind: 'count', value: '1', of: '2', href: '/evaluation/method/differential/checks/?row=same&scanner=peer-a&status=complete' });
    expect(cell(page, 'same', 'peer-b')).toEqual({ kind: 'not-measured' });
    expect(recorded(page).unscored?.text).toMatch(/^1 comparisons? recorded a difference/);
  });

  test('a peer that completed nothing has no check, not a zero', () => {
    const report = syntheticReport();
    report.cases = report.cases.filter(c => c.method !== 'differential');
    expect(cell(resolveMethodPage('differential', input({ report })), 'same', 'peer-a')).toEqual({ kind: 'none' });
  });

  test('with the product alone there is nothing to compare, and the page says so', () => {
    const report = syntheticReport();
    report.scanners = report.scanners.filter(s => s.id === 'redact-secret');
    expect(resolveMethodPage('differential', input({ report })).recorded).toMatchObject({ state: 'not-measured', title: 'No peer scanner ran' });
  });
});

describe('holdout', () => {
  test('reads the qualification aggregate and names where it came from', () => {
    const page = resolveMethodPage('holdout', input());
    expect(recorded(page).columns.map(c => c.id)).toEqual(['redact-secret', 'peer-a', 'peer-b']);
    expect(rowsOf(page).map(r => r.key)).toEqual(['must-not-flag:T3', 'must-redact:T1']);
    expect(cell(page, 'must-redact:T1', 'peer-a')).toEqual({ kind: 'count', value: '1', of: '6' });
    expect(cell(page, 'must-not-flag:T3', 'peer-a')).toEqual({ kind: 'count', value: '0', of: '5' });
    expect(cell(page, 'must-redact:T1', 'peer-b')).toEqual({ kind: 'not-measured' });
    expect(recorded(page).unscored).toBeDefined();
    expect(page.meta.find(m => m.label === 'Source')?.value).toBe('Published with the evaluation');
    expect(page.inputs).toMatchObject({ state: 'recorded' });
  });

  test('a frozen report is labelled frozen', () => {
    const page = resolveMethodPage('holdout', input({ qualification: { state: 'recorded', source: 'frozen', report: syntheticQualification() } }));
    expect(page.meta.find(m => m.label === 'Source')?.value).toMatch(/Frozen/);
  });

  test('without an aggregate, the page is not measured and names the qualification command', () => {
    const page = resolveMethodPage('holdout', input({ qualification: { state: 'not-recorded', reason: 'No qualification report.' } }));
    expect(page.recorded).toMatchObject({ state: 'not-measured', command: expect.stringContaining('eval:qualify') });
    expect(page.how.figures).toEqual([]);
  });
});

describe('no evaluation published', () => {
  test.each(METHOD_IDS.filter(id => id !== 'holdout'))('%s says Not measured and names the commands, never a zero', id => {
    const page = resolveMethodPage(id, input({ reason: 'public/results/evaluation-v1.json is absent.' }, true));
    expect(page.recorded).toMatchObject({ state: 'not-measured', command: expect.stringContaining('eval:publish') });
    expect(page.inputs).toMatchObject({ state: 'not-measured' });
    expect(page.meta).toEqual([{ value: 'Not measured' }]);
    expect(page.how.figures).toEqual([]);
  });

  test('without a reason it still says so', () => {
    expect(resolveMethodPage('twin', input({}, true)).recorded).toMatchObject({ state: 'not-measured' });
  });
});

describe('inputs', () => {
  test('a suite links to its fixtures only when the catalog has it', () => {
    const page = resolveMethodPage('twin', input());
    if (page.inputs.state !== 'recorded') throw new Error('expected recorded inputs');
    const rows = page.inputs.tables[0].table.rows;
    expect(rows.find(r => r.key === 'suite-a')?.cells[0].href).toBe('/report/corpus/suite-a/');
    expect(rows.find(r => r.key === 'suite-b')?.cells[0].href).toBeUndefined();
  });
});

describe('hub', () => {
  const builtHrefs = new Set(['/evaluation/', '/evaluation/method/twin/', '/comparison/scanner/']);

  test('a phase is a link only once its entry is in the section navigation', () => {
    const phases = resolvePhases(EVALUATION_PHASES, builtHrefs);
    expect(phases.map(p => p.label)).toEqual(EVALUATION_PHASES.map(p => p.label));
    expect(phases.find(p => p.label === 'Scanners')?.href).toBe('/comparison/scanner/');
    const pending = phases.filter(p => !p.href);
    expect(pending.length).toBe(EVALUATION_PHASES.length - 1);
    for (const p of pending) expect(p.action).toBe('Not in this build yet');
  });

  test('lists the six methods with a count each and the run once', () => {
    const props = resolveEvaluationHub({ ...evidenceOf(syntheticReport()), qualification: syntheticQualification(), phases: EVALUATION_PHASES, builtHrefs });
    expect(props.methods.map(m => m.href)).toEqual(METHOD_IDS.map(methodHref));
    expect(props.methods.find(m => m.id === 'twin')?.fact).toBe('2 pairs');
    expect(props.methods.find(m => m.id === 'holdout')?.fact).toBe('12 cases');
    expect(props.run).toMatchObject({ state: 'recorded' });
    if (props.run.state === 'recorded') {
      expect(props.run.scanners.map(s => s.id)).toEqual(['redact-secret', 'peer-a', 'peer-b']);
      expect(props.run.scanners[1].observed).toMatch(/^Snapshot, /);
      expect(props.run.scanners[2].status).toBe('unavailable');
    }
    expect(props.principles).toEqual(HUB_COPY.principles);
  });

  test('without a run nothing is counted and the commands are named', () => {
    const props = resolveEvaluationHub({ phases: EVALUATION_PHASES, builtHrefs, reason: 'absent' });
    for (const m of props.methods) expect(m.fact).toBeUndefined();
    expect(props.run).toMatchObject({ state: 'not-measured', reason: 'absent', command: expect.stringContaining('eval:publish') });
    expect(props.meta).toEqual([{ value: 'Not measured' }]);
    expect(resolveEvaluationHub({ phases: [], builtHrefs, ...evidenceOf(syntheticReport()) }).methods.find(m => m.id === 'holdout')?.fact).toBeUndefined();
    expect(resolveEvaluationHub({ phases: [], builtHrefs }).run).toMatchObject({ reason: expect.stringContaining('No evaluation') });
  });
});

describe('blocks', () => {
  test('the method page has the five sections in order and one h1', () => {
    render(<MethodPage {...resolveMethodPage('twin', input())} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const sections = screen.getAllByRole('heading', { level: 2 }).map(h => h.closest('section')?.querySelector('p')?.textContent);
    expect(sections).toEqual(['1 · How it runs', '2 · Recorded now', '3 · How to read it', '4 · Exact inputs']);
    expect(screen.getByRole('navigation', { name: 'Evaluation methods' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Evaluation methods' })).getByRole('link', { current: 'page' })).toHaveTextContent('Twin');
  });

  test('every cell is a figure, a state or a word, and a scanner that did not run is labelled', () => {
    render(<MethodPage {...resolveMethodPage('mutation', input())} />);
    const table = screen.getByRole('region', { name: /checks that did not hold, per scanner/i });
    expect(within(table).getAllByText('Not measured').length).toBeGreaterThan(0);
    expect(within(table).getAllByText(/Needs review/).length).toBeGreaterThan(0);
  });

  test('a missing evaluation shows the command, not a table', () => {
    render(<MethodPage {...resolveMethodPage('benign', input({}, true))} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/^Command:/).length).toBeGreaterThan(0);
  });

  test('a suite table is folded behind its summary and links to the suite', () => {
    render(<MethodPage {...resolveMethodPage('twin', input())} />);
    expect(screen.getByText(/^Show the 2 suites$/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Suite A' })).toHaveAttribute('href', expect.stringMatching(/\/report\/corpus\/suite-a\/?$/));
  });

  test('holdout shows the hashes behind a disclosure', () => {
    render(<MethodPage {...resolveMethodPage('holdout', input())} />);
    expect(screen.getByText(/Full hashes/)).toBeInTheDocument();
  });

  test('the hub renders a link for a built phase and plain text for one that is not', () => {
    const props = resolveEvaluationHub({ ...evidenceOf(syntheticReport()), qualification: syntheticQualification(), phases: EVALUATION_PHASES, builtHrefs: new Set(['/comparison/scanner/']) });
    render(<EvaluationHub {...props} />);
    const phases = screen.getByRole('navigation', { name: 'Evaluation pages' });
    expect(within(phases).getAllByRole('link')).toHaveLength(1);
    expect(within(phases).getAllByText('Not in this build yet')).toHaveLength(EVALUATION_PHASES.length - 1);
    expect(screen.getByRole('list', { name: 'The six methods' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Scanners in the evaluation run/ })).toBeInTheDocument();
  });

  test('the hub without a run shows the empty state', () => {
    render(<EvaluationHub {...resolveEvaluationHub({ phases: EVALUATION_PHASES, builtHrefs: new Set() })} />);
    expect(screen.getByText('Not measured', { selector: 'p' })).toBeInTheDocument();
  });
});
