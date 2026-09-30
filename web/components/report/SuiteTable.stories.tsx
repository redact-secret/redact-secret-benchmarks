import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SuiteTable } from './SuiteTable';
import { suiteRows } from './fixtureStoryData';

const meta = {
  title: 'Report/SuiteTable',
  component: SuiteTable,
  args: { suites: suiteRows, caption: 'Suites' },
} satisfies Meta<typeof SuiteTable>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { suites: [] } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
