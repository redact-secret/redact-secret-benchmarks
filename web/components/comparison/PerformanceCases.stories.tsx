import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PerformanceCases } from './PerformanceCases';
import { group, sideA, sideB, ticks, worstGroup } from './performance-fixtures';

const meta = {
  title: 'Comparison/PerformanceCases',
  component: PerformanceCases,
  args: { group, sides: [sideA, sideB], ticks },
} satisfies Meta<typeof PerformanceCases>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The last row carries the "not read as different" marking. */
export const Default: Story = {};
/** Worst case: a wide spread, a time over a second, and a side with no time for one text. */
export const WorstCaseAndNotMeasured: Story = { args: { group: worstGroup } };
export const NoCases: Story = { args: { group: { ...group, cases: [] } } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const PhoneWorstCase: Story = { args: { group: worstGroup }, parameters: { viewport: { defaultViewport: 'mobile1' } } };
