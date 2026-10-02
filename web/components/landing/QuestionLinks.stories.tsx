import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QuestionLinks } from './QuestionLinks';

const QUESTIONS = [
  { href: '/report/', kicker: 'Accuracy', title: 'Does it hide every secret, and only secrets?', text: 'Missed bytes, false alarms and near-twins it must tell apart.', action: 'Read the report →' },
  { href: '/comparison/performance/', kicker: 'Efficiency', title: 'How long does it take on real-shaped text?', text: 'Time across sizes and shapes, shown as absolute times.', action: 'See performance →' },
  { href: '/evaluation/', kicker: 'Method', title: 'How do we know the answers are right?', text: 'Six evaluation methods and pinned scanner versions.', action: 'See how it is evaluated →' },
];

const meta = {
  title: 'Landing/QuestionLinks',
  component: QuestionLinks,
  args: { label: 'What the benchmark answers', questions: QUESTIONS },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof QuestionLinks>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongText: Story = { args: { questions: QUESTIONS.map(q => ({ ...q, text: `${q.text} `.repeat(6) })) } };
export const OneQuestion: Story = { args: { questions: QUESTIONS.slice(0, 1) } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const DarkTheme: Story = { globals: { theme: 'dark' } };
