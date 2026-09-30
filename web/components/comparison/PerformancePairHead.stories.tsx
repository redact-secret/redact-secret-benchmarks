import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PerformancePairHead } from './PerformancePairHead';
import { longSides, sides } from './performance-fixtures';

const meta = {
  title: 'Comparison/PerformancePairHead',
  component: PerformancePairHead,
  args: { sides },
} satisfies Meta<typeof PerformancePairHead>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** Long names and versions wrap inside their own side. */
export const LongContent: Story = { args: { sides: longSides } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
