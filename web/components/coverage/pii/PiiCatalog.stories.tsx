import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PiiCatalog, type PiiCatalogData } from './PiiCatalog';

const data: PiiCatalogData = {
  facts: [{ term: 'Published catalog product', description: 'Synthetic release, bound to product commitment aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }],
  activation: [{ title: 'Synthetic activation', text: 'Explicit synthetic selectors. Installed configuration only, not support qualification.' }],
  qualification: 'Public synthetic only. Current product qualification is not established; protected execution remains unavailable.',
  summary: 'Two synthetic source kinds. Inventory counts are not detection accuracy.', limitations: ['Per-kind language and context requirements are not recorded.'],
  rows: [
    { id: 'synthetic/declared', label: 'Synthetic declared type', state: 'supported-unmeasured', domains: 'PII', jurisdictions: 'Global', language: 'Not recorded; language is not jurisdiction.', capability: 'declared for the exact product', measurement: 'withheld; no compatible per-kind axes', limitations: 'Context fidelity unavailable', href: '/evaluation/pii/evidence/#synthetic-declared' },
    { id: 'synthetic/absent', label: 'Synthetic absent type', state: 'product-not-supported', domains: 'PHI', jurisdictions: 'XX', language: 'Not recorded', capability: 'explicitly-absent', measurement: 'unavailable', limitations: 'No support inferred from taxonomy membership', href: '/evaluation/pii/evidence/#synthetic-absent', declarationHref: 'https://example.invalid/synthetic-declaration' },
  ], emptyReason: 'No validated catalog is recorded.',
};

const meta = { title: 'Coverage/PiiCatalog', component: PiiCatalog, args: data } satisfies Meta<typeof PiiCatalog>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { rows: [], facts: [], activation: [], summary: 'Inventory unavailable, not zero.' } };
export const Long: Story = { args: { rows: data.rows.map(row => ({ ...row, label: `${row.label} with a long jurisdiction-specific documentation description`, limitations: 'SyntheticLongContextRequirement'.repeat(15) })) } };
export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
