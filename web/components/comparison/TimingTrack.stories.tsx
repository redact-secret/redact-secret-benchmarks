import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TimingKey, TimingTrack } from './TimingTrack';
import { picker, ticks } from './performance-fixtures';

const at = (ms: number) => Math.round((Math.log10(ms) / 4) * 10000) / 10000;

const meta = {
  title: 'Comparison/TimingTrack',
  component: TimingTrack,
  args: {
    ticks,
    axis: true,
    ariaLabel: 'Does it catch real sensitive values? redact-secret: 365.4 ms; flare-redact: 8.3 ms.',
    marks: [
      { side: 'b', position: at(8.3), label: 'flare-redact 8.3 ms', range: [at(8.1), at(16.1)] },
      { side: 'a', position: at(365.4), label: 'redact-secret 365.4 ms', range: [at(365), at(367)] },
    ],
  },
} satisfies Meta<typeof TimingTrack>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
/** Both marks on the same spot: `a` draws on top and the hollow one stays visible around it. */
export const Overlapping: Story = {
  args: {
    marks: [
      { side: 'b', position: at(20), label: 'flare-redact 20 ms', range: [at(15), at(30)] },
      { side: 'a', position: at(20), label: 'redact-secret 20 ms', range: [at(11), at(40)] },
    ],
  },
};
/** Worst case: a range spanning two decades and a time at the end of the axis. */
export const WideSpread: Story = {
  args: {
    marks: [
      { side: 'b', position: at(9100), label: 'flare-redact 9,100 ms', range: [at(443), at(9100)] },
      { side: 'a', position: at(1), label: 'redact-secret 1.0 ms' },
    ],
  },
};
/** Empty: one side has no time, so only its mate is drawn. */
export const OneSideOnly: Story = { args: { marks: [{ side: 'a', position: at(68.3), label: 'redact-secret 68.3 ms', range: [at(68.1), at(69.3)] }] } };
export const NoMarks: Story = { args: { marks: [] } };
export const WithoutAxis: Story = { args: { axis: false } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };

export const Key: StoryObj<typeof TimingKey> = {
  render: () => <TimingKey items={picker.legend} note={picker.legendNote} />,
};
