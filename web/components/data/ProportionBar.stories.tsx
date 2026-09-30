import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ProportionBar } from './ProportionBar';

const meta = {
  title: 'Data/ProportionBar',
  component: ProportionBar,
  args: { value: 58, max: 361, label: '58 of 361 spans' },
} satisfies Meta<typeof ProportionBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithMarker: Story = { args: { marker: 120, label: '58 of 361 spans; earlier run 120' } };
export const Thin: Story = { args: { size: 'thin' } };
export const Empty: Story = { args: { value: 0, label: '0 of 361 spans' } };
export const Full: Story = { args: { value: 361, label: '361 of 361 spans' } };
export const ZeroMaxIsEmpty: Story = { args: { value: 5, max: 0, label: 'No inputs' } };
