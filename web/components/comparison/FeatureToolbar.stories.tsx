import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FeatureToolbar } from './FeatureToolbar';
import type { FeatureFilter } from './types';

const meta = {
  title: 'Comparison/FeatureToolbar',
  component: FeatureToolbar,
  args: { filter: 'all', onFilterChange: () => {} },
} satisfies Meta<typeof FeatureToolbar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {};
export const OnlyDifferences: Story = { args: { filter: 'differences' } };
/** The parent owns the state; the story keeps it in useState to show the interaction. */
export const Interactive: Story = {
  render: args => {
    const [filter, setFilter] = useState<FeatureFilter>('all');
    return <FeatureToolbar {...args} filter={filter} onFilterChange={setFilter} />;
  },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
