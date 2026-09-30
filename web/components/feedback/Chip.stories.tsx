import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Chip, ChipList } from './Chip';

const meta = {
  title: 'Feedback/Chip',
  component: Chip,
  args: { children: 'github-token' },
} satisfies Meta<typeof Chip>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};
export const On: Story = { args: { tone: 'on', children: 'has validator' } };
export const Void: Story = { args: { tone: 'void', children: 'not in product' } };
export const Dashed: Story = { args: { dashed: true, children: 'no commitment' } };
export const Sans: Story = { args: { mono: false, children: 'tested' } };
export const AsLink: Story = { args: { tone: 'on', href: '/report/families', children: 'aws:iam-user-access-key' } };
export const LongLabel: Story = { args: { children: 'hashicorp-terraform:organization-token-with-a-very-long-identifier' } };

export const List: Story = {
  render: () => <ChipList label="Tools compared" items={['redact-secret', 'gitleaks', 'TruffleHog', 'flare-redact'].map(t => <Chip key={t}>{t}</Chip>)} />,
};

export const ListManyItems: Story = {
  render: () => <ChipList label="Detectors" items={Array.from({ length: 40 }, (_, i) => <Chip key={i}>detector-{i + 1}</Chip>)} />,
};
