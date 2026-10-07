import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScannerOverview } from './ScannerOverview';
import { optionalNotMeasured } from '../../qualification/storyData';
import { candidateNote, notRecorded, publishedNote, repositoryScanner, rosterNotRecorded, rosterRows, runtimeLibrary } from './storyData';

const meta = {
  title: 'Evaluation/Scanner/ScannerOverview',
  component: ScannerOverview,
  parameters: { layout: 'fullscreen' },
  args: {
    breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Scanners' }],
    eyebrow: 'Evaluation',
    title: 'Scanners and where they ran',
    lede: 'The scanners this benchmark ran with, the version of each, how it was installed, how it was run and what was left out. Results are on the report and comparison pages.',
    meta: [{ label: 'Mode', value: 'published · Alpha Library 1.2.3' }, { label: 'Run', value: '2026-10-01 · 3 suites' }],
    roster: { title: 'The scanners', description: 'Every scanner this benchmark ran with, in the order the run lists them.', rows: rosterRows },
    modeNote: publishedNote,
    profiles: [repositoryScanner, runtimeLibrary],
  },
} satisfies Meta<typeof ScannerOverview>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Published: Story = {};

export const Candidate: Story = { args: { modeNote: candidateNote, meta: [{ label: 'Mode', value: 'candidate · build 1.1.0-rc.1 at 0123456789ab' }] } };

/** An optional scanner the run did not measure is stated beside the roster, with the pointer to its last measurement (#763). */
export const OptionalScannerNotMeasured: Story = { args: { notMeasured: optionalNotMeasured.map(n => ({ ...n, link: n.link })) } };

/** No run is published: the roster keeps the pins and says "Not recorded" for the rest. */
export const NoRun: Story = { args: { meta: [], roster: { title: 'The scanners', description: 'No benchmark run is published for this checkout.', rows: rosterNotRecorded }, profiles: [notRecorded] } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
