import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RcNotRecorded } from './RcNotRecorded';
import { invalid, notRecorded } from './storyData';

const meta = {
  title: 'Evaluation/Release candidate/Not recorded',
  component: RcNotRecorded,
  args: notRecorded,
} satisfies Meta<typeof RcNotRecorded>;
export default meta;

type Story = StoryObj<typeof meta>;

/** No candidate evidence in this build: the common state in CI and on production. */
export const NoCandidate: Story = {};

/** Evidence is present but does not match the candidate contract. */
export const EvidenceInvalid: Story = { args: invalid };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
