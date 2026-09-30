import Link from 'next/link';
import { cx } from '../../lib/cx';
import { EmptyState, Note } from '../feedback';
import { Stack } from '../layout';
import { Breadcrumb, PageHead } from '../page';
import type { Crumb } from '../page';
import { PerformanceCases } from './PerformanceCases';
import { PerformanceGaps } from './PerformanceGaps';
import type { PerformanceGapsProps } from './PerformanceGaps';
import { PerformanceMethod } from './PerformanceMethod';
import type { PerformanceMethodProps } from './PerformanceMethod';
import { PerformanceOverview } from './PerformanceOverview';
import type { PerformanceOverviewProps } from './PerformanceOverview';
import { PerformanceOwn } from './PerformanceOwn';
import type { PerformanceOwnProps } from './PerformanceOwn';
import { PerformancePairHead } from './PerformancePairHead';
import { PerformancePicker } from './PerformancePicker';
import type { PerformancePickerProps } from './PerformancePicker';
import type { PairSideInfo, PerformanceGroup, TrackTick } from './performance-types';
import styles from './PerformancePair.module.css';

export interface PerformancePairProps {
  breadcrumb: Crumb[];
  eyebrow: string;
  title: string;
  lede: string;
  /** A link to the page that sets all three libraries side by side. */
  related?: { href: string; label: string };
  picker: PerformancePickerProps;
  sides: [PairSideInfo, PairSideInfo];
  /** "Read this first": how the times may be read. */
  first: { title: string; items: string[] };
  /** The shared axis, overview and groups. Absent when the picked pair has no shared measurement; `empty` then says so. */
  measured?: { ticks: TrackTick[]; overview: Omit<PerformanceOverviewProps, 'className'>; groups: PerformanceGroup[] };
  empty?: { title: string; text: string };
  own: PerformanceOwnProps;
  gaps: PerformanceGapsProps;
  method: PerformanceMethodProps;
  className?: string;
}

/**
 * `/comparison/performance`: redact-secret next to one other library, every text that was timed for both on one
 * shared time axis. Absolute times only: no ratio, no ordering by time, the two sides drawn alike. A pair with no
 * shared measurement says so instead of drawing an empty chart.
 */
export function PerformancePair({ breadcrumb, eyebrow, title, lede, related, picker, sides, first, measured, empty, own, gaps, method, className }: PerformancePairProps) {
  const names: [string, string] = [sides[0].name, sides[1].name];
  return (
    <Stack gap="xl" className={cx(styles.page, className)}>
      <PageHead
        before={<Breadcrumb items={breadcrumb} />}
        eyebrow={eyebrow}
        title={title}
        lede={lede}
        actions={related && <Link className={styles.related} href={related.href}>{related.label}</Link>}
      />
      <Stack gap="lg">
        <PerformancePicker {...picker} />
        <PerformancePairHead sides={sides} />
        <Note title={first.title}>
          <ul>{first.items.map(item => <li key={item}>{item}</li>)}</ul>
        </Note>
      </Stack>
      {measured ? (
        <>
          <PerformanceOverview {...measured.overview} />
          <Stack gap="xl">
            {measured.groups.map(group => <PerformanceCases key={group.id} group={group} sides={names} ticks={measured.ticks} />)}
          </Stack>
        </>
      ) : (
        empty && <EmptyState title={empty.title}>{empty.text}</EmptyState>
      )}
      <PerformanceOwn {...own} />
      <PerformanceGaps {...gaps} />
      <PerformanceMethod {...method} />
    </Stack>
  );
}
