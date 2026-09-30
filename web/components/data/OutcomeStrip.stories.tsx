import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { OutcomeStrip } from './OutcomeStrip';

const meta = {
  title: 'Data/OutcomeStrip',
  component: OutcomeStrip,
  args: {
    label: '40 redacted, 8 partly, 2 left readable, 3 not applicable',
    segments: [
      { kind: 'fill', weight: 40 },
      { kind: 'hatch', weight: 8 },
      { kind: 'wide', weight: 2 },
      { kind: 'outline', weight: 3 },
    ],
  },
} satisfies Meta<typeof OutcomeStrip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Mixed: Story = {};
export const SingleKind: Story = { args: { label: '12 redacted', segments: [{ kind: 'fill', weight: 12 }] } };
export const Empty: Story = { args: { label: 'No outcomes recorded', segments: [] } };
export const ZeroWeightDropped: Story = {
  args: { label: '5 redacted', segments: [{ kind: 'fill', weight: 5 }, { kind: 'hatch', weight: 0 }] },
};
export const TinySegmentNextToLarge: Story = {
  args: { label: '1 left readable, 5,000 redacted', segments: [{ kind: 'fill', weight: 5000 }, { kind: 'wide', weight: 1 }] },
};
