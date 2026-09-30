import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NavRow } from './NavRow';

const meta = {
  title: 'Nav/NavRow',
  component: NavRow,
  args: {
    href: '/comparison/runtime',
    label: 'Runtime',
    title: 'How fast is each one, and what does it hide?',
    description: 'Time and output on the same text, for passwords and API keys and for personal data.',
    tools: ['redact-secret', 'flare-redact', 'OpenRedaction'],
    fact: '6 test texts',
    factNote: '3 for secrets, 3 for personal data',
    action: 'Runtime comparison →',
  },
} satisfies Meta<typeof NavRow>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Minimal: Story = { args: { description: undefined, tools: undefined, fact: undefined, factNote: undefined } };
export const LongTitle: Story = {
  args: { title: 'A very long question that a reader might bring to the site and that has to wrap onto several lines without breaking the row layout' },
};
export const ManyTools: Story = { args: { tools: Array.from({ length: 12 }, (_, i) => `scanner-${i + 1}`) } };
