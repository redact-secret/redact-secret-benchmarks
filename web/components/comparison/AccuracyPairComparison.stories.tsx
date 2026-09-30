import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AccuracyDifferences } from './AccuracyDifferences';
import { AccuracyPairComparison } from './AccuracyPairComparison';
import {
  credentialsPage, differences, fewFilesPage, gatedPage, hiddenQuestion, noRunPage, noSharedPage, peerNotCompletePage, piiNotMeasuredPage, piiPage, worstCasePage,
} from './accuracyFixtures';

const meta = {
  title: 'Comparison/AccuracyPairComparison',
  component: AccuracyPairComparison,
  args: credentialsPage,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AccuracyPairComparison>;
export default meta;

type Story = StoryObj<typeof meta>;

const phone = { viewport: { defaultViewport: 'mobile1' } };

/** Credentials, provider-documented level: one row per tool against the expected answer. */
export const Credentials: Story = {};
/** The differences slot is filled by the page; here a short static list. */
export const WithDifferences: Story = { args: { differences: { [hiddenQuestion.id]: <AccuracyDifferences {...differences} /> } } };
/** Fewer than 20 files in a question: counts replace the percentage. */
export const FewFiles: Story = { args: fewFilesPage };
/** A pair with no shared data, for example the scope switch on a level none of the tool's rules target. */
export const NoSharedData: Story = { args: noSharedPage };
/** Project policy is hidden for another tool until the reader asks. */
export const PolicyHidden: Story = { args: gatedPage };
/** The other tool did not complete in the run: its rows are not measured, not zero. */
export const PeerNotMeasured: Story = { args: peerNotCompletePage };
/** No run was written for this checkout. */
export const NoRun: Story = { args: noRunPage };
/** Personal data: a preview of the runtime comparison's texts, counts only, with a flat difference list. */
export const PersonalDataPreview: Story = { args: piiPage };
export const PersonalDataNotMeasured: Story = { args: piiNotMeasuredPage };
/** Worst case: long tool names, a share one file short of all, files left out. */
export const WorstCase: Story = { args: worstCasePage };
export const PhoneCredentials: Story = { parameters: phone };
export const PhonePersonalData: Story = { args: piiPage, parameters: phone };
export const PhoneWorstCase: Story = { args: worstCasePage, parameters: phone };
