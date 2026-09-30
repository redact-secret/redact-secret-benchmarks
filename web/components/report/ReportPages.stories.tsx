import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Link from 'next/link';
import { EmptyState } from '../feedback';
import { PageContainer, Stack } from '../layout';
import { Breadcrumb, PageHead } from '../page';
import { Code } from '../text';
import { FamilyAbout } from './FamilyAbout';
import { FamilyTable } from './FamilyTable';
import { FindingsFeed } from './FindingsFeed';
import { FixtureTable } from './FixtureTable';
import { PeerScannerSection } from './PeerScannerSection';
import { ProviderTree } from './ProviderTree';
import { ReportFilterBar } from './ReportFilterBar';
import { ReportHubTiles } from './ReportHubTiles';
import { ThreeAnswers } from './ThreeAnswers';
import { answerMeta, answers, familyAbout, familyFacts, families, findings, fixtureRows, hubTiles, levels, peerNotes, peerRows, providers } from './storyData';
import type { ReportShow } from './types';

/**
 * The three report pages assembled from the blocks, for reading the page as a
 * whole. Stories only: routes and data loading are wired later (#547). Local
 * `useState` here stands in for the page's URL state.
 */
const meta = {
  title: 'Report/Pages',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

const Page = ({ children }: { children: React.ReactNode }) => <PageContainer as="main"><Stack gap="lg">{children}</Stack></PageContainer>;

const runMeta = [{ label: 'Run', value: '2026-09-30' }, { label: 'Mode', value: 'published' }];

/** `/report`: hub, three answers, what changed, other scanners. */
export const ReportHub: Story = {
  render: () => (
    <Page>
      <PageHead
        eyebrow="REDACT-SECRET 0.1.0-BETA.11"
        title="What the benchmark shows"
        lede="Synthetic inputs, the same for every scanner, scored span by span. Start from a provider, a family or a detector, or see what changed."
      />
      <ReportHubTiles tiles={hubTiles} label="Report sections" />
      <ThreeAnswers title="Three answers" eyebrow="PROVIDER-DOCUMENTED" meta={answerMeta} levels={levels} currentLevelHref="/report" answers={answers} />
      <FindingsFeed
        id="news"
        title="What changed"
        description="Findings this benchmark handed to the product, newest first. Ledger snapshot 2026-09-25; not live issue status."
        findings={findings}
        allHref="/coverage?show=inventory"
        allLabel="All 57 findings"
      />
      <PeerScannerSection
        title="Other scanners on the same inputs"
        description="We ran 3 other scanners on the same 1,068 provider-documented inputs. This shows what each one left readable. It does not show which scanner is better."
        rows={peerRows}
        notes={peerNotes}
      />
    </Page>
  ),
};

/** `/report?level=T3`: the same hub at another evidence level. */
export const ReportHubPolicyLevel: Story = {
  render: () => (
    <Page>
      <PageHead eyebrow="REDACT-SECRET 0.1.0-BETA.11" title="What the benchmark shows" />
      <ThreeAnswers title="Three answers" eyebrow="PROJECT POLICY" meta={answerMeta} levels={levels} currentLevelHref="/report?level=T3" answers={answers} />
    </Page>
  ),
};

const matches = (show: ReportShow, hasFixtures: boolean, needsLook: boolean) => show === 'all' || (show === 'signal' ? needsLook : !hasFixtures);

function ProvidersPage({ initialQuery = '', initialShow = 'all' }: { initialQuery?: string; initialShow?: ReportShow }) {
  const [query, setQuery] = useState(initialQuery);
  const [show, setShow] = useState<ReportShow>(initialShow);
  const q = query.trim().toLowerCase();
  const visible = providers
    .map(p => ({
      ...p,
      families: p.families.filter(f => matches(show, f.counts !== null, !!f.counts && (f.counts.leftReadable !== '0' || f.counts.falseAlarms !== '0')) && (!q || `${p.name} ${f.name} ${f.id}`.toLowerCase().includes(q))),
    }))
    .filter(p => p.families.length > 0);
  const familyCount = visible.reduce((n, p) => n + p.families.length, 0);
  return (
    <Page>
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report' }, { label: 'Providers' }]} />}
        eyebrow="redact-secret · Report"
        title="Providers"
        lede="Counts are fixture rows for redact-secret on the current run. Open a provider to see its families, then pick a family to see every row behind it. A fixture in two families counts once for its provider."
        meta={[{ label: '', value: '82 providers' }, { label: '', value: '158 families' }, { label: '', value: '5,034 fixtures' }, ...runMeta]}
      />
      <ReportFilterBar label="Filter providers" query={query} onQueryChange={setQuery} show={show} onShowChange={setShow} resultText={`${visible.length} providers · ${familyCount} families`} />
      <ProviderTree providers={visible} expanded={!!q || show !== 'all'} label="Providers and their families" footnote="14 fixtures are global or not tied to one family and left out of this tree. They stay in the rows on the report." />
    </Page>
  );
}

/** `/report/providers`. */
export const Providers: Story = { render: () => <ProvidersPage /> };

export const ProvidersSearching: Story = { render: () => <ProvidersPage initialQuery="stripe" initialShow="signal" /> };

export const ProvidersNoMatch: Story = { render: () => <ProvidersPage initialQuery="zzzz" /> };

function FamiliesPage() {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<ReportShow>('all');
  const q = query.trim().toLowerCase();
  const shown = families.filter(f => matches(show, f.counts !== null, !!f.counts && (f.counts.leftReadable !== '0' || f.counts.falseAlarms !== '0')) && (!q || `${f.provider} ${f.name} ${f.id}`.toLowerCase().includes(q)));
  return (
    <Page>
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report' }, { label: 'Families' }]} />}
        eyebrow="redact-secret · Report"
        title="Families"
        lede="One row per credential family, in taxonomy order. Counts are fixture rows for redact-secret on the current run; a fixture in two families appears in both rows."
        meta={[{ value: '158 families' }, { value: '139 with fixtures' }, { value: '27 need a look' }, ...runMeta]}
      />
      <ReportFilterBar label="Filter families" query={query} onQueryChange={setQuery} show={show} onShowChange={setShow} resultText={`${shown.length} families`} />
      <FamilyTable families={shown} caption="Families" />
    </Page>
  );
}

/** `/report/families`. */
export const Families: Story = { render: () => <FamiliesPage /> };

/** A family opened from either list: `/report/providers?family=<id>`. */
export const FamilyDetail: Story = {
  render: () => (
    <Page>
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report' }, { label: 'Providers', href: '/report/providers' }, { label: 'GitHub', href: '/report/providers' }, { label: 'Fine-grained personal access token' }]} />}
        eyebrow="redact-secret · Report"
        title="Fine-grained personal access token"
        meta={[{ value: 'GitHub' }, { label: 'Detectors:', value: 'github-fine-grained-pat' }, ...runMeta]}
        actions={<Link href="/report/providers">All providers</Link>}
      />
      <FamilyAbout {...familyAbout} />
      <FixtureTable familyName="Fine-grained personal access token" rows={fixtureRows} facts={familyFacts} description="6 rows for redact-secret only. Other scanners are on the comparison pages." />
    </Page>
  ),
};

export const FamilyWithoutFixtures: Story = {
  render: () => (
    <Page>
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report' }, { label: 'Providers', href: '/report/providers' }, { label: 'Vercel', href: '/report/providers' }, { label: 'Integration token' }]} />}
        eyebrow="redact-secret · Report"
        title="Integration token"
        meta={[{ value: 'Vercel' }, { label: 'Detectors:', value: 'none mapped' }, ...runMeta]}
      />
      <FamilyAbout description="Modern integration token identified only by the provider-documented vci stem." />
      <FixtureTable familyName="Integration token" rows={[]} description="" />
    </Page>
  ),
};

export const FamilyNotFound: Story = {
  render: () => (
    <Page>
      <PageHead before={<Breadcrumb items={[{ label: 'Report', href: '/report' }, { label: 'Providers', href: '/report/providers' }, { label: 'not-a-family' }]} />} title="No such family" />
      <EmptyState title="This family is not in the taxonomy" action={<Link href="/report/providers">Back to providers</Link>}>
        Family ids look like <Code>aws:iam-user-access-key</Code>.
      </EmptyState>
    </Page>
  ),
};
