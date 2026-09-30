import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Note } from './Note';

const meta = {
  title: 'Feedback/Note',
  component: Note,
  args: { children: 'This shows what each scanner left readable. It does not show which scanner is better.' },
} satisfies Meta<typeof Note>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};
export const Info: Story = { args: { tone: 'info', title: 'Placeholder' } };
export const Warning: Story = { args: { tone: 'warning', title: 'Local build', children: 'Not a published site; these numbers are not public evidence.' } };
export const Danger: Story = { args: { tone: 'danger', title: 'Ledger drift' } };
export const Success: Story = { args: { tone: 'success', title: 'Verified' } };

export const NumberedList: Story = {
  args: {
    title: 'Read this before the numbers',
    children: (
      <ol>
        <li><b>Our inputs, our answer key.</b> The team wrote every input and every expected span.</li>
        <li><b>Tuned on these inputs.</b> The other scanners were never tuned against this corpus.</li>
        <li><b>Different jobs.</b> A readable span shows where a rule set ends, not that it failed.</li>
      </ol>
    ),
  },
};

export const LongContent: Story = { args: { children: 'A long explanatory note that must wrap inside the measure. '.repeat(15) } };
