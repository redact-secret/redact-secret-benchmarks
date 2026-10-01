import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RcBuilds } from './RcBuilds';
import { builds, candidateBuild, releaseOnly, unknownRelease } from './storyData';

const meta = {
  title: 'Evaluation/Release candidate/Builds',
  component: RcBuilds,
  args: builds,
} satisfies Meta<typeof RcBuilds>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoCandidate: Story = { args: releaseOnly };

export const ReleaseNotRecorded: Story = { args: unknownRelease };

export const DirtyIncompleteCandidate: Story = {
  args: {
    candidate: {
      ...candidateBuild,
      tags: ['unreleased', 'filtered'],
      facts: [
        { term: 'Commit', value: '1234567890abcdef1234567890abcdef12345678', href: 'https://example.invalid/commit/1234567', mono: true, note: 'dirty' },
        { term: 'Date', value: 'Measured 2026-01-02' },
        { term: 'Run', value: '00000000 · incomplete · filtered', mono: true },
        { term: 'Scanned', value: '3 of 100 fixtures' },
      ],
    },
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
