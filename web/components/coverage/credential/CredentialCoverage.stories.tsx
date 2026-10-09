import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CredentialCoverage } from './CredentialCoverage';
import type { CredentialCoverageData } from './types';

export const exampleCoverage: CredentialCoverageData = {
  release: '0.0.0-example · Published', configuration: 'Default Node API · synthetic configuration', binding: 'Current synthetic scope binding.',
  sourceRevision: 'Synthetic scope source and release.', scopeSource: 'https://github.com/redact-secret/redact-secret',
  counts: [{ label: 'Taxonomy families, not support', value: '2' }, { label: 'Declared capability', value: 'Not recorded' }],
  support: 'Synthetic record: one pending family. Classification does not supply a product declaration.',
  scope: [{ title: 'Activation and settings', statements: ['Example optional profile is off.'] }],
  providers: [{ id: 'example', name: 'Example provider', href: '/report/providers/', rows: [{ id: 'example:token', name: 'Example token', href: '/report/families/',
    description: 'Synthetic family description.', declaration: 'Unknown: no source-bound declaration.', qualification: 'Pending, synthetic record only.',
    format: 'Example prefix and documented structure.', context: 'Context not recorded.', research: 'Evidence research pending; not product qualification.', sources: [] }] }],
};
const meta = { title: 'Coverage/CredentialCoverage', component: CredentialCoverage, args: exampleCoverage, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof CredentialCoverage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { providers: [], scope: [], release: 'Not recorded', configuration: 'Not recorded' } };
export const Long: Story = { args: { sourceRevision: 'LongSource'.repeat(25), providers: exampleCoverage.providers.map(provider => ({ ...provider, name: 'Long provider name '.repeat(8), rows: provider.rows.map(row => ({ ...row, name: 'Long family name '.repeat(8), context: 'Context requirement '.repeat(30) })) })) } };
export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
