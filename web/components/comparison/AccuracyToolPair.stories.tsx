import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccuracyToolPair } from './AccuracyToolPair';
import { ours, theirs, theirsLong } from './accuracyFixtures';

const meta = {
  title: 'Comparison/AccuracyToolPair',
  component: AccuracyToolPair,
  args: { ours, theirs },
} satisfies Meta<typeof AccuracyToolPair>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The two sides carry the same fields in the same order, at the same weight. */
export const Default: Story = {};
/** Personal data: no sentence about what each is built for, on either side. */
export const WithoutJob: Story = { args: { ours: { ...ours, job: undefined }, theirs: { ...theirs, job: undefined } } };
/** Worst case: an unbroken name, a long version and a long mode line wrap inside their column. */
export const LongContent: Story = { args: { theirs: theirsLong } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
