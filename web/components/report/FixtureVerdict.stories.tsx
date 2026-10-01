import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureVerdict } from './FixtureVerdict';
import { verdictExact, verdictFlagged, verdictLeft, verdictNotMeasured, verdictOver, verdictPolicy, verdictQuiet } from './fixturePageData';

const meta = {
  title: 'Report/FixtureVerdict',
  component: FixtureVerdict,
  args: { verdict: verdictExact },
} satisfies Meta<typeof FixtureVerdict>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Exact: Story = {};

/** One span partly covered, one not covered: the phrase, then the count of each in words. */
export const SomeLeftReadable: Story = { args: { verdict: verdictLeft } };

/** The candidate build is named with its commit and the word "candidate". */
export const PastTheEnvelope: Story = { args: { verdict: verdictOver } };

export const QuietControl: Story = { args: { verdict: verdictQuiet } };

export const FlaggedControl: Story = { args: { verdict: verdictFlagged } };

/** A project-policy outcome is information, never failure: the shape is the info shape. */
export const Policy: Story = { args: { verdict: verdictPolicy } };

/** No row: the reason, no figures, a dashed shape. */
export const NotMeasured: Story = { args: { verdict: verdictNotMeasured } };

export const LongText: Story = {
  args: {
    verdict: {
      ...verdictLeft,
      who: 'redact-secret candidate main 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
      explanation: 'Of 12 expected secret spans: 3 exact, 2 covered inside the envelope, 1 covered past the envelope, 3 partly covered, 3 not covered. '.repeat(2),
    },
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
