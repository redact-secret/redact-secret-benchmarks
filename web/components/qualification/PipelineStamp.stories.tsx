import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PipelineStamp } from './PipelineStamp';
import { pipelineStampLegacy, pipelineStampNew, pipelineStampOracle, reviewDisclosure } from './storyData';

const meta = {
  title: 'Evaluation/Qualification/PipelineStamp',
  component: PipelineStamp,
  args: pipelineStampNew,
} satisfies Meta<typeof PipelineStamp>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The new pipeline is the authority: the pages are built from the qualification view. */
export const NewAuthority: Story = {};

/** The legacy pipeline is the authority: the pages are built from the legacy run files. */
export const LegacyAuthority: Story = { args: pipelineStampLegacy };

/** A page that stays on the legacy files while the new pipeline is the authority (the comparison pages). */
export const LegacyOracle: Story = { args: pipelineStampOracle };

/** Some fixtures behind the numbers carry the maintainer-reviewed label: the count is data, the words are fixed. */
export const WithReviewDisclosure: Story = { args: { disclosure: reviewDisclosure } };

export const LongFacts: Story = {
  args: { facts: [{ term: 'Policy revision', value: `rs-policy-0:sha256:${'a'.repeat(64)}`, code: true }, { term: 'Population', value: 'a-population-with-a-very-long-identifier-that-keeps-going-and-going', code: true }] },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
