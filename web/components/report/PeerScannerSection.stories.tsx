import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PeerScannerSection } from './PeerScannerSection';
import { peerNotes, peerRows, peerRowsMissing } from './storyData';

const meta = {
  title: 'Report/PeerScannerSection',
  component: PeerScannerSection,
  args: {
    title: 'Other scanners on the same inputs',
    description: 'We ran 3 other scanners on the same 1,068 provider-documented inputs. This shows what each one left readable. It does not show which scanner is better.',
    rows: peerRows,
    notes: peerNotes,
  },
} satisfies Meta<typeof PeerScannerSection>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A scanner added to the matrix with no results yet: dashed "Not measured", never zeros. */
export const MissingMeasurements: Story = { args: { rows: peerRowsMissing } };

export const NoScanners: Story = { args: { rows: [], description: 'No other scanner has been run on these inputs yet.' } };

/** What a run records today: no rule-to-family map, so the three "rules target" columns are left out and the all-inputs column shows. */
export const AllInputsOnly: Story = {
  args: {
    rows: peerRows.map(r => ({ ...r, blurb: undefined, targeted: null, leftReadable: null, elsewhere: null, allInputs: { count: '445', of: '1,305', unit: 'spans', note: 'redact-secret, same inputs: 153 of 1,305' } })),
  },
};

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
