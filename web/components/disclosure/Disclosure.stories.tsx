import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Disclosure } from './Disclosure';

const rowSummary = (
  <>
    <span><b>Amazon Web Services</b><small>5 families</small></span>
    <span>3 with fixtures · 2 without</span>
  </>
);

const meta = {
  title: 'Disclosure/Disclosure',
  component: Disclosure,
  args: { summary: rowSummary, children: <p>The provider&apos;s families and rows appear here.</p> },
} satisfies Meta<typeof Disclosure>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { defaultOpen: true } };
export const Plain: Story = { args: { variant: 'plain', summary: 'Peer observations', defaultOpen: true } };

export const Nested: Story = {
  render: () => (
    <Disclosure summary={rowSummary} defaultOpen>
      <Disclosure variant="nested" summary={<><span><b>IAM user access key</b><small>aws:iam-user-access-key</small></span><span>26 rows</span></>}>
        <p>Rows for this family.</p>
      </Disclosure>
      <Disclosure variant="nested" summary={<><span><b>STS temporary access key</b></span><span>No fixtures</span></>}>
        <p>Not measured yet.</p>
      </Disclosure>
    </Disclosure>
  ),
};

export const LongSummary: Story = {
  args: { summary: <><span><b>{'A provider with a very long display name '.repeat(4)}</b></span><span>{'x'.repeat(100)}</span></> },
};
