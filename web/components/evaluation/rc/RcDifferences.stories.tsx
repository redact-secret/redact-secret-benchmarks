import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RcDifferences } from './RcDifferences';
import { differences } from './storyData';

const meta = {
  title: 'Evaluation/Release candidate/Differences',
  component: RcDifferences,
  args: differences,
} satisfies Meta<typeof RcDifferences>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Nothing moved: the counts are recorded zeros under the same stamp, never hidden. */
export const NothingMoved: Story = {
  args: {
    tiles: differences.tiles.map(t => ({ ...t, value: t.label === 'Unchanged' ? '45' : '0' })),
    figures: differences.figures.map(f => ({ ...f, value: '3', observation: 'release 3 → candidate 3 of 30' })),
  },
};

export const WorstCase: Story = {
  args: {
    tiles: differences.tiles.map(t => ({ ...t, value: t.label === 'Regressed' ? '12,345' : t.value })),
    figures: [{ label: 'Required secrets left readable', value: '1,234', detail: 'must-redact, evidence levels 1 and 2', observation: 'release 3 → candidate 1,234 of 1,234' }],
  },
};

export const NoFigures: Story = { args: { figures: [] } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
