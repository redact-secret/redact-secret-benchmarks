import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MethodCases } from './MethodCases';
import { casesArgs, indexArgs, missingEvaluation } from './storyData';

const meta = {
  title: 'Evaluation/Methods/MethodCases',
  component: MethodCases,
  parameters: { layout: 'fullscreen' },
  args: casesArgs,
} satisfies Meta<typeof MethodCases>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The first page of the checks behind one count: the filters, the run, one row per check and a next link. */
export const Default: Story = {};

/** The last page: no next link, and the position line says so. */
export const LastPage: Story = {
  args: {
    body: casesArgs.body.state === 'recorded'
      ? { ...casesArgs.body, pager: { page: 3, pageCount: 3, total: 212, pageSize: 100, previousHref: '/evaluation/method/twin/checks/?row=pair&scanner=scanner-b&status=fail&page=2' } }
      : casesArgs.body,
  },
};

/** The index of a method's lists, each with its figure and its address: the page without an address, and without script. */
export const Index: Story = { args: indexArgs };

/** The list's file is on its way: the head is known, a skeleton stands in for the rows. */
export const Loading: Story = { args: { body: { state: 'loading', label: 'Loading the 212 checks of this list' } } };

/** The file did not arrive: why, and a way to ask again. */
export const Failed: Story = {
  args: { body: { state: 'error', title: 'Could not load this list', detail: 'The file did not arrive. The method page and its counts are unaffected.', retryLabel: 'Try again', onRetry: () => {} } },
};

/** The address names no list of this method. */
export const Missing: Story = { args: { body: { state: 'missing', title: 'No such list', text: 'Open a count on the method page, or a list from the index of this method’s checks.' } } };

/** No evaluation was published: the page names the commands, never a zero or an empty list. */
export const NotMeasured: Story = { args: { body: missingEvaluation, lede: 'No evaluation was published for this checkout.' } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
