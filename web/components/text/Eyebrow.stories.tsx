import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Eyebrow } from './Eyebrow';

const meta = {
  title: 'Text/Eyebrow',
  component: Eyebrow,
  args: { children: 'Provider-documented' },
} satisfies Meta<typeof Eyebrow>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Ink: Story = {};
export const Muted: Story = { args: { tone: 'muted' } };
export const LongLabel: Story = { args: { children: 'Redact-secret 0.1.0-beta.11 measured against the pinned corpus on a single machine' } };
