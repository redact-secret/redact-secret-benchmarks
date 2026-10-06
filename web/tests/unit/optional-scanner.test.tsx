/**
 * An optional scanner the run did not measure (#763): the resolver words the contract's statement and the pointer to the last measurement, and the
 * overview shows them without a row, a count or a zero. Synthetic only; no ledger value is read or asserted.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { QualificationOverview } from '../../components/qualification';
import { overview } from '../../components/qualification/storyData';
import { resolveNotMeasured, resolveScannerProfiles } from '../../resolvers/qualification';
import type { QualificationView } from '../../services/qualification';

const note = (lastMeasurement: unknown) => ({
  scanner: 'lib', profile: 'default', optional: true, label: 'Lib default', statement: 'Lib default: not measured in this run (optional)', reason: 'a manual measurement', lastMeasurement,
});
const view = (notMeasured: unknown[]) => ({ scannerRoster: { id: 'r', runClass: 'official', required: [], optional: ['lib'], measured: [], notMeasured } } as unknown as QualificationView);
const last = (registry: string) => ({ recordedOn: '2026-01-01', engine: { version: '0.0.1', revision: 'abc' }, registry, runs: [{ id: 'run-a@linux-x64', configHash: `sha256:${'a'.repeat(64)}`, scannerVersion: '1', scannerConfigurationHash: null }] });

describe('resolveNotMeasured', () => {
  test('a view built before the roster, or one that measured every optional scanner, says nothing', () => {
    expect(resolveNotMeasured({} as unknown as QualificationView)).toBeUndefined();
    expect(resolveNotMeasured(view([]))).toBeUndefined();
  });

  test('the contract sentence is carried verbatim and the pointer names run, configuration, engine and date', () => {
    const [row] = resolveNotMeasured(view([note(last('runs'))]))!;
    expect(row.statement).toBe('Lib default: not measured in this run (optional)');
    expect(row.reason).toBe('a manual measurement');
    for (const part of ['run-a@linux-x64', 'configuration', 'engine 0.0.1', 'recorded 2026-01-01', 'never combined with another profile']) expect(row.lastMeasurement).toContain(part);
    expect(row.lastMeasurement).not.toContain('superseded');
  });

  test('a superseded measurement stays labelled as history, and no recorded measurement is stated, not implied', () => {
    expect(resolveNotMeasured(view([note(last('historicalRuns'))]))![0].lastMeasurement).toContain('superseded, kept as history');
    expect(resolveNotMeasured(view([note(null)]))![0].lastMeasurement).toBe('No earlier measurement of it is recorded. Nothing is shown in its place.');
  });
});

describe('QualificationOverview with an optional scanner not measured', () => {
  const props = { ...overview, scanners: { ...overview.scanners, notMeasured: resolveNotMeasured(view([note(last('runs'))])) } };

  test('shows the statement, the reason and the pointer, and no row or count for the scanner', () => {
    render(<QualificationOverview {...props} />);
    expect(screen.getByText('Lib default: not measured in this run (optional)')).toBeTruthy();
    expect(screen.getByText('a manual measurement')).toBeTruthy();
    expect(screen.getByText(/Last measurement: run-a@linux-x64/)).toBeTruthy();
    expect(screen.queryByRole('cell', { name: 'lib' })).toBeNull();
  });

  test('without the note nothing about an optional scanner is rendered', () => {
    render(<QualificationOverview {...overview} />);
    expect(screen.queryByText(/not measured in this run/)).toBeNull();
  });
});

const profile = (over: Record<string, unknown>) => ({ scanner: 'lib', label: 'Lib default (all patterns)', profile: 'default', measured: false, ...over });
const withProfiles = (profiles: unknown[]) => ({ scannerRoster: { id: 'r', runClass: 'official', required: [], optional: [], measured: [], notMeasured: [], profiles } } as unknown as QualificationView);

describe('resolveScannerProfiles (#764)', () => {
  const both = [
    profile({}),
    profile({ scanner: 'lib-cred', label: 'Lib credential profile (3 types)', profile: 'credential', profileOf: 'lib', detects: 'only 3 types', disclosure: 'results differ by configuration',
      identity: { adapter: { id: 'lib-cred', version: '1' }, package: 'lib 1.0.0', patterns: 3, scannerConfigurationHash: `sha256:${'b'.repeat(64)}` } }),
  ];

  test('a roster without a profile of another scanner shows nothing', () => {
    expect(resolveScannerProfiles({} as unknown as QualificationView)).toBeUndefined();
    expect(resolveScannerProfiles(withProfiles([profile({})]))).toBeUndefined();
  });

  test('each profile keeps its own label, scanner id and identity, and the disclosure is carried', () => {
    const p = resolveScannerProfiles(withProfiles(both))!;
    expect(p.rows.map(r => r.label)).toEqual(['Lib default (all patterns)', 'Lib credential profile (3 types)']);
    expect(p.rows[1].identity).toContain('lib-cred adapter 1');
    expect(p.rows[1].identity).toContain('3 types');
    expect(p.rows.every(r => r.status === 'Not measured in this view')).toBe(true);
    expect(p.disclosure).toBe('results differ by configuration');
  });

  test('the overview shows both labels and the disclosure, and no counts', () => {
    render(<QualificationOverview {...overview} scanners={{ ...overview.scanners, profiles: resolveScannerProfiles(withProfiles(both)) }} />);
    expect(screen.getByText('Lib default (all patterns)')).toBeTruthy();
    expect(screen.getByText('Lib credential profile (3 types)')).toBeTruthy();
    expect(screen.getByText('Results differ by configuration')).toBeTruthy();
    expect(screen.getByText('results differ by configuration')).toBeTruthy();
  });

  test('a profile not yet measured officially states it and points at the pending step, with no number', () => {
    const view = { scannerRoster: { id: 'r', runClass: 'official', required: [], optional: ['lib-cred'], measured: [], profiles: [], notMeasured: [{ ...note(null), scanner: 'lib-cred', statement: 'Lib credential profile (3 types): not measured in an official run (local exploratory diagnostics only: see ADR)', officialMeasurement: 'pending: requires owner approval' }] } } as unknown as QualificationView;
    const [row] = resolveNotMeasured(view)!;
    expect(row.statement).toContain('not measured in an official run');
    expect(row.officialMeasurement).toBe('Official measurement: pending: requires owner approval.');
    expect(row.lastMeasurement).toBe('No earlier measurement of it is recorded. Nothing is shown in its place.');
  });
});
