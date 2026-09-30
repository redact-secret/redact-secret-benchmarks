import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccuracyResultRow } from './AccuracyResultRow';
import { aloneQuestion, fewQuestion, hiddenQuestion, nearlyAllQuestion, uniformQuestion } from './accuracyFixtures';

const meta = {
  title: 'Comparison/AccuracyResultRow',
  component: AccuracyResultRow,
  args: { result: hiddenQuestion.results[0] },
} satisfies Meta<typeof AccuracyResultRow>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Three states: solid is the expected answer, hatched is partly, empty is not. Shape, not colour. */
export const Default: Story = {};
export const OtherTool: Story = { args: { result: hiddenQuestion.results[1] } };
export const TwoStates: Story = { args: { result: aloneQuestion.results[1] } };
/** Fewer than 20 files: the count replaces the percentage. */
export const CountsOnly: Story = { args: { result: fewQuestion.results[1] } };
/** Every file in the expected state, and none of them. */
export const AllOneState: Story = { args: { result: uniformQuestion.results[0] } };
export const NoneInExpectedState: Story = { args: { result: uniformQuestion.results[1] } };
/** One file short of all reads 99.9%, never 100%; one in a few thousand reads 0.1%, never 0%. */
export const NearlyAll: Story = { args: { result: nearlyAllQuestion.results[0] } };
export const NearlyNone: Story = { args: { result: nearlyAllQuestion.results[1] } };
/** Worst case: a long name and a long version wrap, a five-digit count stays on one line. */
export const LongName: Story = {
  args: { result: { ...hiddenQuestion.results[1], name: 'An-extremely-long-example-scanner-name-with-no-break-points', version: '10.20.30-beta.1+build.12345678901234567890' } },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
