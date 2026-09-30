import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TabPanel, Tabs } from './Tabs';

type Domain = 'credentials' | 'pii';
const ITEMS: Array<{ value: Domain; label: string; disabled?: boolean }> = [
  { value: 'credentials', label: 'Credentials' },
  { value: 'pii', label: 'PII' },
];

const meta = {
  title: 'Nav/Tabs',
  component: Tabs<Domain>,
  args: { items: ITEMS, value: 'pii', onChange: () => {}, label: 'Kind of data', idPrefix: 'story' },
} satisfies Meta<typeof Tabs<Domain>>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const FirstSelected: Story = { args: { value: 'credentials' } };
export const WithDisabledTab: Story = { args: { items: [ITEMS[0], { ...ITEMS[1], disabled: true }], value: 'credentials' } };

/** Controlled from outside; local state here only shows keyboard and pointer interaction with the linked panels. */
export const WithPanels: Story = {
  render: args => {
    const [value, setValue] = useState<Domain>('pii');
    return (
      <>
        <Tabs<Domain> {...args} value={value} onChange={setValue} idPrefix="panels" />
        <TabPanel value="credentials" selected={value} idPrefix="panels">Credentials: not measured yet.</TabPanel>
        <TabPanel value="pii" selected={value} idPrefix="panels">PII: three questions, one table each.</TabPanel>
      </>
    );
  },
};

export const ManyTabsScrollInside: StoryObj<typeof Tabs<string>> = {
  render: () => (
    <Tabs
      label="Many"
      idPrefix="many"
      value="t3"
      onChange={() => {}}
      items={Array.from({ length: 16 }, (_, i) => ({ value: `t${i}`, label: `Section number ${i + 1}` }))}
    />
  ),
};
