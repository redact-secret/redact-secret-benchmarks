import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Legend, OutcomeMark } from './OutcomeMark';

const meta = {
  title: 'Data/OutcomeMark',
  component: OutcomeMark,
  args: { outcome: 'replaced', label: 'Hidden' },
} satisfies Meta<typeof OutcomeMark>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Replaced: Story = {};
export const ReplacedWithDetail: Story = { args: { detail: 'labelled IBAN' } };
export const Partial: Story = { args: { outcome: 'partial', label: 'Partly', detail: '3 of 8 lines' } };
export const Unchanged: Story = { args: { outcome: 'unchanged', label: 'Left as is' } };
export const NotApplicable: Story = { args: { outcome: 'not-applicable', label: 'Switch off' } };
export const LongDetail: Story = { args: { detail: 'labelled TWITTER_ID with a long trailing description that has to wrap' } };

export const WithLegend: Story = {
  render: () => (
    <Legend
      label="Outcome key"
      items={[
        <OutcomeMark key="r" outcome="replaced" label="Hidden" />,
        <OutcomeMark key="p" outcome="partial" label="Partly" />,
        <OutcomeMark key="u" outcome="unchanged" label="Left as is" />,
        <OutcomeMark key="n" outcome="not-applicable" label="Switch off" />,
      ]}
    />
  ),
};
