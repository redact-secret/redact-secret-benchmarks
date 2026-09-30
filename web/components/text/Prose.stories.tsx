import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Prose } from './Prose';

const meta = {
  title: 'Text/Prose',
  component: Prose,
  args: {
    children: (
      <>
        <p>Synthetic inputs, the same for every scanner, scored span by span.</p>
        <ul>
          <li><b>Our inputs, our answer key.</b> The team wrote every input and every expected span.</li>
          <li><b>Different jobs.</b> Most inputs fall outside at least one scanner&apos;s rules.</li>
        </ul>
      </>
    ),
  },
} satisfies Meta<typeof Prose>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Body: Story = {};
export const Small: Story = { args: { size: 'small' } };
export const Long: Story = {
  args: { children: <p>{'A long paragraph that must stop at the measure and wrap. '.repeat(20)}</p> },
};
