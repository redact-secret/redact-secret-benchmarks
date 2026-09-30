import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Feedback/EmptyState',
  component: EmptyState,
  args: { title: 'Not measured yet' },
} satisfies Meta<typeof EmptyState>;
export default meta;

type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

export const WithExplanation: Story = {
  args: { children: 'No credential text has been timed across these libraries. How well scanners find secrets is in the report.' },
};

export const WithCommandAndAction: Story = {
  args: {
    children: 'Run the measurement, then rebuild the site.',
    command: 'npm run benchmark:performance',
    action: <a href="/report">Open the report</a>,
  },
};

export const NoRowsMatch: Story = {
  args: { title: 'No rows match these filters', children: 'Clear a filter to see rows again.' },
};
