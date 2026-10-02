import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RulesStrip } from './RulesStrip';

const meta = {
  title: 'Landing/RulesStrip',
  component: RulesStrip,
  args: {
    label: 'The rules of the benchmark',
    rules: [
      { strong: 'Same inputs', rest: ' for every tool' },
      { strong: 'Answers written first', rest: ', then scanners run' },
      { strong: 'Counts beside every rate', rest: '' },
    ],
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof RulesStrip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { rules: [] } };
export const Many: Story = { args: { rules: Array.from({ length: 8 }, (_, i) => ({ strong: `Rule ${i + 1}`, rest: ' with some words after it' })) } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const DarkTheme: Story = { globals: { theme: 'dark' } };
