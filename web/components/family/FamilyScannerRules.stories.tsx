import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FamilyScannerRules } from './FamilyScannerRules';
import { rules, rulesNone } from './storyData';

const meta = {
  title: 'Family/FamilyScannerRules',
  component: FamilyScannerRules,
  args: rules,
} satisfies Meta<typeof FamilyScannerRules>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No reviewed peer rule maps to the family: a dashed "None mapped", not a claim about any scanner. */
export const NoRuleMaps: Story = { args: rulesNone };

export const ManyRules: Story = {
  args: {
    rules: [...rules.rules, ...Array.from({ length: 6 }, (_, i) => ({ scanner: 'trufflehog · rules 3.97.4', rule: `acme/detector-with-a-long-identifier-${i}`, basis: 'acme_ followed by an alphanumeric body of a length the rule states, with the keyword gate it requires nearby' }))],
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
