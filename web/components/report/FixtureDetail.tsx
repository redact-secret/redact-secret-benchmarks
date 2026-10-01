import Link from 'next/link';
import { ChipList, Chip, EmptyState } from '../feedback';
import { Section, Stack } from '../layout';
import { Breadcrumb, PageHead } from '../page';
import { cx } from '../../lib/cx';
import { FixtureFileView } from './FixtureFileView';
import { FixtureKey } from './FixtureKey';
import { FixturePeers } from './FixturePeers';
import { FixtureSpans } from './FixtureSpans';
import { FixtureTwins } from './FixtureTwins';
import { FixtureVerdict } from './FixtureVerdict';
import { FixtureWhy } from './FixtureWhy';
import styles from './FixtureDetail.module.css';
import type { FixtureDetailData } from './fixtureTypes';

export interface FixtureDetailProps {
  fixture: FixtureDetailData;
  className?: string;
}

/**
 * One fixture, in the order a reader asks: what the product recorded on it, the bytes that earned that
 * (the input with what was expected, the output with what was reported, then each span's outcome), the
 * near-twin it is held against, why the file exists, and the other scanners behind a disclosure. Every
 * value is what the corpus and the run recorded; the page asserts nothing about a scanner and ranks none.
 * The bytes are synthetic test data. Pure render: the parent chose the fixture and loaded its records.
 */
export function FixtureDetail({ fixture: f, className }: FixtureDetailProps) {
  return (
    <div className={cx(styles.detail, className)}>
      <PageHead
        before={<Breadcrumb items={f.crumbs} />}
        eyebrow={f.head.eyebrow}
        title={f.head.title}
        meta={[{ value: f.head.slug }]}
        actions={<Link href={f.suiteHref}>All fixtures in this suite</Link>}
        className={styles.head}
      />
      <ChipList label="About this fixture" items={f.head.tags.map(t => <Chip key={t.label} dashed={t.dashed} mono={t.mono ?? false}>{t.label}</Chip>)} />

      <FixtureVerdict verdict={f.verdict} />

      {f.runProblem && <EmptyState title="No scanner results for these bytes">{f.runProblem}</EmptyState>}

      <Section title="The input and what came back" description="The exact file the scanners read, and the ranges redact-secret reported drawn over it. The values in it are synthetic test data." headingLevel={2}>
        <Stack gap="lg">
          <div className={styles.pane}>
            <p className={styles.label}>Input<small>what the benchmark expects</small></p>
            <FixtureFileView file={f.input} />
          </div>
          <div className={styles.pane}>
            <p className={styles.label}>redact-secret output<small>the reported ranges drawn over the input</small></p>
            {f.output ? <FixtureFileView file={f.output} /> : <EmptyState title="No output recorded">{f.outputNote}</EmptyState>}
          </div>
          <FixtureKey items={f.key} />
          <div className={styles.pane}>
            <FixtureSpans rows={f.spans} />
            <p className={styles.lede}>{f.spansLede}</p>
          </div>
        </Stack>
      </Section>

      {f.twins && (
        <Section title={f.twins.heading} description={f.twins.lede} headingLevel={2}>
          <FixtureTwins items={f.twins.items} />
        </Section>
      )}

      <Section title={f.whyHeading} headingLevel={2}>
        <FixtureWhy facts={f.facts} sources={f.sources} command={f.command} escaped={f.escaped} actions={f.actions} />
      </Section>

      {f.peers && (
        <Section title="Other scanners" description="Reference only. These scanners differ in scope and defaults; the full comparison lives on the comparison pages." headingLevel={2}>
          <FixturePeers peers={f.peers} />
        </Section>
      )}
    </div>
  );
}
