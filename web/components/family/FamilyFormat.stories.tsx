import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FamilyFormat } from './FamilyFormat';
const meta = { title: 'Family/FamilyFormat', component: FamilyFormat, args: {
  name: 'Synthetic token', provenance: 'credential-evidence snapshot-2099.01.01',
  shape: [{ label: 'Prefix', value: 'acme_' }, { label: 'Body', value: 'Synthetic body' }],
  claims: [{ id: 'prefix', text: 'The documented prefix is acme_.', evidenceClass: 'provider-documented', evidenceLabel: 'Provider documented', date: '2099-01-01', temporality: 'current', sources: [{ id: 'docs', label: 'Synthetic provider documentation', href: 'https://example.invalid/tokens', detail: 'provider-documentation · last read 2099-01-01' }] }], questions: [],
} } satisfies Meta<typeof FamilyFormat>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Settled: Story = {};
export const PartlyOpen: Story = { args: { claims: [...meta.args.claims, { ...meta.args.claims[0], id: 'body', text: 'The body alphabet remains unresolved.', evidenceClass: 'unresolved', evidenceLabel: 'Unresolved' }], questions: [{ ref: 'acme:token@1#alphabet', at: '2099-01-02', text: 'Which alphabet does the body use?' }] } };
export const NotRecorded: Story = { args: { absent: 'No format contract is recorded in the pinned release.', shape: [], claims: [], questions: [] } };
export const EmptyStructure: Story = { args: { shape: [] } };
export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
export const LongContent: Story = { args: { shape: [{ label: 'Descriptive pattern', value: 'a-long-pattern-'.repeat(30) }] } };
