import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RuntimeComparison } from './RuntimeComparison';
import {
  credentialQuestions,
  externalColumns,
  externalFactColumns,
  externalFacts,
  factNotes,
  internalColumns,
  internalFactColumns,
  internalFacts,
  legend,
  piiQuestions,
  runMeta,
  runtimeSwitches,
  runtimeViews,
} from './fixtures';

const views = runtimeViews('/comparison/runtime');

const meta = {
  title: 'Comparison/RuntimeComparison',
  component: RuntimeComparison,
  parameters: { layout: 'fullscreen' },
  args: {
    breadcrumb: [{ label: 'Comparison', href: '/comparison' }, { label: 'Runtime' }],
    eyebrow: 'Comparison · Three libraries',
    title: 'How fast is each one, and what did it hide?',
    lede: 'redact-secret and two other libraries, the same text, three questions. A fast time can mean it hid less, so look at both. Not a ranking.',
    switches: runtimeSwitches('external', 'pii'),
    toolbar: { views, currentHref: views[0].href, view: 'all', legend },
    columns: externalColumns,
    columnKind: 'library',
    questions: piiQuestions,
    factsTitle: 'About the libraries',
    factColumns: externalFactColumns,
    facts: externalFacts,
    run: runMeta,
    notes: factNotes,
  },
} satisfies Meta<typeof RuntimeComparison>;
export default meta;

type Story = StoryObj<typeof meta>;

/** `/comparison/runtime?analysis=external&domain=pii`. */
export const ExternalPii: Story = {};
export const InternalPii: Story = {
  args: {
    eyebrow: 'Comparison · redact-secret settings',
    title: 'What does each redact-secret setting hide, and how fast?',
    lede: 'The same text through each redact-secret setting. Turning more on hides more and takes longer.',
    switches: runtimeSwitches('internal', 'pii'),
    columns: internalColumns,
    columnKind: 'redact-secret setting',
    factsTitle: 'About the settings',
    factColumns: internalFactColumns,
    facts: internalFacts,
  },
};
export const SpeedView: Story = { args: { toolbar: { views, currentHref: views[1].href, view: 'speed', legend } } };
export const AccuracyView: Story = { args: { toolbar: { views, currentHref: views[2].href, view: 'accuracy', legend } } };
/** Credentials: no toolbar (nothing to switch), each question a dashed "Not measured yet". */
export const CredentialsNotMeasured: Story = {
  args: { switches: runtimeSwitches('external', 'credentials'), toolbar: undefined, questions: credentialQuestions },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
