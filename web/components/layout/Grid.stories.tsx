import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Grid } from './Grid';

const cell = (n: number) => <div key={n}><b>Cell {n}</b><p>Plain content that wraps inside its column.</p></div>;

const meta = {
  title: 'Layout/Grid',
  component: Grid,
  args: { children: [1, 2, 3, 4].map(cell) },
} satisfies Meta<typeof Grid>;
export default meta;

type Story = StoryObj<typeof meta>;

export const TwoColumns: Story = { args: { columns: 2 } };
export const ThreeColumns: Story = { args: { columns: 3, children: [1, 2, 3].map(cell) } };
export const FourColumns: Story = { args: { columns: 4 } };
export const Divided: Story = { args: { columns: 3, divided: true, children: [1, 2, 3].map(cell) } };
export const WideGap: Story = { args: { gap: 'lg' } };
export const LongUnbrokenCell: Story = {
  args: { children: [<div key="a">{'x'.repeat(120)}</div>, cell(2)] },
};
