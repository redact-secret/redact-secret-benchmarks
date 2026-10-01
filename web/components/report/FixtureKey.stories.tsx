import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixtureKey } from './FixtureKey';

const meta = {
  title: 'Report/FixtureKey',
  component: FixtureKey,
  args: { items: [{ mark: 'expected', label: 'Expected secret' }, { mark: 'envelope', label: 'Envelope: may be redacted at no cost' }, { mark: 'redacted', label: 'Reported by redact-secret' }] },
} satisfies Meta<typeof FixtureKey>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Every mark a file view can draw. */
export const EveryMark: Story = {
  args: {
    items: [
      { mark: 'expected', label: 'Expected secret' },
      { mark: 'envelope', label: 'Envelope: may be redacted at no cost' },
      { mark: 'companion', label: 'Companion text' },
      { mark: 'redacted', label: 'Reported by redact-secret' },
      { mark: 'partial', label: 'Reported, a secret partly exposed' },
      { mark: 'exposed', label: 'Secret bytes left readable' },
      { mark: 'changed', label: 'The changed bytes' },
    ],
  },
};

export const Empty: Story = { args: { items: [] } };

export const Phone: Story = { ...EveryMark, globals: { viewport: { value: 'mobile1', isRotated: false } } };
