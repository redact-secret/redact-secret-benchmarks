import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QualificationFamily } from './QualificationFamily';
import { family } from './storyData';

const meta = {
  title: 'Evaluation/Qualification/QualificationFamily',
  component: QualificationFamily,
  parameters: { layout: 'fullscreen' },
  args: family,
} satisfies Meta<typeof QualificationFamily>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A provisional family held by the unmeasured methods; one population has no case for it and says so. */
export const Default: Story = {};

export const Stable: Story = {
  args: { status: { ...family.status, value: { word: 'Stable', tone: 'info' }, reasons: [], methodsNotRun: [] } },
};

/** A family no scanner recorded a case for. */
export const NoCases: Story = {
  args: { observations: { ...family.observations, rows: [] }, gates: { ...family.gates, rows: [] } },
};

export const LongReason: Story = {
  args: { status: { ...family.status, reasons: ['empirical.minimumPositiveAxes: 1 < 6 — Empirical positives must span at least six source-context axes, and a value that goes on without any break-point such as aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.'] } },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
