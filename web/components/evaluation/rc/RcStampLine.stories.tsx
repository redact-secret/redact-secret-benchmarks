import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RcStampLine } from './RcStampLine';
import { stamp } from './storyData';

const meta = {
  title: 'Evaluation/Release candidate/Stamp line',
  component: RcStampLine,
  args: { stamp },
} satisfies Meta<typeof RcStampLine>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongRunIds: Story = {
  args: { stamp: { ...stamp, from: `published 0.1.0-beta.0 · run ${'2026-01-01T00:00:00.000Z-aaaaaa'.repeat(3)}` } },
};
