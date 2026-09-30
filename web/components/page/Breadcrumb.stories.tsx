import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Breadcrumb } from './Breadcrumb';

const meta = {
  title: 'Page/Breadcrumb',
  component: Breadcrumb,
  args: { items: [{ label: 'Report', href: '/report' }, { label: 'Providers', href: '/report/providers' }, { label: 'GitHub' }] },
} satisfies Meta<typeof Breadcrumb>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SingleItem: Story = { args: { items: [{ label: 'Comparison' }] } };
export const LongLabels: Story = {
  args: {
    items: [
      { label: 'Comparison', href: '/comparison' },
      { label: 'HashiCorp Terraform Cloud and Enterprise organization token family', href: '/x' },
      { label: 'A family identifier that is very long: hashicorp-terraform:organization-token' },
    ],
  },
};
