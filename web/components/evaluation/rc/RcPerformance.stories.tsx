import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RcPerformance } from './RcPerformance';
import { performance } from './storyData';

const meta = {
  title: 'Evaluation/Release candidate/Performance',
  component: RcPerformance,
  args: performance,
} satisfies Meta<typeof RcPerformance>;
export default meta;

type Story = StoryObj<typeof meta>;

export const NotRecorded: Story = {};

export const NoCandidate: Story = { args: { heading: 'No candidate to compare', text: 'The accepted performance run measured commit aaaaaaa (5 repetitions). No candidate is recorded, so no cost is compared and nothing is estimated.' } };

export const NoRunPublished: Story = { args: { heading: 'No performance run is recorded', text: 'evidence/example/summary.json is absent: the accepted run\'s summary has not been committed. Nothing is estimated.' } };
