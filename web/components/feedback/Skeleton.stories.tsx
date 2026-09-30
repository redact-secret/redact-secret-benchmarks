import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Skeleton, SkeletonBlock } from './Skeleton';

const meta = {
  title: 'Feedback/Skeleton',
  component: Skeleton,
  args: { label: 'Loading the fixture', children: null },
} satisfies Meta<typeof Skeleton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Lines: Story = {
  args: { children: <><SkeletonBlock width="wide" /><SkeletonBlock /><SkeletonBlock width="half" /></> },
};

export const PageOfAFixture: Story = {
  args: {
    children: (
      <>
        <SkeletonBlock shape="heading" width="half" />
        <SkeletonBlock shape="panel" />
        <SkeletonBlock shape="panel" />
      </>
    ),
  },
};

export const Narrow: Story = {
  args: { children: <SkeletonBlock shape="panel" /> },
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
