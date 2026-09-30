import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ThreeAnswers } from './ThreeAnswers';
import { answerMeta, answers, levels } from './storyData';

const meta = {
  title: 'Report/ThreeAnswers',
  component: ThreeAnswers,
  args: {
    title: 'Three answers',
    eyebrow: 'PROVIDER-DOCUMENTED',
    meta: answerMeta,
    levels,
    currentLevelHref: '/report',
    answers,
  },
} satisfies Meta<typeof ThreeAnswers>;
export default meta;

type Story = StoryObj<typeof meta>;

/** T1, the provider-documented level. The mode (published) is stated in the run facts. */
export const Provider: Story = {};

export const ToolCorroborated: Story = {
  args: {
    eyebrow: 'TOOL-CORROBORATED',
    currentLevelHref: '/report?level=T2',
    meta: [{ label: 'Run', value: '2026-09-30' }, { label: 'Mode', value: 'candidate' }, { label: 'Accounting', value: 'v1.1' }],
    answers: [
      { ...answers[0], value: '5.1%', observation: { strong: '61 of 1,190', rest: 'secret spans leaked' } },
      { ...answers[1], value: '14.2%', observation: { strong: '2 of 40', rest: 'controls flagged' }, status: undefined },
      { ...answers[2], value: '91.0%', observation: { strong: '410 of 452', rest: 'pairs discriminated' } },
    ],
  },
};

export const ProjectPolicy: Story = {
  args: { eyebrow: 'PROJECT POLICY', currentLevelHref: '/report?level=T3' },
};

export const NoFigures: Story = { args: { answers: [], eyebrow: 'PROJECT POLICY', currentLevelHref: '/report?level=T3' } };

export const LongContent: Story = {
  args: {
    answers: answers.map(a => ({ ...a, question: `${a.question} (asked with a deliberately long qualifying clause that wraps across several lines)`, definition: `${a.definition} ${a.definition}` })),
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
