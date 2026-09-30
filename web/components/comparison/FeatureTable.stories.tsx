import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FeatureTable } from './FeatureTable';
import { featureGroups, featureLibraries, manyLibraries } from './fixtures';

const meta = {
  title: 'Comparison/FeatureTable',
  component: FeatureTable,
  args: { libraries: featureLibraries, groups: featureGroups, caption: 'What each library says it can do. A mark means listed only.' },
} satisfies Meta<typeof FeatureTable>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OnlyDifferences: Story = { args: { filter: 'differences' } };
/** Every row reads the same: the filter leaves nothing, and the table says so. */
export const OnlyDifferencesNone: Story = { args: { filter: 'differences', groups: featureGroups.map(g => ({ ...g, rows: g.rows.map(r => ({ ...r, same: true })) })) } };
export const Empty: Story = { args: { groups: [] } };
/** Worst case: six libraries, a library with no cell for a row, and very long notes. */
export const ManyLibraries: Story = {
  args: {
    libraries: manyLibraries,
    groups: [
      {
        label: 'WHERE IT RUNS',
        rows: [
          { id: 'a', label: 'Node.js', same: false, cells: { rs: { mark: 'yes', note: 'Native add-on', tested: true }, fr: { mark: 'yes' }, or: { mark: 'no' }, a: { mark: 'partly', note: 'x'.repeat(120) }, b: { mark: 'yes', note: 'unbrokenstring'.repeat(8) } } },
        ],
      },
    ],
  },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
