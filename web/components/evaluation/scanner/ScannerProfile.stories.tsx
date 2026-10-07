import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScannerProfile } from './ScannerProfile';
import { longContent, notRecorded, officialHost, repositoryScanner, runtimeLibrary } from './storyData';

const meta = {
  title: 'Evaluation/Scanner/ScannerProfile',
  component: ScannerProfile,
  args: repositoryScanner,
} satisfies Meta<typeof ScannerProfile>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A repository scanner: the exact arguments sit in a disclosure. */
export const RepositoryScanner: Story = {};

/** A runtime library: it is also in the runtime, feature and performance comparisons. */
export const RuntimeLibrary: Story = { args: runtimeLibrary };

/** Nothing recorded about the scanner beyond its pin: every missing fact is a dashed "Not recorded", never a guess. */
export const NotRecorded: Story = { args: notRecorded };

/** An official run: the measurement host from the artifact, and "Unavailable" with its reason for the facts a run recorded before #620/#621 does not hold. */
export const OfficialRunHost: Story = { args: officialHost };

/** Long names, an unbroken digest and six statements wrap inside their columns. */
export const LongContent: Story = { args: longContent };

export const Phone: Story = { args: runtimeLibrary, globals: { viewport: { value: 'mobile1', isRotated: false } } };
