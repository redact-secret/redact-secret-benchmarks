import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QualificationOverview } from './QualificationOverview';
import { overview } from './storyData';

const meta = {
  title: 'Evaluation/Qualification/QualificationOverview',
  component: QualificationOverview,
  parameters: { layout: 'fullscreen' },
  args: overview,
} satisfies Meta<typeof QualificationOverview>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Every status, the three populations side by side, the scanners and one family with a recorded hold. */
export const Default: Story = {};

/** The configuration ran its methods: no methods note, and the population row names them. */
export const MethodsRun: Story = {
  args: {
    summary: { ...overview.summary, methodsNote: null },
    populations: { ...overview.populations, rows: overview.populations.rows.map(r => ({ ...r, methods: 'metamorphic, mutation, differential' })) },
  },
};

/** No family, no scanner and no known-gap record: each table says so instead of showing zeros. */
export const Empty: Story = {
  args: {
    populations: { ...overview.populations, rows: [] },
    scanners: { ...overview.scanners, rows: [] },
    families: { ...overview.families, rows: [], undetected: { ...overview.families.undetected, items: [] } },
    gaps: { ...overview.gaps, rows: [] },
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
