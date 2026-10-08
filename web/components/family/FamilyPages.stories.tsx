import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Chip, ChipList, Note, StatusBar } from '../feedback';
import type { StatusBarItem } from '../feedback';
import { PageContainer, Section, Stack } from '../layout';
import { Breadcrumb, PageHead } from '../page';
import { FixtureTable } from '../report';
import { fixtureRows, manyFixtureRows } from '../report/storyData';
import { FamilyBenchmark } from './FamilyBenchmark';
import { FamilyNotes } from './FamilyNotes';
import { FamilyScannerRules } from './FamilyScannerRules';
import { FamilySources } from './FamilySources';
import { benchmark, benchmarkNoFixtures, lookAlikes, longNotes, manySources, notes, openQuestions, rules, rulesNone, sources, sourcesEmpty } from './storyData';

/**
 * `/report/families/<family>/` assembled from the blocks, for reading the page as a whole. The route wraps the same
 * blocks in `FamilyView` and draws the rows with `RowsView`; stories only, so the rows here are a plain `FixtureTable`.
 */
const meta = {
  title: 'Family/Pages',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

const runMeta = [{ label: 'Run', value: '2026-09-30' }, { label: 'Mode', value: 'published · redact-secret 0.1.0-beta.11' }];

const researched: StatusBarItem[] = [
  { label: 'Dossier verdict', value: 'Ready' },
  { label: 'Dossier evidence level', value: 'T2 · Tool-corroborated' },
  { label: 'Dossier researched', value: '2026-09-29' },
];
const unresearched: StatusBarItem[] = [
  { label: 'Dossier verdict', value: 'Not researched', tone: 'not-measured' },
  { label: 'Dossier evidence level', value: 'Not recorded', tone: 'not-measured' },
  { label: 'Dossier researched', value: 'Not recorded', tone: 'not-measured' },
];

interface PageProps {
  title: string;
  provider: string;
  lede: string;
  status: StatusBarItem[];
  note?: string;
  format: typeof notes;
  open?: typeof notes;
  lookAlike?: typeof notes;
  benchmarkData: typeof benchmark;
  rulesData: typeof rules;
  sourcesData: typeof sources;
  rows: ReactNode;
  siblings?: string[];
}

function FamilyPage({ title, provider, lede, status, note, format, open = [], lookAlike = [], benchmarkData, rulesData, sourcesData, rows, siblings = [] }: PageProps) {
  return (
    <PageContainer as="main">
      <Stack gap="lg">
        <PageHead
          before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Providers', href: '/report/providers/' }, { label: provider, href: '/report/providers/' }, { label: title }]} />}
          eyebrow="redact-secret · Report"
          title={title}
          lede={lede}
          meta={[{ value: provider }, { label: 'Detectors:', value: 'acme-tokens' }, ...runMeta]}
          actions={<Link href="/report/providers/">All providers</Link>}
        />
        <StatusBar label={`Benchmark dossier for ${title}`} items={status} />
        {note && <Note>{note}</Note>}
        <FamilyNotes title="Format facts" description="From the provider dossier, as written. The evidence level above says how well the format is backed; a fact the dossier does not record is not shown." items={format} emptyTitle="No format notes recorded" emptyText="The provider dossier has no shape, basis or issuance note for this family, so nothing is stated about its format here." />
        <FamilyBenchmark {...benchmarkData} />
        {open.length > 0 && <FamilyNotes title="Open questions" description="Things the sources do not settle. They are listed so nobody reads them as settled." items={open} emptyTitle="" emptyText="" />}
        {lookAlike.length > 0 && <FamilyNotes title="Looks like it, but isn't" description="Values the dossier records as resembling this credential without being one." items={lookAlike} emptyTitle="" emptyText="" />}
        <FamilyScannerRules {...rulesData} />
        {rows}
        <FamilySources {...sourcesData} />
        {siblings.length > 0 && (
          <Section title={`Other ${provider} families`} rule="hairline">
            <ChipList label={`Other ${provider} families`} items={siblings.map(s => <Chip key={s} href="/report/families/" mono={false}>{s}</Chip>)} />
          </Section>
        )}
      </Stack>
    </PageContainer>
  );
}

const rowsTable = (props: Partial<Parameters<typeof FixtureTable>[0]> = {}) => (
  <FixtureTable familyName="Fine-grained personal access token" description="6 rows, redact-secret's outcome on each. Rows that need a look come first (3), then the rest in corpus order." rows={fixtureRows} {...props} />
);

const base = {
  title: 'Fine-grained personal access token',
  provider: 'Acme',
  lede: 'Repository- and permission-scoped personal access token, prefixed acme_pat_.',
  status: researched,
  format: notes,
  open: openQuestions,
  lookAlike: lookAlikes,
  benchmarkData: benchmark,
  rulesData: rules,
  sourcesData: sources,
  rows: rowsTable(),
  siblings: ['Classic personal access token', 'OAuth access token', 'App server-to-server token'],
};

/** A researched family with fixtures at three evidence levels, five scanners and open questions. */
export const Researched: Story = { render: () => <FamilyPage {...base} /> };

/** A family the dossier has not researched: the research cells and the format notes read "Not recorded"; the benchmark still counts its fixtures. */
export const NothingRecorded: Story = {
  render: () => (
    <FamilyPage
      {...base}
      status={unresearched}
      format={[]}
      open={[]}
      lookAlike={[]}
      rulesData={rulesNone}
      sourcesData={sourcesEmpty}
    />
  ),
};

/** A family the corpus does not target: nothing is measured and no coverage is claimed. */
export const NoFixtures: Story = {
  render: () => (
    <FamilyPage
      {...base}
      benchmarkData={benchmarkNoFixtures}
      rows={rowsTable({ rows: [], emptyBadge: true })}
    />
  ),
};

/** 112 rows with a 90-character fixture id, long notes and 14 sources: nothing pushes the page sideways. */
export const ManyFixturesLongNames: Story = {
  render: () => (
    <FamilyPage
      {...base}
      title="Fine-grained personal access token for repositories, organisations and enterprise accounts with a very long name"
      format={longNotes}
      sourcesData={manySources}
      rows={rowsTable({
        rows: manyFixtureRows,
        description: '112 rows, redact-secret\'s outcome on each. Rows that need a look come first (9), then the rest in corpus order.',
        pager: { page: 1, pageCount: 3, total: 112, pageSize: 50, nextHref: '?page=2' },
      })}
    />
  ),
};

/** A family whose fixtures are also related to other providers' families (rows say "also in N other families") and that has many sibling families. */
export const MultiProvider: Story = {
  render: () => (
    <FamilyPage
      {...base}
      title="Service-account key"
      provider="Not provider-specific"
      siblings={['Private key', 'JWT', 'Bearer token', 'Basic authentication credentials', 'Connection string', 'Password assignment', 'Webhook secret', 'Session cookie']}
      rows={rowsTable({ rows: manyFixtureRows.slice(0, 12) })}
    />
  ),
};

export const Phone: Story = {
  render: () => <FamilyPage {...base} />,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
