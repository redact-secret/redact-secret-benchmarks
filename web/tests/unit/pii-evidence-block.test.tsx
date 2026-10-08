import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DomainCoverage } from '../../components/evaluation/domain/DomainCoverage';
import { DomainView } from '../../components/evaluation/domain';
import { resolvePiiEvidenceView } from '../../resolvers/pii-evidence';

test('independent evidence absence is readable and navigates to benchmark-owned PII separately', () => {
  render(<DomainView {...resolvePiiEvidenceView({ state: 'absent', reason: 'synthetic-absent', publicOnly: true, supportClaims: false, qualified: false })} />);
  expect(screen.getByRole('heading', { level: 1, name: 'PII evidence as its own population' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Benchmark-owned PII' })).toHaveAttribute('href', '/evaluation/pii');
  expect(screen.getAllByText('Not qualified')[0]).toBeTruthy();
  expect(screen.queryByRole('table', { name: 'Scanner-neutral metrics for this population only' })).toBeNull();
});

test('recorded withheld cells preserve their exact state and denominator details', () => {
  render(<DomainCoverage title="Synthetic evidence" mode="Synthetic only" tables={[{ id: 'synthetic-withheld', caption: 'Synthetic withheld cells', rowHeader: 'Metric', columns: ['Example scanner'], rows: [
    { id: 'synthetic-unavailable', label: 'Unavailable example', cells: [{ figure: null, unavailableLabel: 'Not measured', detail: 'Unresolved 2; not measured 3; eligible 5.' }] },
    { id: 'synthetic-na', label: 'Inapplicable example', cells: [{ figure: null, unavailableLabel: 'Not applicable', detail: 'Zero eligible denominator; no measured zero.' }] },
    { id: 'synthetic-held', label: 'Withheld example', cells: [{ figure: null, unavailableLabel: 'Withheld', detail: 'Synthetic withholding reason.' }] },
  ] }]} columnKey={[]} scope={[]} />);
  expect(screen.getByText('Not measured')).toBeTruthy();
  expect(screen.getByText('Not applicable')).toBeTruthy();
  expect(screen.getByText('Withheld')).toBeTruthy();
  expect(screen.getByText('Unresolved 2; not measured 3; eligible 5.')).toBeTruthy();
  expect(screen.queryByText('Not recorded')).toBeNull();
});
