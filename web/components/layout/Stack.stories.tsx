import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Cluster, Stack } from './Stack';

const meta = {
  title: 'Layout/Stack',
  component: Stack,
  args: { children: [<p key="a">First block</p>, <p key="b">Second block</p>, <p key="c">Third block</p>] },
} satisfies Meta<typeof Stack>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const TightGap: Story = { args: { gap: 'xs' } };
export const LooseGap: Story = { args: { gap: 'xl' } };

export const ClusterWrapping: Story = {
  render: () => (
    <Cluster gap="sm">
      {Array.from({ length: 24 }, (_, i) => <span key={i}>item-{i + 1}</span>)}
    </Cluster>
  ),
};

export const ClusterSpaceBetween: Story = {
  render: () => (
    <Cluster justify="between">
      <span>Left</span>
      <span>Right</span>
    </Cluster>
  ),
};
