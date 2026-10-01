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

export const NoFixedRows: Story = { args: { rows: [] } };

export const LongNumbers: Story = {
  args: { rows: [{ id: 'T1', title: 'Provider-documented', detail: 'T1', compared: '1,234,567', regressed: '123,456', improved: '234,567', other: '12,345', unchanged: '864,199' }] },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
