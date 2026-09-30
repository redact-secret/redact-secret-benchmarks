import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MetaList } from './MetaList';

const meta = {
  title: 'Page/MetaList',
  component: MetaList,
  args: {
    items: [
      { label: 'Run', value: '2026-09-30' },
      { label: 'Same 5,034 inputs for', value: '4 scanners' },
      { label: 'Accounting', value: 'v1.1' },
    ],
  },
} satisfies Meta<typeof MetaList>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithLink: Story = {
  args: { items: [{ label: 'Run', value: '2026-09-30' }, { value: <a href="/how-to-read">How to read these numbers</a> }] },
};
export const Empty: Story = { args: { items: [] } };
export const Many: Story = {
  args: { items: Array.from({ length: 12 }, (_, i) => ({ label: `Field ${i + 1}`, value: `value-${i + 1}` })) },
};
