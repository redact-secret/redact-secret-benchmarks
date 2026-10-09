import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { RouteRedirect } from '../../app/RouteRedirect';

test.each([
  ['/report/corpus/', 'Credential Corpus'],
  ['/report/corpus/example-suite/', 'Credential Corpus'],
  ['/comparison/scanner/', 'Scanner comparison'],
])('a compatibility page replaces its address with %s, retaining the query and fragment', (href, label) => {
  const replace = vi.fn();
  const original = window.location;
  Object.defineProperty(window, 'location', { configurable: true, value: { search: '?fixture=alpha--1&show=all', hash: '#spans', replace } });
  try {
    render(<RouteRedirect href={href} label={label} />);
    expect(replace).toHaveBeenCalledWith(`${href}?fixture=alpha--1&show=all#spans`);
    expect(screen.getByRole('link', { name: `Open ${label}` })).toHaveAttribute('href', expect.stringMatching(new RegExp(`^${href.replace(/\/$/, '')}/?$`)));
  } finally {
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  }
});
