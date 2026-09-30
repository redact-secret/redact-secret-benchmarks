import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccuracySources } from './AccuracySources';
import { sources } from './accuracyFixtures';

const meta = {
  title: 'Comparison/AccuracySources',
  component: AccuracySources,
  args: { title: 'Where this comes from', sources },
} satisfies Meta<typeof AccuracySources>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** Worst case: one long line with an unbroken run id wraps inside its column. */
export const LongLine: Story = { args: { sources: [{ text: `A long source line. ${'run-2000-01-01T00:00:00.000Z-abcdef'.repeat(4)}` }, ...sources] } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
