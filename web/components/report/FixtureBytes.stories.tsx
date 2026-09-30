import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureBytes } from './FixtureBytes';
import { fixtureLines, fixtureScanners, missedLines } from './fixtureStoryData';

const meta = {
  title: 'Report/FixtureBytes',
  component: FixtureBytes,
  args: {
    lines: fixtureLines,
    scanners: fixtureScanners,
    caption: 'Secret bytes 30–38. Envelope 24–38: a finding may extend this far at no cost. All values are synthetic test data.',
  },
} satisfies Meta<typeof FixtureBytes>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A solid bar over a finding, a hatched bar where the secret is partly exposed, and a whole-line finding that reaches past the envelope. */
export const Default: Story = {};

/** A missed secret is a dashed empty frame where it sits; the word beside it says so too. */
export const MissedSecret: Story = {
  args: { lines: missedLines, scanners: [{ id: 'gitleaks', name: 'Gitleaks', verdict: [{ status: 'fail', label: 'Left readable' }] }] },
};

/** A control has no secret span, so nothing is highlighted and any finding is a false alarm. */
export const QuietControl: Story = {
  args: {
    lines: [{ number: 1, segments: [{ text: 'example_value=placeholder\n' }], lanes: [] }],
    scanners: [],
    caption: 'No authored secret spans. Any finding on this file is a false alarm. All values are synthetic test data.',
  },
};

/** Long lines scroll inside their own region; the page never scrolls sideways. */
export const LongLines: Story = {
  args: {
    lines: [{ number: 1, segments: [{ text: `${'0123456789'.repeat(30)}\n` }], lanes: [] }, { number: 2, segments: [{ text: '' }], lanes: [] }],
    scanners: [],
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
