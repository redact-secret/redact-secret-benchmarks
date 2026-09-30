import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PageContainer } from './PageContainer';

const meta = {
  title: 'Layout/PageContainer',
  component: PageContainer,
  args: { children: 'Content sits inside the page gutters and never scrolls the page sideways.' },
} satisfies Meta<typeof PageContainer>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Page: Story = {};

export const ReadingColumn: Story = {
  args: {
    width: 'measure',
    children: 'A reading column stops at the measure so long lines stay readable. '.repeat(8),
  },
};

export const LongUnbrokenContent: Story = {
  args: { children: 'sk_test_' + 'x'.repeat(200) },
};
