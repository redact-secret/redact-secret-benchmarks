import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SegmentedControl } from './SegmentedControl';

type Rows = 'all' | 'diff';
const OPTIONS: Array<{ value: Rows; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'diff', label: 'Only differences' },
];

const meta = {
  title: 'Nav/SegmentedControl',
  component: SegmentedControl<Rows>,
  args: { options: OPTIONS, value: 'all', onChange: () => {}, label: 'Rows' },
} satisfies Meta<typeof SegmentedControl<Rows>>;
export default meta;

type Story = StoryObj<typeof meta>;

export const FirstSelected: Story = {};
export const SecondSelected: Story = { args: { value: 'diff' } };

/** The parent owns the value; the story keeps it in local state only to show the interaction. */
export const Interactive: Story = {
  render: args => {
    const [value, setValue] = useState<Rows>('all');
    return <SegmentedControl<Rows> {...args} value={value} onChange={setValue} />;
  },
};

export const ThreeOptions: StoryObj<typeof SegmentedControl<'all' | 'speed' | 'accuracy'>> = {
  render: () => (
    <SegmentedControl
      label="View"
      value="speed"
      onChange={() => {}}
      options={[{ value: 'all', label: 'All' }, { value: 'speed', label: 'Speed' }, { value: 'accuracy', label: 'Accuracy' }]}
    />
  ),
};
