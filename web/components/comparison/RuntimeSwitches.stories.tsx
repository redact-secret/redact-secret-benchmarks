import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RuntimeSwitches } from './RuntimeSwitches';
import { runtimeSwitches } from './fixtures';

const meta = {
  title: 'Comparison/RuntimeSwitches',
  component: RuntimeSwitches,
  args: runtimeSwitches('internal', 'pii'),
} satisfies Meta<typeof RuntimeSwitches>;
export default meta;

type Story = StoryObj<typeof meta>;

export const InternalPii: Story = {};
export const ExternalPii: Story = { args: runtimeSwitches('external', 'pii') };
export const ExternalCredentials: Story = { args: runtimeSwitches('external', 'credentials') };
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
