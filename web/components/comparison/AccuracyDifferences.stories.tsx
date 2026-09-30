import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccuracyDifferences } from './AccuracyDifferences';
import { differences, flatDifferences, longLists, neither, oneSided } from './accuracyFixtures';

const meta = {
  title: 'Comparison/AccuracyDifferences',
  component: AccuracyDifferences,
  args: differences,
} satisfies Meta<typeof AccuracyDifferences>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Both directions, grouped by provider, alphabetical; each file links to its fixture page. */
export const Default: Story = {};
/** Both directions always render, even when one has nothing. */
export const OneSided: Story = { args: oneSided };
export const NoDifferences: Story = { args: neither };
/** Personal-data texts have no page, so they are a flat list of labels. */
export const FlatList: Story = { args: flatDifferences };
/** Worst case: 40 of 240 providers, a long provider name, a very long slug. "Show all" is controlled by the parent. */
export const LongLists: Story = {
  render: args => {
    const [all, setAll] = useState(false);
    return (
      <AccuracyDifferences
        {...args}
        columns={args.columns.map((c, i) => (i === 0 && all ? { ...c, more: undefined } : c))}
        onShowAll={() => setAll(true)}
      />
    );
  },
  args: longLists,
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
