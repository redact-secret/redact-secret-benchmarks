/**
 * The qualification blocks (#606): pure render from props. Behaviour by role and accessible name, never a snapshot. The props are the
 * stories' synthetic data; each story is also rendered and scanned by axe in stories.test.tsx.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { QualificationFamily, QualificationOverview, QualificationUnavailable } from '../../components/qualification';
import { family, overview, unavailable } from '../../components/qualification/storyData';

describe('QualificationOverview', () => {
  test('a family links to its page, with its support status as a word', () => {
    render(<QualificationOverview {...overview} />);
    const table = screen.getByRole('table', { name: overview.families.title });
    const link = within(table).getByRole('link', { name: 'alpha-token' });
    expect(link.getAttribute('href')).toContain('/evaluation/qualification/families/alpha-token');
    expect(within(table).getByText('Stable')).toBeInTheDocument();
    expect(within(table).getByText('Provisional')).toBeInTheDocument();
  });

  test('each population is a row of its own and a configuration that ran no method says "None run"', () => {
    render(<QualificationOverview {...overview} />);
    const table = screen.getByRole('table', { name: overview.populations.title });
    for (const row of overview.populations.rows) expect(within(table).getByText(row.id)).toBeInTheDocument();
    expect(within(table).getAllByText('None run').length).toBeGreaterThan(0);
  });

  test('the methods note is shown only when the props carry it', () => {
    const { rerender } = render(<QualificationOverview {...overview} />);
    expect(screen.getByText('Methods not run')).toBeInTheDocument();
    rerender(<QualificationOverview {...overview} summary={{ ...overview.summary, methodsNote: null }} />);
    expect(screen.queryByText('Methods not run')).not.toBeInTheDocument();
  });

  test('empty tables say so', () => {
    render(<QualificationOverview {...overview} families={{ ...overview.families, rows: [] }} gaps={{ ...overview.gaps, rows: [] }} />);
    expect(screen.getByText('No detector family is recorded in this view.')).toBeInTheDocument();
    expect(screen.getByText('No known-gap record is in this view.')).toBeInTheDocument();
  });
});

describe('QualificationFamily', () => {
  test('the status, its reason and the methods that did not run are stated', () => {
    render(<QualificationFamily {...family} />);
    expect(screen.getByText('Provisional')).toBeInTheDocument();
    expect(screen.getByText(/methods\.notRun/)).toBeInTheDocument();
    for (const method of family.status.methodsNotRun) expect(screen.getAllByText(method).length).toBeGreaterThan(0);
  });

  test('observations are one row per population and scanner, and pending is dashed text, not a number', () => {
    render(<QualificationFamily {...family} />);
    const table = screen.getByRole('table', { name: family.observations.title });
    expect(within(table).getAllByRole('row').length).toBe(family.observations.rows.length + 1);
    expect(within(table).getByText('1 pending')).toHaveAttribute('data-status', 'not-measured');
  });

  test('a family with no observation says nothing was recorded', () => {
    render(<QualificationFamily {...family} observations={{ ...family.observations, rows: [] }} />);
    expect(screen.getByText(family.observations.empty)).toBeInTheDocument();
  });
});

describe('QualificationUnavailable', () => {
  test('names why, and shows the command and no table', () => {
    render(<QualificationUnavailable {...unavailable} />);
    expect(screen.getByText(unavailable.heading)).toBeInTheDocument();
    expect(screen.getByText(unavailable.reason)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
