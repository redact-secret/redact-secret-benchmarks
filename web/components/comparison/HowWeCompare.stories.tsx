import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { HowWeCompare } from './HowWeCompare';
import { principles, runs } from './fixtures';

const meta = {
  title: 'Comparison/HowWeCompare',
  component: HowWeCompare,
  args: { title: 'How we compare', principles, runsLabel: 'Latest runs', runs },
} satisfies Meta<typeof HowWeCompare>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoRunsYet: Story = { args: { runs: [] } };
export const LongContent: Story = {
  args: { runs: [{ label: 'Runtime', detail: `redact-secret 0.1.0-beta.11, ${'flare-redact-1.6.1-'.repeat(8)}` }] },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
