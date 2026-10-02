import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Specimen } from './Specimen';
import type { SpecimenExample } from './types';

const EXAMPLES: SpecimenExample[] = [
  {
    id: 'credential', label: 'Credential', name: 'example/config.tf', expected: 'bytes 12–30', result: 'Exact',
    lines: ['settings {', { before: '  key = "', secret: 'EXAMPLE-NOT-A-REAL-KEY', after: '"' }, '}'],
    caption: 'A synthetic key in a block. The dashed box is the answer written in advance; the solid bar is a redaction of those bytes.',
  },
  {
    id: 'personal', label: 'Personal data', name: 'example/note.txt', expected: 'bytes 20–42', result: 'Exact',
    lines: ['Subject: example', '', { before: 'Send it to ', secret: 'person@sample.test', after: ' please.' }, 'Thanks!'],
    caption: 'A synthetic note with an email address. The same reading.',
  },
];

const meta = {
  title: 'Landing/Specimen',
  component: Specimen,
  args: { eyebrow: 'How one input is read', choiceLabel: 'Example', examples: EXAMPLES, active: 'credential', runKey: 0, replayLabel: 'Replay', onChange: () => {}, onReplay: () => {} },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Specimen>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Credential: Story = {};
export const PersonalData: Story = { args: { active: 'personal' } };

/** The parent owns the choice and the replay counter; the component only draws them. */
export const Interactive: Story = {
  render: args => {
    const [active, setActive] = useState('credential');
    const [run, setRun] = useState(0);
    return <Specimen {...args} active={active} runKey={run} onChange={id => { setActive(id); setRun(r => r + 1); }} onReplay={() => setRun(r => r + 1)} />;
  },
};

export const LongUnbrokenSecret: Story = {
  args: {
    examples: [{ ...EXAMPLES[0], lines: ['x = "', { before: 'token = "', secret: 'EXAMPLE'.repeat(40), after: '"' }, '}'], expected: 'bytes 0–280' }],
  },
};
export const Phone: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
export const DarkTheme: Story = { globals: { theme: 'dark' } };
