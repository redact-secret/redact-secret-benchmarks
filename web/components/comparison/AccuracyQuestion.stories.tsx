import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccuracyDifferences } from './AccuracyDifferences';
import { AccuracyQuestion } from './AccuracyQuestion';
import { aloneQuestion, differences, emptyQuestion, fewQuestion, hiddenQuestion, leftOutQuestion, nearlyAllQuestion } from './accuracyFixtures';

const meta = {
  title: 'Comparison/AccuracyQuestion',
  component: AccuracyQuestion,
  args: { question: hiddenQuestion },
} satisfies Meta<typeof AccuracyQuestion>;
export default meta;

type Story = StoryObj<typeof meta>;

/** What the files are and what they expect, then one row per tool against that answer. */
export const Default: Story = {};
export const LeftAlone: Story = { args: { question: aloneQuestion } };
/** The differences go under the rows, second, both directions. */
export const WithDifferences: Story = { args: { differences: <AccuracyDifferences {...differences} /> } };
/** Fewer than 20 files: counts only, and the page says why. */
export const FewFiles: Story = { args: { question: fewQuestion } };
/** No test file to read here: a dashed "Nothing to compare", never a zero. */
export const Empty: Story = { args: { question: emptyQuestion } };
/** Files one side recorded nothing for are left out and said so. */
export const LeftOut: Story = { args: { question: leftOutQuestion } };
export const NearlyAll: Story = { args: { question: nearlyAllQuestion } };
export const Phone: Story = { args: { differences: <AccuracyDifferences {...differences} /> }, parameters: { viewport: { defaultViewport: 'mobile1' } } };
