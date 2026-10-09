import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PiiCoverageMatrix } from '../../components/evaluation/domain';
import { syntheticCoverage } from '../../components/evaluation/domain/PiiCoverageMatrix.stories';

test('every coverage state and unsupported kind stays visible in the default matrix', () => {
  const { container } = render(<PiiCoverageMatrix {...syntheticCoverage} />);
  const rows = syntheticCoverage.panels[0].rows;
  expect(container.querySelectorAll('[data-coverage-kind]')).toHaveLength(rows.length);
  for (const row of rows) expect(screen.getByText(row.state)).toBeVisible();
  expect(screen.getByText(/missed 1; unresolved 1/)).toBeVisible();
  expect(screen.getByText('9')).toBeVisible();
  expect(screen.getByRole('heading', { name: /inactive and unmeasured/ })).toBeVisible();
  expect(screen.getByText(/Kind counts are not detection accuracy/)).toBeVisible();
});

test('empty source denominator supplies unavailable ratios and no invented measurement', () => {
  render(<PiiCoverageMatrix panels={[{ ...syntheticCoverage.panels[0], rows: [], summaries: [] }]} delta={null} />);
  expect(screen.getByText(/Ratios are unavailable/)).toBeVisible();
  expect(screen.queryByText(/0%|100%/)).toBeNull();
});

test('summary links target the bound kind and its source reasons', () => {
  const panel = syntheticCoverage.panels[0], row = panel.rows[0];
  render(<PiiCoverageMatrix panels={[{ ...panel, summaries: [{ id: 'bound', label: 'Bound states', value: '1', rowIds: [row.id] }] }]} delta={null} />);
  expect(screen.getByRole('link', { name: row.label })).toHaveAttribute('href', `#${row.id}`);
  expect(screen.getByText(`Reasons and source evidence for ${row.label}`)).toBeVisible();
});
