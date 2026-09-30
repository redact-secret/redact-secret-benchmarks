import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RuntimeToolbar } from './RuntimeToolbar';
import { legend, runtimeViews } from './fixtures';

const views = runtimeViews('/comparison/runtime');

const meta = {
  title: 'Comparison/RuntimeToolbar',
  component: RuntimeToolbar,
  args: { views, currentHref: views[0].href, view: 'all', legend },
} satisfies Meta<typeof RuntimeToolbar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {};
/** Speed hides the legend: there are no outcome icons to read. */
export const Speed: Story = { args: { currentHref: views[1].href, view: 'speed' } };
export const Accuracy: Story = { args: { currentHref: views[2].href, view: 'accuracy' } };
/** Libraries without a per-setting switch have no "Switch off" entry. */
export const LegendWithoutSwitchOff: Story = { args: { legend: legend.slice(0, 3) } };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
