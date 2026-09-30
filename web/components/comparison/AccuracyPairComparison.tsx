import type { ReactNode } from 'react';
import Link from 'next/link';
import { cx } from '../../lib/cx';
import { EmptyState, Note } from '../feedback';
import { Stack } from '../layout';
import { Breadcrumb, PageHead } from '../page';
import type { Crumb, MetaItem } from '../page';
import { AccuracyDifferences } from './AccuracyDifferences';
import { AccuracyPairBar } from './AccuracyPairBar';
import { AccuracyQuestion } from './AccuracyQuestion';
import { AccuracySources } from './AccuracySources';
import { AccuracyToolPair } from './AccuracyToolPair';
import type { AccuracyBarRow, AccuracyQuestionData, AccuracySide, AccuracySource } from './accuracyTypes';
import styles from './AccuracyPairComparison.module.css';

export interface AccuracyPairComparisonProps {
  breadcrumb: Crumb[];
  eyebrow: string;
  title: string;
  lede: string;
  /** The way back to the report, which shows every scanner at once. */
  allScanners: { href: string; label: string };
  meta?: MetaItem[];
  bar: AccuracyBarRow[];
  /** Omitted when there is no pair to show (nothing measured). */
  pair?: { ours: AccuracySide; theirs: AccuracySide };
  /** The provenance line read before the numbers. */
  first?: string;
  /** Said when the view is a preview and not a measurement. */
  preview?: string;
  questions?: AccuracyQuestionData[];
  /** Said instead of the questions when a level is hidden until asked for. */
  gate?: { title: string; text: string; show: { label: string; href: string } };
  /** Said instead of everything below the bar when nothing is measured. */
  notMeasured?: { title: string; text: string; command?: string };
  sources?: AccuracySource[];
  /** Differences drawn under a question, by question id. A slot, so a caller can load them only when asked. */
  differences?: Record<string, ReactNode>;
  className?: string;
}

/**
 * `/comparison/accuracy`: redact-secret and one other tool, each read against the expected answer for the
 * same test files on its own row, then the files where they differ. Shows recorded values; never scores,
 * totals or names a winner, and draws the two sides the same.
 */
export function AccuracyPairComparison({
  breadcrumb, eyebrow, title, lede, allScanners, meta, bar, pair, first, preview, questions, gate, notMeasured, sources, differences, className,
}: AccuracyPairComparisonProps) {
  return (
    <Stack gap="lg" className={cx(styles.page, className)}>
      <PageHead
        before={<Breadcrumb items={breadcrumb} />}
        eyebrow={eyebrow}
        title={title}
        lede={lede}
        meta={meta}
        actions={<Link className={styles.all} href={allScanners.href}>{allScanners.label}</Link>}
      />
      <AccuracyPairBar rows={bar} />
      {pair && <AccuracyToolPair ours={pair.ours} theirs={pair.theirs} />}
      {first && <Note title="Read this first">{first}</Note>}
      {preview && <p className={styles.preview}>{preview}</p>}
      {notMeasured ? (
        <EmptyState title={notMeasured.title} command={notMeasured.command}>{notMeasured.text}</EmptyState>
      ) : gate ? (
        <Note title={gate.title}>
          {gate.text} <Link href={gate.show.href}>{gate.show.label}</Link>.
        </Note>
      ) : (
        <Stack gap="xl">
          {questions?.map(q => (
            <AccuracyQuestion
              key={q.id}
              question={q}
              differences={differences?.[q.id] ?? (q.differences ? <AccuracyDifferences {...q.differences} /> : undefined)}
            />
          ))}
        </Stack>
      )}
      {sources && sources.length > 0 && <AccuracySources title="Where this comes from" sources={sources} />}
    </Stack>
  );
}
