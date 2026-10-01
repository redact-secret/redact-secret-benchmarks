import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QualificationUnavailable } from './QualificationUnavailable';
import { unavailable } from './storyData';

const meta = {
  title: 'Evaluation/Qualification/QualificationUnavailable',
  component: QualificationUnavailable,
  parameters: { layout: 'fullscreen' },
  args: unavailable,
} satisfies Meta<typeof QualificationUnavailable>;
export default meta;

type Story = StoryObj<typeof meta>;

/** No view was built: the normal state of a CI build. */
export const NotBuilt: Story = {};

export const Incompatible: Story = {
  args: { state: 'incompatible', heading: 'Not shown: the qualification view cannot be read', reason: 'public/results/qualification-v1.json cannot be read: schema is "redact-secret/qualification-view/v2", this build reads redact-secret/qualification-view/v1.' },
};

export const Stale: Story = {
  args: { state: 'stale', heading: 'Not shown: the qualification view was not built from this checkout', reason: 'public/results/qualification-v1.json was not built from this checkout’s pins: benchmarks/support/status-criteria.json changed since the view was built.' },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
