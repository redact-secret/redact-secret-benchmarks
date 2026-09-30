import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccuracyPairBar } from './AccuracyPairBar';
import { credentialsBar, longBar, piiBar } from './accuracyFixtures';

const meta = {
  title: 'Comparison/AccuracyPairBar',
  component: AccuracyPairBar,
  args: { rows: credentialsBar },
} satisfies Meta<typeof AccuracyPairBar>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Credentials: data, tool, evidence level and test files. Every option is a link. */
export const Credentials: Story = {};
/** Personal data offers only the runtime libraries and has no level or scope. */
export const PersonalData: Story = { args: { rows: piiBar } };
/** Worst case: long tool names wrap inside their own switch. */
export const LongNames: Story = { args: { rows: longBar } };
/** On a phone each row stacks, each switch takes the full width and the bar stops pinning. */
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
