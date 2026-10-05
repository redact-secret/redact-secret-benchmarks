/**
 * Scope accounting (#724): the block renders what the resolver formats, and the resolver formats what the view carries. Synthetic only: the
 * view fragments are authored here, no test asserts a ledger value, and none computes a count (an absent count must read "Unknown").
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ScopeAccounting } from '../../components/qualification';
import { scopeAccounting } from '../../components/qualification/storyData';
import { resolveScopeAccounting } from '../../resolvers/qualification';
import type { DeclaredConfiguration } from '../../services/peers';
import type { QualificationView } from '../../services/qualification';

const declared = new Map<string, DeclaredConfiguration>([
  ['lib', { scanner: 'lib', of: null, label: 'Default configuration', description: 'd' }],
  ['lib-profile', { scanner: 'lib-profile', of: 'lib', label: 'Diagnostic profile: credentials category', description: 'd' }],
]);
const entry = (scanner: string, extra: Record<string, unknown> = {}) => ({
  scanner, engineVersion: '0.1.0-alpha.11', state: 'accounted', retainedFindings: 10,
  profile: { scanner, version: '1.0.0', mode: 'm', build: 'released', configurationHash: `sha256:${'a'.repeat(64)}`, adapterVersion: '2' },
  classification: { accountingVersion: '1', table: { id: 'table-1', package: 'p', version: '1', integrity: 'i' } },
  labelled: 9,
  dispositions: { mapped_credential: 1, credential_related_unmapped: 2, out_of_scope: 4, ambiguous: 1, native_label_unavailable: 1, unrecognized_label: 1 },
  multiLabelFindings: 1, conflictingLabelFindings: 1,
  labels: [{ label: 'TYPE_A', findings: 4, withFamily: 0, scope: 'personal data', status: 'not-credential', reason: 'reviewed' }, { label: '~unrecognized', findings: 1, withFamily: 0, scope: null, status: null, reason: null }],
  limits: ['stated'], ...extra,
});
const legacy = (scanner: string) => entry(scanner, { state: 'legacy-native-label-unavailable', engineVersion: '0.1.0-alpha.5', classification: null, labelled: null, dispositions: null, multiLabelFindings: null, conflictingLabelFindings: null, labels: [], retainedFindings: 7 });
const view = (populations: unknown[]): QualificationView => ({ publication: 'public', populations } as unknown as QualificationView);
const population = (id: string, extra: Record<string, unknown>) => ({ population: id, artifact: { scanners: [{ id: 'redact-secret', version: '1', build: 'released' }] }, ...extra });

describe('resolveScopeAccounting', () => {
  test('a view built before scope accounting shows no scope section instead of zeros', () => {
    expect(resolveScopeAccounting(view([population('p', {})]), declared)).toBeUndefined();
  });

  test('accounted counts are formatted as recorded, with configuration, classification and coverage beside them', () => {
    const props = resolveScopeAccounting(view([population('p', { scope: [entry('lib'), entry('lib-profile')], methodsScope: [entry('lib')] })]), declared)!;
    expect(props.rows.map(r => `${r.artifact}/${r.scanner}`)).toEqual(['plain run/lib', 'plain run/lib-profile', 'methods run/lib']);
    const [row] = props.rows;
    expect([row.mapped, row.credentialRelated, row.outOfScope, row.ambiguous, row.unavailable, row.unrecognized]).toEqual(['1', '2', '4', '1', '1', '1']);
    expect(row.coverage).toBe('9 of 10 findings carry a native label');
    expect(row.configuration).toBe('Default configuration');
    expect(props.rows[1].configuration).toBe('Diagnostic profile: credentials category');
    expect(row.classification).toBe('engine 0.1.0-alpha.11 · table-1 · accounting v1');
    expect(row.unaccounted).toBe(false);
    expect(row.labels[1]).toMatchObject({ label: '~unrecognized', scope: 'outside the reviewed set', reason: 'not classified' });
    // Nothing is summed across scanners, populations or the plain and methods runs.
    expect(props.rows.every(r => !/^\d{2,}$/.test(r.mapped))).toBe(true);
  });

  test('a legacy artifact reads Unknown everywhere, never zero unmapped', () => {
    const props = resolveScopeAccounting(view([population('old', { scope: [legacy('lib')] })]), declared)!;
    const [row] = props.rows;
    expect(row.unaccounted).toBe(true);
    expect(row.state).toBe('Legacy: native labels unavailable');
    for (const cell of [row.coverage, row.mapped, row.credentialRelated, row.outOfScope, row.ambiguous, row.unavailable, row.unrecognized]) expect(cell).toBe('Unknown');
    expect(row.classification).toBe('engine 0.1.0-alpha.5 · no classification recorded');
  });

  test('a long native-type list is limited with the omission stated, and an undeclared scanner says so', () => {
    const labels = Array.from({ length: 30 }, (_, i) => ({ label: `T${i}`, findings: 30 - i, withFamily: 0, scope: 's', status: 'x', reason: 'r' }));
    const props = resolveScopeAccounting(view([population('p', { scope: [entry('mystery', { labels })] })]), declared)!;
    expect(props.rows[0].labels).toHaveLength(12);
    expect(props.rows[0].labelsMore).toBe('18 more native types are recorded and not listed here.');
    expect(props.rows[0].configuration).toBe('Configuration not declared');
  });

  test('a profile effect is a signed delta beside both identities, with denominators stated', () => {
    const effect = {
      population: 'p', note: 'Not a speed-up.', denominatorsEqual: true,
      default: { scanner: 'lib', configurationHash: `sha256:${'a'.repeat(64)}`, totals: { benignCases: 40 } },
      profile: { scanner: 'lib-profile', configurationHash: `sha256:${'b'.repeat(64)}`, totals: {} },
      delta: { outcomes: { EXACT: 0, COVERED: 0, OVERBROAD: 0, PARTIAL: -2, MISS: 2 }, benignFlagged: -5, benignFindings: -5, retainedFindings: -90 },
    };
    const [row] = resolveScopeAccounting(view([population('p', { scope: [entry('lib')], profileEffects: [effect] })]), declared)!.profiles.rows;
    expect(row.pair).toBe('lib-profile against lib');
    expect(row.outcomes).toBe('EXACT 0 · COVERED 0 · OVERBROAD 0 · PARTIAL -2 · MISS +2');
    expect(row.benign).toBe('-5 flagged of 40');
    expect(row.findings).toBe('-90');
    expect(row.denominators).toBe('Equal: no case or span was dropped');
  });
});

describe('ScopeAccounting block', () => {
  test('every disposition has its own column and an unaccounted row is dashed Unknown, not a number', () => {
    render(<ScopeAccounting {...scopeAccounting} />);
    const table = screen.getByRole('table', { name: scopeAccounting.title });
    for (const header of ['Mapped credentials', 'Credential-related, unmapped', 'Out of scope (personal data, resource identifiers)', 'Ambiguous', 'Native label unavailable', 'Unrecognized label', 'Native-label coverage', 'Classification version'])
      expect(within(table).getByRole('columnheader', { name: header })).toBeInTheDocument();
    expect(within(table).getAllByText('Unknown')[0]).toHaveAttribute('data-status', 'not-measured');
    expect(within(table).getByText('Legacy: native labels unavailable')).toHaveAttribute('data-status', 'not-measured');
  });

  test('a profile is its own row beside the default and the comparison names both identities', () => {
    render(<ScopeAccounting {...scopeAccounting} />);
    expect(screen.getAllByText('peer-library').length).toBeGreaterThan(0);
    expect(screen.getAllByText('peer-library-credentials').length).toBeGreaterThan(0);
    const profiles = screen.getByRole('table', { name: scopeAccounting.profiles.title });
    expect(within(profiles).getByText('peer-library-credentials against peer-library')).toBeInTheDocument();
    expect(within(profiles).getByText('Equal: no case or span was dropped')).toBeInTheDocument();
  });

  test('no rows and no profile say so', () => {
    render(<ScopeAccounting {...scopeAccounting} rows={[]} profiles={{ ...scopeAccounting.profiles, rows: [] }} />);
    expect(screen.getByText('No scanner scope accounting is recorded in this view.')).toBeInTheDocument();
    expect(screen.getByText(scopeAccounting.profiles.empty)).toBeInTheDocument();
  });

  test('the public block carries no matched value or raw text: only counts, native type names and fixed reasons', () => {
    const { container } = render(<ScopeAccounting {...scopeAccounting} />);
    expect(container.textContent).not.toMatch(/sk_live|BEGIN [A-Z ]*PRIVATE KEY|ghp_/);
  });
});
