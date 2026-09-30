import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { EmptyState, Note, StatusBadge } from '../../../../components/feedback';
import { Section, Stack } from '../../../../components/layout';
import { Breadcrumb, PageHead } from '../../../../components/page';
import { DetectorGroups, FindingsTable } from '../../../../components/report';
import { resolveDetectorPage, resolveDetectorSlugs } from '../../../../resolvers/pages';
import { RunNotes } from '../../RunNotes';
import { RowsView } from '../../RowsView';
import { ROW_SHOW } from '../../rowShowOptions';
import styles from '../Detectors.module.css';

/** Every detector in the registry is a page, including those with no fixtures, so a static host serves each and 404s the rest. */
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await resolveDetectorSlugs()).map(detector => ({ detector }));
}

export async function generateMetadata({ params }: { params: Promise<{ detector: string }> }): Promise<Metadata> {
  const data = await resolveDetectorPage((await params).detector);
  return { title: data ? `${data.detector.title} · Detectors` : 'Detector not found' };
}

/**
 * One detector: what the run accounted for each group of its fixtures with the other scanners'
 * figure for the same cell, the format evidence behind it, the findings that rest on its fixtures
 * and every fixture row. A detector with no fixtures says so and claims no coverage.
 */
export default async function Page({ params }: { params: Promise<{ detector: string }> }) {
  const data = await resolveDetectorPage((await params).detector);
  if (!data) notFound();
  const { detector } = data;
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Detectors', href: '/report/detectors/' }, { label: detector.title }]} />}
        eyebrow={data.head.eyebrow}
        title={data.head.title}
        meta={data.head.meta}
        actions={<Link href="/report/detectors/">All detectors</Link>}
      />
      <RunNotes state={data.runState} />

      {detector.belowMinimum && <p><StatusBadge status={detector.belowMinimum.status}>{detector.belowMinimum.label}</StatusBadge> {detector.fixtureCount} fixtures against the run’s minimum sample size: bounds for this detector may be withheld.</p>}

      {detector.sources.length > 0 && (
        <Section title="Format evidence" rule="hairline" headingLevel={2}>
          <ul className={styles.sources}>
            {detector.sources.map(s => (
              <li key={s.href}><a href={s.href}>{s.label}</a>{s.note && <small className={styles.note}> {s.note}</small>}</li>
            ))}
          </ul>
          {detector.review && <p className={styles.note}>{detector.review}</p>}
        </Section>
      )}

      {detector.unprobeable && (
        <Note tone="info" title="Un-probeable">
          No negative twin is authored for this family, and it is left out of every twin rate. {detector.unprobeable.reason} Checked {detector.unprobeable.observedAt}.
        </Note>
      )}

      {detector.fixtureCount === 0 ? (
        <EmptyState title="No fixtures are assigned to this detector">
          It is registered, but nothing in the corpus targets it, so nothing is measured and no coverage is claimed.
        </EmptyState>
      ) : (
        <>
          {detector.groups.length > 0 && (
            <Section title="What the run recorded, by group" description={data.note} rule="none" headingLevel={2}>
              <DetectorGroups groups={detector.groups} caption={`Groups of ${detector.title} fixtures`} />
            </Section>
          )}
          {data.findings.length > 0 && (
            <Section title="Tracked product issues" description="Findings whose fixtures are in this detector’s rows." rule="none" headingLevel={2}>
              <FindingsTable findings={data.findings} caption={`Findings on ${detector.title}`} />
            </Section>
          )}
          <RowsView
            anchor="detector-rows"
            name={detector.title}
            title="Fixtures for this detector"
            description={`${detector.fixtureCount} fixtures. Choose "Every scanner" to see each scanner's outcome for the same rows.`}
            facts={data.facts}
            data={data.rows}
            defaultScanners="product"
            showOptions={ROW_SHOW}
          />
        </>
      )}
    </Stack>
  );
}
