import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Banner } from './Banner';

const meta = {
  title: 'Feedback/Banner',
  component: Banner,
  args: { label: 'Site environment', children: <><b>Staging.</b> Not the published site; numbers here are not public evidence.</> },
} satisfies Meta<typeof Banner>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Warning: Story = {};
export const Info: Story = { args: { tone: 'info', children: <><b>Preview.</b> This page is built beside the current site.</> } };
export const WithLink: Story = {
  args: { children: <><b>Local build.</b> See <a href="/how-to-read">how to read these numbers</a>.</> },
};
export const LongText: Story = { args: { children: <><b>Staging.</b> {'A long environment message that wraps. '.repeat(12)}</> } };
