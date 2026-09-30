import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Grid } from '../layout/Grid';
import { NavTile } from './NavTile';

const meta = {
  title: 'Nav/NavTile',
  component: NavTile,
  args: {
    href: '/report/providers',
    label: 'Providers',
    figure: '82',
    figureUnit: 'providers',
    description: <><b>81</b> with fixtures in this corpus. Each opens its families and rows.</>,
    action: 'By provider →',
  },
} satisfies Meta<typeof NavTile>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoDescription: Story = { args: { description: undefined } };
export const LongDescription: Story = { args: { description: 'A long description that wraps inside the tile. '.repeat(8) } };

export const HubRow: Story = {
  render: () => (
    <Grid columns={4} gap="md">
      <NavTile href="/report/providers" label="Providers" figure="82" figureUnit="providers" description={<><b>81</b> with fixtures.</>} action="By provider →" />
      <NavTile href="/report/families" label="Families" figure="158" figureUnit="families" description={<><b>139</b> with fixtures.</>} action="All families →" />
      <NavTile href="/coverage?show=detectors" label="Detectors" figure="92" figureUnit="detectors" description={<><b>92</b> exercised by <b>5,034</b> fixtures.</>} action="By detector →" />
      <NavTile href="#news" label="News" figure="9" figureUnit="changes" description="Latest on 2026-09-28." action="What changed →" />
    </Grid>
  ),
};
