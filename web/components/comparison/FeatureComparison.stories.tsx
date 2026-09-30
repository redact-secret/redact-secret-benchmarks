import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FeatureComparison } from './FeatureComparison';
import { featureGroups, featureLibraries, featureSources } from './fixtures';
import type { FeatureFilter } from './types';

const meta = {
  title: 'Comparison/FeatureComparison',
  component: FeatureComparison,
  parameters: { layout: 'fullscreen' },
  args: {
    breadcrumb: [{ label: 'Comparison', href: '/comparison' }, { label: 'Features' }],
    eyebrow: 'Comparison · Features',
    title: 'What can each one do?',
    lede: 'What each library says it can do, taken from its own docs. Being listed says nothing about how well a feature works. To see what each one actually did on the same text, open the runtime comparison.',
    runtime: { href: '/comparison/runtime', label: 'Runtime comparison →' },
    libraries: featureLibraries,
    groups: featureGroups,
    filter: 'all',
    onFilterChange: () => {},
    sourcesTitle: 'Where this comes from',
    sources: featureSources,
  },
} satisfies Meta<typeof FeatureComparison>;
export default meta;

type Story = StoryObj<typeof meta>;

/** `/comparison/feature`, with the filter kept in useState the way the page's client wrapper will. */
export const Default: Story = {
  render: args => {
    const [filter, setFilter] = useState<FeatureFilter>('all');
    return <FeatureComparison {...args} filter={filter} onFilterChange={setFilter} />;
  },
};
export const OnlyDifferences: Story = { args: { filter: 'differences' } };
export const NoFeaturesYet: Story = { args: { groups: [], sources: [] } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
