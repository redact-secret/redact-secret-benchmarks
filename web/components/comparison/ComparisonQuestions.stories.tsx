import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ComparisonQuestions } from './ComparisonQuestions';
import { questions } from './fixtures';

const meta = {
  title: 'Comparison/ComparisonQuestions',
  component: ComparisonQuestions,
  args: { questions, label: 'Comparisons' },
} satisfies Meta<typeof ComparisonQuestions>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const OneQuestion: Story = { args: { questions: questions.slice(0, 1) } };
export const NoTools: Story = { args: { questions: questions.map(q => ({ ...q, tools: [], factNote: undefined })) } };
export const LongContent: Story = {
  args: {
    questions: [
      { ...questions[0], title: 'A question whose title is long enough that it has to wrap across several lines on a narrow screen without breaking the row', tools: Array.from({ length: 9 }, (_, i) => `tool-with-a-long-name-${i + 1}`), fact: '1,234 test texts', factNote: 'x'.repeat(80) },
    ],
  },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
