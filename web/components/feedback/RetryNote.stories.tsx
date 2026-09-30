import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RetryNote } from './RetryNote';

const meta = {
  title: 'Feedback/RetryNote',
  component: RetryNote,
  args: {
    title: 'Could not load the rows',
    children: 'The file did not arrive. The first page is shown; search, filters and paging need the rest.',
    onRetry: () => {},
  },
} satisfies Meta<typeof RetryNote>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Failed: Story = {};

export const Offline: Story = {
  args: { title: 'You are offline', children: 'Reconnect and the rest of the rows load by themselves, or try again now.' },
};

export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
