import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { IntervalBar } from './IntervalBar';

const meta = {
  title: 'Data/IntervalBar',
  component: IntervalBar,
  args: {
    ariaLabel: 'Observed 2.4%. Published bound: at most 3.6%. Axis 0% to 5%.',
    observed: 0.4883,
    bound: 0.7106,
    range: [0.4883, 0.7106],
    axisMin: '0%',
    axisMax: '5%',
  },
} satisfies Meta<typeof IntervalBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const AtMost: Story = {};

export const AtLeast: Story = {
  args: {
    ariaLabel: 'Observed 97.4%. Published bound: at least 95.9%. Axis 0% to 100%.',
    observed: 0.9735,
    bound: 0.9585,
    range: [0.9585, 0.9735],
    axisMax: '100%',
  },
};

export const ZeroObserved: Story = {
  args: {
    ariaLabel: 'Observed 0.0%. Published bound: at most 27.8%. Axis 0% to 50%.',
    observed: 0,
    bound: 0.5551,
    range: [0, 0.5551],
    axisMax: '50%',
  },
};

export const WideBound: Story = {
  args: { ariaLabel: 'Observed 0.0%. Published bound: at most 100%. Axis 0% to 100%.', observed: 0, bound: 1, range: [0, 1], axisMax: '100%' },
};

/** Fractions outside 0 to 1 are clamped to the axis, never drawn past it. */
export const OutOfRangeIsClamped: Story = { args: { observed: 1.4, bound: -0.2, range: undefined } };
