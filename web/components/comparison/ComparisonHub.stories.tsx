import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ComparisonHub } from './ComparisonHub';
import { principles, questions, runs, toolKinds } from './fixtures';

const meta = {
  title: 'Comparison/ComparisonHub',
  component: ComparisonHub,
  parameters: { layout: 'fullscreen' },
  args: {
    eyebrow: 'Comparison',
    title: 'How does redact-secret compare?',
    lede: 'We run redact-secret and other tools on the same made-up data and record what each one did. Pick the question you came with.',
    questions,
    kindsTitle: 'Two kinds of tools',
    kindsIntro: 'They solve different problems, so they are compared on different pages. redact-secret is a runtime library that also ships a command line tool.',
    kinds: toolKinds,
    methodTitle: 'How we compare',
    principles,
    runsLabel: 'Latest runs',
    runs,
  },
} satisfies Meta<typeof ComparisonHub>;
export default meta;

type Story = StoryObj<typeof meta>;

/** `/comparison`: the whole hub as the page will assemble it. */
export const Default: Story = {};
export const NoRunsYet: Story = { args: { runs: [] } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
