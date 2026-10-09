import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PiiMethodology } from './PiiMethodology';
import { method } from '../domain/storyData';

const meta = { title: 'Evaluation/PiiMethodology', component: PiiMethodology, args: {
  method, qualification: 'Synthetic public measurement. Current product qualification is not established. Protected execution is unavailable.',
  repositories: [{ label: 'Synthetic evidence repository', href: 'https://example.invalid/evidence', responsibility: 'Authors expected answers before the scanner runs.' }],
  metricGroups: [{ label: 'Separate quantities', text: 'Every numerator retains its own denominator. Unresolved and withheld values never become a zero.' }],
  definitionsHref: 'https://example.invalid/metric-definitions',
  policyHref: 'https://example.invalid/qualification-policy',
} } satisfies Meta<typeof PiiMethodology>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { repositories: [], metricGroups: [], method: { ...method, methods: [], vocabularies: [], metrics: { ...method.metrics, rows: [] } } } };
export const Long: Story = { args: { qualification: 'Synthetic long limitation with separate populations and no bound qualification. '.repeat(12) } };
export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
