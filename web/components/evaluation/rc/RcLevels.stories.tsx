import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RcLevels } from './RcLevels';
import { levels } from './storyData';

const meta = {
  title: 'Evaluation/Release candidate/Levels',
  component: RcLevels,
  args: levels,
} satisfies Meta<typeof RcLevels>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A candidate diff counts populations, never evidence levels: the first column says so. */
export const Populations: Story = {
  args: {
    title: 'By population',
    heading: 'Population',
    caption: 'Cases per population, published release against candidate',
    rows: [
      { id: 'population-a', title: 'Population A', detail: '3 still failing in the candidate', compared: '120', regressed: '1', improved: '2', other: '4', unchanged: '113' },
      { id: 'population-b', title: 'Population B', detail: '0 still failing in the candidate', compared: '40', regressed: '0', improved: '0', other: '0', unchanged: '40' },
    ],
  },
};

export const NoFixedRows: Story = { args: { rows: [] } };

export const LongNumbers: Story = {
  args: { rows: [{ id: 'T1', title: 'Provider-documented', detail: 'T1', compared: '1,234,567', regressed: '123,456', improved: '234,567', other: '12,345', unchanged: '864,199' }] },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
