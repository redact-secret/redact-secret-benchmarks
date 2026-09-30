import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PerformanceMethod } from './PerformanceMethod';
import { method } from './performance-fixtures';

const meta = {
  title: 'Comparison/PerformanceMethod',
  component: PerformanceMethod,
  args: method,
} satisfies Meta<typeof PerformanceMethod>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoRun: Story = { args: { items: ['No run is committed for this setting, so there is no run to describe.'] } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
