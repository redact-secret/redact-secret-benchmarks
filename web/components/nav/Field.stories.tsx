import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FilterBar, SelectField, TextField } from './Field';

const meta = {
  title: 'Nav/Field',
  component: TextField,
  args: { label: 'Search providers', placeholder: 'Search providers, families, detectors' },
} satisfies Meta<typeof TextField>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Text: Story = {};
export const WithValue: Story = { args: { defaultValue: 'github' } };
export const Disabled: Story = { args: { disabled: true } };
export const LongLabel: Story = { args: { label: 'Search across every provider, family and detector name in the ledger' } };

export const Select: StoryObj<typeof SelectField> = {
  render: () => (
    <SelectField
      label="Evidence level"
      defaultValue="T1"
      options={[{ value: 'T1', label: 'Provider-documented' }, { value: 'T2', label: 'Tool-corroborated' }, { value: 'T3', label: 'Project policy' }]}
    />
  ),
};

export const Bar: StoryObj<typeof FilterBar> = {
  render: () => (
    <FilterBar label="Filter families">
      <TextField label="Search" placeholder="Search families" />
      <SelectField label="Status" defaultValue="all" options={[{ value: 'all', label: 'All' }, { value: 'stable', label: 'Stable' }]} />
      <SelectField label="Tier" defaultValue="all" options={[{ value: 'all', label: 'All' }, { value: 'T1', label: 'T1' }]} />
      <span>430 families</span>
    </FilterBar>
  ),
};
