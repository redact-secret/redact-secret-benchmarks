import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformanceOwn } from '../../components/comparison/PerformanceOwn';
import { PerformanceGaps } from '../../components/comparison/PerformanceGaps';
import { own } from '../../components/comparison/performance-fixtures';

test('own measurement has only product columns and preserves its separate protocol and samples', () => {
  render(<PerformanceOwn {...own} />);
  expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  expect(screen.queryByRole('columnheader', { name: /flare-redact|OpenRedaction/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/flare-redact|OpenRedaction/)).not.toBeInTheDocument();
  expect(screen.getByText(own.apart)).toBeInTheDocument();
  expect(screen.getByText(own.source)).toBeInTheDocument();
});

test('available separate evidence link does not remove the pair measurement gap', () => {
  render(<PerformanceGaps title="Pair gaps" description="Separate protocols" groups={[{ id: 'pieces', title: 'Pieces', description: 'Same text', reason: 'Only separate own profiles exist.', links: [{ label: 'Own source', href: 'https://example.test/own-run' }] }]} />);
  expect(screen.getByText('Not measured')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Own source' })).toHaveAttribute('href', 'https://example.test/own-run');
});
