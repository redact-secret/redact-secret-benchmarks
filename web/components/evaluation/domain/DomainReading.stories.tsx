import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DomainReading } from './DomainReading';
import { reading } from './storyData';

const meta = {
  title: 'Evaluation/DomainReading',
  component: DomainReading,
  args: reading,
} satisfies Meta<typeof DomainReading>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A long source path wraps. */
export const LongPath: Story = {
  args: { sources: [{ label: 'A record', path: 'evidence/901/428/core-8b6a5fde52ec/protected/global-network-address-aggregate-v1-with-a-very-long-name.json', href: 'https://example.com/r' }] },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
