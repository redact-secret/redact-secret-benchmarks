import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CredentialMethodology } from './CredentialMethodology';
import { view } from '../domain/storyData';

const data = { head: { ...view.head, domain: 'credential' as const, title: 'How credentials are evaluated',
  currentHref: '/evaluation/credential/', breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Credential' }] }, method: view.method, reading: view.reading, limits: [] };
const meta = { title: 'Evaluation/CredentialMethodology', component: CredentialMethodology, args: data, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof CredentialMethodology>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { limits: [], method: { ...data.method, metrics: { ...data.method.metrics, rows: [] } } } };
export const Long: Story = { args: { limits: [{ label: 'Long recorded limitation', text: 'A recorded limitation with an exact synthetic source. '.repeat(30) }] } };
export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
