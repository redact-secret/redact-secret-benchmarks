/**
 * The landing page (`/`): the pure resolver, the specimen block and the footer's run line. Counts and versions are passed in
 * as synthetic values; nothing here reads the ledger or asserts a value the committed data holds.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test } from 'vitest';
import './next-mocks';
import { Specimen } from '../../components/landing';
import { SiteFooter } from '../../components/shell';
import { buildLine, expectedRange, resolveLanding, scopeText, syntheticToken } from '../../resolvers/landing';

describe('landing resolver', () => {
  test('puts a count in the accuracy question only when it was supplied', () => {
    const accuracy = (families: number | null, piiKinds: number | null) => resolveLanding({ families, piiKinds }).questions[0].text;
    expect(accuracy(12, 3)).toContain('12 credential families and 3 kinds of personal data');
    expect(accuracy(1, 1)).toContain('1 credential family and 1 kind of personal data');
    expect(accuracy(12, null)).toMatch(/for 12 credential families\.$/);
    expect(accuracy(null, 3)).toMatch(/for 3 kinds of personal data\.$/);
    expect(accuracy(null, null)).not.toMatch(/ for |credential|personal data\./);
    expect(scopeText({ families: null, piiKinds: null })).toBe('');
  });

  test('the three questions lead to pages of the export', () => {
    const { questions } = resolveLanding({ families: null, piiKinds: null });
    expect(questions.map(q => q.href)).toEqual(['/report/', '/comparison/performance/', '/evaluation/']);
  });

  test('both examples are synthetic: a visible EXAMPLE token, the expected range is where the secret is, and no example claims a recorded row', () => {
    const { specimen } = resolveLanding({ families: null, piiKinds: null });
    expect(specimen.examples.map(e => e.id)).toEqual(['credential', 'personal']);
    for (const example of specimen.examples) {
      const text = example.lines.map(l => (typeof l === 'string' ? l : `${l.before}${l.secret}${l.after}`)).join('\n');
      const line = example.lines.find(l => typeof l !== 'string');
      if (typeof line === 'string' || !line) throw new Error('every example has an expected secret');
      const [start, end] = example.expected.replace('bytes ', '').split('–').map(Number);
      expect(new TextDecoder().decode(new TextEncoder().encode(text).slice(start, end))).toBe(line.secret);
      expect(example.caption).toMatch(/not a recorded row/);
    }
    expect(syntheticToken()).toContain('EXAMPLE');
  });

  test('a range counts bytes, not characters, and says when there is no secret', () => {
    expect(expectedRange(['ab', { before: 'é', secret: 'xyz', after: '' }])).toBe('bytes 5–8');
    expect(expectedRange(['no secret here'])).toBe('not present');
  });

  test('the build line names what is known and nothing else', () => {
    expect(buildLine({ version: '1.2.3', candidateCommit: null, inputs: 1234, generatedAt: '2026-01-02T03:04:05Z' })).toBe('redact-secret 1.2.3 · 1,234 inputs · run 2026-01-02');
    expect(buildLine({ version: null, candidateCommit: 'abcdef0123', inputs: null, generatedAt: '2026-01-02' })).toBe('redact-secret candidate abcdef0 (unreleased) · run 2026-01-02');
    expect(buildLine({ version: null, candidateCommit: null, inputs: null, generatedAt: null })).toBeNull();
    expect(buildLine(null)).toBeNull();
  });
});

function Harness() {
  const { specimen } = resolveLanding({ families: null, piiKinds: null });
  const [active, setActive] = useState(specimen.examples[0].id);
  const [run, setRun] = useState(0);
  return <Specimen {...specimen} active={active} runKey={run} onChange={id => { setActive(id); setRun(r => r + 1); }} onReplay={() => setRun(r => r + 1)} />;
}

describe('Specimen', () => {
  test('the choice is a keyboard-operable group that swaps the example, and the code region announces the change politely', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Example' });
    const credential = within(group).getByRole('button', { name: 'Credential' });
    const personal = within(group).getByRole('button', { name: 'Personal data' });
    expect(credential).toHaveAttribute('aria-pressed', 'true');
    const code = document.querySelector('pre[aria-live="polite"]');
    expect(code).not.toBeNull();
    expect(code).toHaveTextContent('provider');
    personal.focus();
    await user.keyboard('{Enter}');
    expect(personal).toHaveAttribute('aria-pressed', 'true');
    expect(code).toHaveTextContent('Subject');
  });

  test('the dashed span is marked as the expected secret, the verdict has three words and Replay is a button', () => {
    render(<Harness />);
    expect(document.querySelector('[title="Expected secret"]')).not.toBeNull();
    expect(screen.getAllByText(/^(Expected|Redacted|Result)$/)).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Replay' })).toBeInTheDocument();
  });

  test('replaying remounts the animated parts, so the motion restarts without a timer', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const before = document.querySelector('[title="Expected secret"]');
    await user.click(screen.getByRole('button', { name: 'Replay' }));
    expect(document.querySelector('[title="Expected secret"]')).not.toBe(before);
  });

  test('nothing is drawn for an empty list of examples', () => {
    const { container } = render(<Specimen eyebrow="x" choiceLabel="x" replayLabel="x" examples={[]} active="" onChange={() => {}} runKey={0} onReplay={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SiteFooter', () => {
  test('shows the build line only when there is one', () => {
    const props = { links: [{ label: 'Site', href: 'https://example.com' }], legal: 'legal' };
    const { rerender } = render(<SiteFooter {...props} build="redact-secret 1.0.0" />);
    expect(screen.getByText('redact-secret 1.0.0')).toBeInTheDocument();
    rerender(<SiteFooter {...props} build={null} />);
    expect(screen.queryByText('redact-secret 1.0.0')).toBeNull();
    expect(screen.getByRole('link', { name: 'Site' })).toHaveAttribute('rel', 'noreferrer');
  });
});
