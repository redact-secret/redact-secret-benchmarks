import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FamilySources } from './FamilySources';
import { manySources, sources, sourcesEmpty } from './storyData';

const meta = {
  title: 'Family/FamilySources',
  component: FamilySources,
  args: sources,
} satisfies Meta<typeof FamilySources>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Neither the taxonomy nor the dossier cites a source: a dashed "Not recorded". */
export const NoSources: Story = { args: sourcesEmpty };

/** Many sources and very long addresses wrap inside the column. */
export const ManySources: Story = { args: manySources };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
