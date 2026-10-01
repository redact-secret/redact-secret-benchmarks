import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RcMoved } from './RcMoved';
import { moved, movedLong, movedNone } from './storyData';

const meta = {
  title: 'Evaluation/Release candidate/Moved fixtures',
  component: RcMoved,
  args: moved,
} satisfies Meta<typeof RcMoved>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Both groups empty: the table says so in its body. */
export const NothingMoved: Story = { args: movedNone };

/** A group longer than the list: its heading holds the whole count and a line says how many rows are listed. */
export const Truncated: Story = { args: movedLong };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
