import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ToolKinds } from './ToolKinds';
import { toolKinds } from './fixtures';

const meta = {
  title: 'Comparison/ToolKinds',
  component: ToolKinds,
  args: {
    title: 'Two kinds of tools',
    intro: 'They solve different problems, so they are compared on different pages. redact-secret is a runtime library that also ships a command line tool.',
    kinds: toolKinds,
  },
} satisfies Meta<typeof ToolKinds>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ThreeKinds: Story = { args: { kinds: [...toolKinds, { name: 'Hosted services', description: 'Run outside your app and are called over a network.', tools: [], comparedIn: 'Not compared on any page yet.' }] } };
export const NoTools: Story = { args: { kinds: toolKinds.map(k => ({ ...k, tools: [] })) } };
export const LongContent: Story = {
  args: {
    kinds: [
      { ...toolKinds[0], tools: Array.from({ length: 8 }, (_, i) => ({ name: `runtime-library-${i + 1}`, detail: 'Node.js, browsers, Python, Rust, command line, WebAssembly' })) },
      toolKinds[1],
    ],
  },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
