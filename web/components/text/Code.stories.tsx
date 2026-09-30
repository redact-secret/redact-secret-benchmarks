import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Code, CodeBlock } from './Code';

const meta = {
  title: 'Text/Code',
  component: Code,
  args: { children: 'benchmarks/pin-manifest.json' },
} satisfies Meta<typeof Code>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

export const InlineInSentence: Story = {
  render: () => <p>The ledger reads <Code>benchmarks/pin-manifest.json</Code> at build time.</p>,
};

export const InlineLongUnbroken: Story = { args: { children: 'github_pat_' + 'A'.repeat(90) } };

export const Command: Story = {
  render: () => <CodeBlock label="Install command">npm ci --ignore-scripts</CodeBlock>,
};

export const Snippet: Story = {
  render: () => (
    <CodeBlock variant="snippet" label="Synthetic fixture">{'API_KEY=sk_test_EXAMPLEEXAMPLEEXAMPLE0000\nDEBUG=false'}</CodeBlock>
  ),
};

export const SnippetLongLines: Story = {
  render: () => (
    <CodeBlock variant="snippet" label="Long line">{'x'.repeat(240)}</CodeBlock>
  ),
};

export const SnippetManyLines: Story = {
  render: () => (
    <CodeBlock variant="snippet" label="Many lines">{Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n')}</CodeBlock>
  ),
};
