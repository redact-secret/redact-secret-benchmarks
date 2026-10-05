/**
 * The findings inventory and the suite list (#559). Pure.
 *
 * The inventory is every finding this benchmark handed to the product, from the
 * known-gaps ledger (`benchmarks/known-gaps.json`, validated by the promotion
 * checks). It is a snapshot of lifecycle records, not live issue status, and says so.
 * Each finding names the fixtures it rests on, linked to their pages when the corpus
 * holds them and plain text when it does not: never a dead link.
 */
import type { Catalog } from '../services/catalog';
import type { KnownGaps } from '../services/findings';
import type { RowResult } from '../services/run';
import type { FindingRowData, StatusLabel, SuiteRowData } from '../components/report/types';
import { FINDING_STATUS, lastDate } from './report';
import { countsFor, fixtureHref, suiteHref } from './rows';
import { int } from './format';

/** 'v0.1.0-beta.4' reads as 'Beta.4' beside an issue number. */
export const milestoneLabel = (milestone: string): string => (milestone.split('-').pop() ?? milestone).replace(/^./, c => c.toUpperCase());

/**
 * What the ledger header says about itself, from data: when it was last reviewed, the release it was last measured on, and how many of the fixed and verified
 * records the accepted run could confirm. The header is the last recorded review and measurement, never the milestone a finding was measured on (each record
 * carries its own candidate build and dates).
 */
export function ledgerStamp(gaps: KnownGaps): string {
  const r = gaps.reverification;
  const base = `Ledger last reviewed ${gaps.reviewedAt}; last measured release ${gaps.measuredVersion}`;
  if (!r) return `${base}.`;
  const records = r.fixed.records + r.verified.records, confirmed = r.fixed.allFixturesPass + r.verified.allFixturesPass;
  const unconfirmed = r.fixed.notCovered.length + r.fixed.stillFailing.length + r.verified.notCovered.length + r.verified.stillFailing.length;
  return `${base}, when ${int(confirmed)} of ${int(records)} fixed and verified records were confirmed against the accepted run${unconfirmed ? ` and ${int(unconfirmed)} kept their status because the run could not confirm them` : ''}.`;
}

export interface FindingsInventory {
  title: string;
  description: string;
  count: number;
  rows: FindingRowData[];
  milestone: { label: string; href: string };
}

export function resolveFindingsInventory(gaps: KnownGaps, catalog: Pick<Catalog, 'bySlug'>): FindingsInventory {
  const newest = [...gaps.issues]
    .map(i => ({ i, date: lastDate(i.history) }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.i.number - a.i.number);
  return {
    title: 'Findings',
    description: `Findings this benchmark handed to the product, newest first. ${ledgerStamp(gaps)} A snapshot of lifecycle records, not live issue status.`,
    count: gaps.issues.length,
    milestone: { label: `Latest measured release: ${milestoneLabel(gaps.milestone)} milestone`, href: gaps.milestoneUrl },
    rows: newest.map(({ i, date }) => ({
      id: String(i.number),
      number: `#${i.number}`,
      title: i.title,
      href: i.url,
      status: FINDING_STATUS[i.status] ?? ({ status: 'info', label: i.status } as StatusLabel),
      kind: i.kind === 'false-positive' ? 'Flagged a safe value' : 'Left a secret readable',
      fixtures: i.fixtures.map(slug => {
        const fixture = catalog.bySlug.get(slug);
        return { label: slug.split('--').slice(1).join('--') || slug, ...(fixture ? { href: fixtureHref(fixture) } : {}) };
      }),
      measured: i.candidate?.version ?? gaps.measuredVersion,
      reviewed: date,
    })),
  };
}

/** Every published suite with redact-secret's counts over its fixtures. A suite with no fixtures resolves to `counts: null`. */
export function resolveSuiteRows(catalog: Pick<Catalog, 'suites' | 'fixturesBySuite'>, rows: Map<string, RowResult> | undefined): SuiteRowData[] {
  return catalog.suites.map(suite => {
    const fixtures = catalog.fixturesBySuite.get(suite.id) ?? [];
    return { id: suite.id, title: suite.title, href: suiteHref(suite.id), fixtures: int(fixtures.length), description: suite.description, counts: countsFor(fixtures, rows) };
  });
}
