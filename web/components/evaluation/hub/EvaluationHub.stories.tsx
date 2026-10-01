import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { EvaluationHub } from './EvaluationHub';
import { builtPhases, hubArgs, missingRun, noFacts, pendingPhases, recordedRun, scanners } from './storyData';

const meta = {
  title: 'Evaluation/Hub/EvaluationHub',
  component: EvaluationHub,
  parameters: { layout: 'fullscreen' },
  args: hubArgs,
} satisfies Meta<typeof EvaluationHub>;
export default meta;

type Story = StoryObj<typeof meta>;

/** `/evaluation` with every phase page built. */
export const Default: Story = { args: { phases: builtPhases } };

/** Phase pages another owner has not added to the section yet: named, dashed, and not links. */
export const PhasesNotBuiltYet: Story = { args: { phases: pendingPhases } };

/** No evaluation was published: nothing is counted, and the commands that produce it are shown. */
export const NotMeasured: Story = {
  args: { phases: pendingPhases, meta: [{ value: 'Not measured' }], methods: noFacts, run: missingRun },
};

/** A scanner that did not complete, and a long mode line. */
export const WorstCase: Story = {
  args: {
    run: {
      ...recordedRun,
      scanners: [
        ...scanners,
        { id: 'scanner-e', name: 'scanner-with-a-very-long-name-that-has-to-wrap', version: '10.20.30-beta.40+build.50', mode: 'Published npm package · default patterns (PII enabled) · pattern coverage only · JavaScript engine', observed: 'Snapshot, 2026-09-28', status: 'error' },
      ],
    },
  },
};

export const Phone: Story = { args: { phases: pendingPhases }, parameters: { viewport: { defaultViewport: 'mobile1' } } };
