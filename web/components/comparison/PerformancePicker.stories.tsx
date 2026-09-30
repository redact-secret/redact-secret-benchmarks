import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PerformancePicker } from './PerformancePicker';
import { picker } from './performance-fixtures';

const meta = {
  title: 'Comparison/PerformancePicker',
  component: PerformancePicker,
  args: picker,
} satisfies Meta<typeof PerformancePicker>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OtherLibrary: Story = {
  args: {
    controls: [
      { ...picker.controls[0], currentHref: picker.controls[0].items[1].href },
      { ...picker.controls[1], currentHref: picker.controls[1].items[0].href },
    ],
    legend: [{ side: 'a', label: 'redact-secret · Default' }, { side: 'b', label: 'OpenRedaction · defaults' }],
  },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
