import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FixturePeers } from './FixturePeers';
import { fixtureLines, fixtureScanners } from './fixtureStoryData';
import { peers } from './fixturePageData';

const meta = {
  title: 'Report/FixturePeers',
  component: FixturePeers,
  args: { peers },
} satisfies Meta<typeof FixturePeers>;
export default meta;

type Story = StoryObj<typeof meta>;

/** The table is behind a disclosure; the stories open it so it is visible. */
const open = { args: { defaultOpen: true } };

export const Closed: Story = {};

export const Open: Story = { ...open };

/** Every scanner's ranges on the bytes, under the table. */
export const WithLanes: Story = { args: { defaultOpen: true, peers: { ...peers, lanes: { lines: fixtureLines, scanners: fixtureScanners, caption: 'Secret bytes 30–38. All values are synthetic test data.' } } } };

/** Two twins: each outcome names the twin it is for. */
export const TwoTwins: Story = {
  args: {
    defaultOpen: true,
    peers: {
      ...peers,
      relatedHeading: 'Its twins',
      rows: peers.rows.map(r => ({ ...r, related: [...(r.related ?? []), { label: 'example-provider-block-prefix-twin', outcome: [{ status: 'pass' as const, label: 'Quiet' }] }] })),
    },
  },
};

/** No twin, so no twin column. */
export const NoTwin: Story = { args: { defaultOpen: true, peers: { summary: peers.summary, rows: peers.rows.map(r => ({ ...r, related: undefined })) } } };

export const ManyScanners: Story = {
  args: {
    defaultOpen: true,
    peers: {
      summary: 'Same input, 9 other scanners',
      rows: Array.from({ length: 9 }, (_, i) => ({ id: `scanner-${i}`, name: `Scanner number ${i + 1} ${i + 1}.0.${i}`, detail: `Results from 2026-09-29 · ${i % 2 ? 'Directory scan · default rules' : 'Published npm package · secrets only'}`, fixture: [{ status: i % 3 === 0 ? 'fail' as const : 'pass' as const, label: i % 3 === 0 ? 'Left readable' : 'Exact' }], ranges: i % 3 === 0 ? 'none reported' : '[41, 70)' })),
    },
  },
};

export const Phone: Story = { ...open, globals: { viewport: { value: 'mobile1', isRotated: false } } };
