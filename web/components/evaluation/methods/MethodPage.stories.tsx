import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MethodPage } from './MethodPage';
import { edgeRows, groupedRows, holdoutInputs, missingEvaluation, operatorInputs, pageArgs, recorded } from './storyData';

const meta = {
  title: 'Evaluation/Methods/MethodPage',
  component: MethodPage,
  parameters: { layout: 'fullscreen' },
  args: pageArgs,
} satisfies Meta<typeof MethodPage>;
export default meta;

type Story = StoryObj<typeof meta>;

/** `/evaluation/method/twin/`: the five sections every method page has, in their fixed order. */
export const Default: Story = {};

/** A method with operators: the recorded table is grouped, and the operators table joins the inputs. */
export const WithOperators: Story = {
  args: {
    title: 'Metamorphic',
    currentHref: '/evaluation/method/metamorphic/',
    crumbs: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'Methods', href: '/evaluation/method/twin/' }, { label: 'Metamorphic' }],
    recorded: { ...recorded, rowHeader: 'Transform', title: 'Does detection survive a change of context?', groups: groupedRows, unscored: undefined },
    inputs: operatorInputs,
  },
};

/** Nothing was published: every section that needs a run says "Not measured" and names the command; the fixed copy still reads. */
export const NotMeasured: Story = {
  args: { meta: [{ value: 'Not measured' }], how: { ...pageArgs.how, figures: [] }, recorded: missingEvaluation, inputs: missingEvaluation },
};

/** A scanner that did not run, a check waiting for review and a check one scanner does not report. */
export const NotRecorded: Story = { args: { recorded: { ...recorded, groups: edgeRows, unscored: undefined } } };

/** Holdout: the aggregate facts replace the suites. */
export const Holdout: Story = {
  args: {
    title: 'Holdout',
    currentHref: '/evaluation/method/holdout/',
    meta: [{ label: 'Qualification run', value: '3a161679 · 2026-10-01' }, { label: 'Source', value: 'Frozen report in the repository' }],
    inputs: holdoutInputs,
  },
};

/** Long labels and a long run line wrap and never push the page sideways. */
export const WorstCase: Story = {
  args: {
    meta: [{ label: 'redact-secret', value: '1.2.3-beta.4+build.5 · Published npm package · default patterns (PII enabled) · pattern coverage only · JavaScript engine' }],
    lede: 'A very long sentence that says what the method is, with an identifier-like-token-that-does-not-break-anywhere-and-keeps-going-for-a-while inside it.',
  },
};

export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
