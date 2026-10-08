import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { DomainStatus } from '../../components/evaluation/domain/DomainStatus';

test('family navigation points at the exact recorded row without deriving a value', () => {
  const anchor = '8:pii-v1|6:family';
  render(<DomainStatus title="Public measurement" links={[]} groups={[{ title: 'Synthetic population',
    navigation: [{ label: 'Email view', href: `/evaluation/pii/#${encodeURIComponent(anchor)}` }],
    rows: [{ id: 'email', anchor, label: 'Email', status: 'info', statusWord: 'Exploratory', detail: 'No qualification verdict.' }],
  }]} />);
  expect(screen.getByRole('link', { name: 'Email view' })).toHaveAttribute('href', `/evaluation/pii#${encodeURIComponent(anchor)}`);
  expect(screen.getByText('Email').closest('li')).toHaveAttribute('id', anchor);
});
