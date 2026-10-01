import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FamilyNotes } from './FamilyNotes';
import { lookAlikes, longNotes, notes, openQuestions } from './storyData';

const meta = {
  title: 'Family/FamilyNotes',
  component: FamilyNotes,
  args: {
    title: 'Format facts',
    description: 'From the provider dossier, as written. The evidence level above says how well the format is backed; a fact the dossier does not record is not shown.',
    items: notes,
    emptyTitle: 'No format notes recorded',
    emptyText: 'The provider dossier has no shape, basis or issuance note for this family, so nothing is stated about its format here.',
  },
} satisfies Meta<typeof FamilyNotes>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A family the dossier has not researched: a dashed "Not recorded", never a blank and never a placeholder fact. */
export const NothingRecorded: Story = { args: { items: [] } };

export const OpenQuestions: Story = { args: { title: 'Open questions', description: 'Things the sources do not settle. They are listed so nobody reads them as settled.', items: openQuestions } };

export const LooksLikeItButIsNot: Story = { args: { title: 'Looks like it, but isn\'t', description: 'Values the dossier records as resembling this credential without being one.', items: lookAlikes } };

/** An unbroken code span and a long sentence wrap inside the column. */
export const LongContent: Story = { args: { items: longNotes } };

export const Phone: Story = { globals: { viewport: { value: 'mobile1', isRotated: false } } };
