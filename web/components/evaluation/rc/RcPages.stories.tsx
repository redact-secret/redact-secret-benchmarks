import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Note } from '../../feedback';
import { Stack } from '../../layout';
import { Breadcrumb, PageHead } from '../../page';
import { RcBuilds } from './RcBuilds';
import { RcDifferences } from './RcDifferences';
import { RcLevels } from './RcLevels';
import { RcMoved } from './RcMoved';
import { RcNotRecorded } from './RcNotRecorded';
import { RcPerformance } from './RcPerformance';
import { builds, differences, invalid, levels, moved, notRecorded, performance, releaseOnly } from './storyData';

/** `/evaluation/rc/` assembled from the blocks, for reading the page as a whole. The route does the same from the resolver. */
const meta = {
  title: 'Evaluation/Release candidate/Pages',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

const Head = ({ lede }: { lede: string }) => (
  <PageHead before={<Breadcrumb items={[{ label: 'Evaluation' }, { label: 'Release candidate' }]} />} eyebrow="EVALUATION · RELEASE CANDIDATE" title="Release candidate against the last release" lede={lede} />
);

const recordedLede = 'What the benchmark recorded for the redact-secret commit in development, set beside what it recorded for the last released version. These are recorded differences. Nothing here approves or blocks a release.';

const Recorded = ({ warn }: { warn?: boolean }) => (
  <Stack gap="lg">
    <Head lede={recordedLede} />
    {warn && <Note tone="warning" title="Filtered run">This run is filtered to one detector. It is a development reading of part of the suite, not the full comparison.</Note>}
    <RcBuilds {...builds} />
    <RcDifferences {...differences} />
    <RcLevels {...levels} />
    <RcMoved {...moved} />
    <RcPerformance {...performance} />
  </Stack>
);

export const CandidateRecorded: Story = { render: () => <Recorded /> };

export const CandidateRecordedFiltered: Story = { render: () => <Recorded warn /> };

export const NoCandidateRecorded: Story = {
  render: () => (
    <Stack gap="lg">
      <Head lede="What the benchmark records for the redact-secret commit in development, set beside the last released version. No candidate is recorded in this build, so the last release is shown for reference." />
      <RcNotRecorded {...notRecorded} />
      <RcBuilds {...releaseOnly} />
      <RcPerformance {...performance} heading="No candidate to compare" />
    </Stack>
  ),
};

export const EvidenceInvalid: Story = {
  render: () => (
    <Stack gap="lg">
      <Head lede="No candidate could be read, so the last release is shown for reference." />
      <RcNotRecorded {...invalid} />
      <RcBuilds {...releaseOnly} />
    </Stack>
  ),
};

export const Phone: Story = { render: () => <Recorded />, globals: { viewport: { value: 'mobile1', isRotated: false } } };

export const PhoneNoCandidate: Story = {
  render: () => (
    <Stack gap="lg">
      <Head lede="No candidate is recorded in this build." />
      <RcNotRecorded {...notRecorded} />
      <RcBuilds {...releaseOnly} />
    </Stack>
  ),
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
