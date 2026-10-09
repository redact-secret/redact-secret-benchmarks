import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Link from 'next/link';
import { EmptyState, RetryNote, Skeleton, SkeletonBlock, StatusBadge } from '../feedback';
import { PageContainer, Section, Stack } from '../layout';
import { SegmentedNav } from '../nav';
import { Breadcrumb, PageHead } from '../page';
import { DetectorGroups } from './DetectorGroups';
import { DetectorList } from './DetectorList';
import { FindingsTable } from './FindingsTable';
import { FixtureDetail } from './FixtureDetail';
import { FixtureTable } from './FixtureTable';
import { ReportFilterBar } from './ReportFilterBar';
import { SuiteTable } from './SuiteTable';
import { fixtureDetail } from './fixturePageData';
import { detectorGroups, detectorRows, findingRows, manyScannerRows, scannerColumns, scannerRows, suiteRows } from './fixtureStoryData';
import type { ReportShow } from './types';

/**
 * The pages added for rows, fixtures, detectors and findings (#559), assembled from the
 * blocks for reading a page as a whole. Stories only: routes and data loading live in
 * `web/app`, and local `useState` here stands in for the page's URL state.
 */
const meta = {
  title: 'Report/Pages (rows, fixtures, detectors)',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

const Page = ({ children }: { children: React.ReactNode }) => <PageContainer as="main"><Stack gap="lg">{children}</Stack></PageContainer>;
const runMeta = [{ label: 'Run', value: '2026-09-30' }, { label: 'Mode', value: 'published · redact-secret 0.1.0-beta.11' }];
const levelLinks = [
  { label: 'Provider-documented', shortLabel: 'Provider', href: '/report/rows/T1/' },
  { label: 'Tool-corroborated', shortLabel: 'Tool', href: '/report/rows/T2/' },
  { label: 'Project policy', shortLabel: 'Policy', href: '/report/rows/T3/' },
];
const SHOW: { value: ReportShow; label: string }[] = [
  { value: 'all', label: 'All rows' },
  { value: 'signal', label: 'Needs a look' },
  { value: 'leaked', label: 'Left readable' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'twins', label: 'Near-twins' },
];

function LevelRows({ initialShow = 'all' as ReportShow }) {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<ReportShow>(initialShow);
  const [scope, setScope] = useState('all');
  return (
    <Page>
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Rows' }, { label: 'T1' }]} />}
        eyebrow="redact-secret · Report"
        title="Rows at the provider-documented level"
        lede="Every fixture at this evidence level, with the outcome each scanner recorded for it. The three answers on the report are counted from these rows. Rows that need a look come first."
        meta={[{ value: '1,308 rows' }, ...runMeta]}
        actions={<><SegmentedNav label="Evidence level" items={levelLinks} currentHref="/report/rows/T1/" /><Link href="/report/">The three answers</Link></>}
      />
      <ReportFilterBar
        label="Filter the rows at this level"
        placeholder="fixture, suite, kind"
        query={query}
        onQueryChange={setQuery}
        show={show}
        onShowChange={setShow}
        showOptions={SHOW}
        scope={{ label: 'Scanners', value: scope, onChange: setScope, options: [{ value: 'product', label: 'redact-secret only' }, { value: 'all', label: 'Every scanner (5)' }] }}
        resultText="1,308 of 1,308 rows"
      />
      <FixtureTable
        familyName="the T1 level"
        title="Rows at this evidence level"
        description="1,308 rows at this level. Counts above are redact-secret's; each scanner's outcome for a row is a column. A scanner with no row for a fixture shows “Not measured”, never a pass."
        facts={[{ term: 'Rows', value: '1,308' }, { term: 'Left readable', value: '60' }, { term: 'Redacted too much', value: '4' }, { term: 'False alarms', value: '0' }]}
        rows={manyScannerRows}
        scanners={scope === 'all' ? scannerColumns : undefined}
        pager={{ page: 1, pageCount: 27, total: 1308, pageSize: 50, nextHref: '?page=2' }}
      />
    </Page>
  );
}

/** `/report/rows/T1/`: the rows behind the three figures. A figure links here with the show that isolates its own rows. */
export const LevelRowsPage: Story = { render: () => <LevelRows /> };

export const LevelRowsLeftReadable: Story = { render: () => <LevelRows initialShow="leaked" /> };

/** `/report/corpus/`. */
export const Suites: Story = {
  render: () => (
    <Page>
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Suites' }]} />}
        eyebrow="redact-secret · Report"
        title="Credential Corpus"
        lede="The corpus is a set of suites, each a folder of fixtures authored for one purpose. Open a suite for its rows, then a row for the fixture: its bytes, what was expected and what each scanner reported."
        meta={[{ value: '68 suites' }, { value: '5,925 fixtures' }, ...runMeta]}
      />
      <SuiteTable suites={suiteRows} caption="Suites of the corpus" />
    </Page>
  ),
};

/** `/report/corpus/<suite>/`. */
export const SuiteRows: Story = {
  render: () => (
    <Page>
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Credential Corpus', href: '/report/corpus/' }, { label: 'GitHub tokens' }]} />}
        eyebrow="redact-secret · Report"
        title="GitHub tokens"
        lede="One fixture per token shape, in the plainest context."
        meta={[{ value: '5 fixtures' }, ...runMeta]}
        actions={<Link href="/report/corpus/">All suites</Link>}
      />
      <FixtureTable familyName="GitHub tokens" title="Fixtures in this suite" description="5 fixtures in this suite. Open a fixture for its bytes, expected spans and what each scanner reported." rows={scannerRows} scanners={scannerColumns} />
    </Page>
  ),
};

/** `/report/corpus/<suite>/?fixture=<id>`. */
export const FixturePage: Story = {
  render: () => (
    <Page>
      <FixtureDetail fixture={fixtureDetail} />
    </Page>
  ),
};

/** A fixture opened while its suite's records load: the title and two regions the size of the page to come. */
export const FixtureLoading: Story = {
  render: () => (
    <Page>
      <Stack gap="lg">
        <PageHead before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Credential Corpus', href: '/report/corpus/' }, { label: 'Detector coverage', href: '/report/corpus/detector-coverage/' }, { label: fixtureDetail.id }]} />} eyebrow="DETECTOR COVERAGE" title={fixtureDetail.id} meta={[{ value: ' ' }]} />
        <Skeleton label={`Loading fixture ${fixtureDetail.id}`}>
          <SkeletonBlock shape="panel" />
          <SkeletonBlock shape="panel" />
          <SkeletonBlock shape="line" width="half" />
        </Skeleton>
      </Stack>
    </Page>
  ),
};

/** The records file did not load: why, what still works, and a retry. */
export const FixtureLoadFailed: Story = {
  render: () => (
    <Page>
      <Stack gap="lg">
        <PageHead before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Credential Corpus', href: '/report/corpus/' }, { label: 'Detector coverage', href: '/report/corpus/detector-coverage/' }, { label: fixtureDetail.id }]} />} eyebrow="DETECTOR COVERAGE" title={fixtureDetail.id} meta={[{ value: ' ' }]} />
        <RetryNote title="Could not load this fixture" onRetry={() => undefined}>You are offline. The rest of the suite is unaffected.</RetryNote>
        <Link href="/report/corpus/detector-coverage/">All fixtures in this suite</Link>
      </Stack>
    </Page>
  ),
};

export const FixtureNotFound: Story = {
  render: () => (
    <Page>
      <PageHead before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Credential Corpus', href: '/report/corpus/' }, { label: 'not-a-fixture' }]} />} eyebrow="redact-secret · Report" title="No such fixture" />
      <EmptyState title="No fixture “not-a-fixture” in Detector coverage" action={<Link href="/report/corpus/detector-coverage/">All fixtures in this suite</Link>}>
        Fixture ids come from the corpus. This suite has 1,309 fixtures.
      </EmptyState>
    </Page>
  ),
};

/** `/report/detectors/`. */
export const Detectors: Story = {
  render: () => (
    <Page>
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Detectors' }]} />}
        eyebrow="redact-secret · Report"
        title="Detectors"
        lede="One row per detector family the product registers, by the fixtures that exercise it. The line on each bar is the minimum sample size below which the run withholds a bound."
        meta={[{ value: '110 detectors' }, { value: '2 at or below the minimum' }, ...runMeta]}
      />
      <DetectorList detectors={detectorRows} caption="Detectors by fixture count" />
    </Page>
  ),
};

/** `/report/detectors/<id>/`. */
export const DetectorPage: Story = {
  render: () => (
    <Page>
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Detectors', href: '/report/detectors/' }, { label: 'Example token' }]} />}
        eyebrow="redact-secret · Report · Detector"
        title="Example token"
        meta={[{ value: '5 fixtures' }, { label: 'Format evidence:', value: 'T1 · Provider-documented' }, ...runMeta]}
        actions={<Link href="/report/detectors/">All detectors</Link>}
      />
      <p><StatusBadge status="withheld">At minimum</StatusBadge> 5 fixtures against the run’s minimum sample size: bounds for this detector may be withheld.</p>
      <Section title="What the run recorded, by group" rule="none" headingLevel={2}>
        <DetectorGroups groups={detectorGroups} caption="Groups of Example token fixtures" />
      </Section>
      <Section title="Tracked product issues" rule="none" headingLevel={2}>
        <FindingsTable findings={findingRows.slice(0, 1)} caption="Findings on Example token" />
      </Section>
      <FixtureTable familyName="Example token" title="Fixtures for this detector" description="5 fixtures." rows={scannerRows} />
    </Page>
  ),
};

/** `/report/findings/`. */
export const Findings: Story = {
  render: () => (
    <Page>
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Findings' }]} />}
        eyebrow="redact-secret · Report"
        title="Findings"
        lede="Findings this benchmark handed to the product, newest first. Ledger snapshot 2026-09-25, measured on 0.1.0-beta.3; a snapshot of lifecycle records, not live issue status."
        meta={[{ value: '63 findings' }, { label: 'Snapshot', value: '2026-09-25' }]}
        actions={<a href="https://github.com/redact-secret/redact-secret/milestone/1">Beta.3 milestone on GitHub</a>}
      />
      <FindingsTable findings={findingRows} caption="Findings handed to the product" />
    </Page>
  ),
};
