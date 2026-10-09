/**
 * The interactive primitives, driven the way a keyboard or screen-reader user drives them:
 * found by role and accessible name, operated with keys. What the parent owns (the value) is
 * a prop; what the primitive owns (focus, key handling, ARIA state) is asserted.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import './next-mocks';
import { Disclosure } from '../../components/disclosure';
import { Pager, SegmentedControl, SegmentedNav, SelectField, Tabs, TabPanel, TextField } from '../../components/nav';
import { ThemeToggle } from '../../components/shell';
import { ThemeRoot } from '../../theme/ThemeRoot';

type Domain = 'credentials' | 'pii' | 'logs';
const ITEMS: Array<{ value: Domain; label: string; disabled?: boolean }> = [
  { value: 'credentials', label: 'Credentials' },
  { value: 'pii', label: 'PII' },
  { value: 'logs', label: 'Logs', disabled: true },
];

function TabsDemo({ onChange }: { onChange?: (v: Domain) => void }) {
  const [value, setValue] = useState<Domain>('credentials');
  return (
    <>
      <Tabs<Domain> items={ITEMS} value={value} onChange={v => { setValue(v); onChange?.(v); }} label="Kind of data" idPrefix="demo" />
      <TabPanel value="credentials" selected={value} idPrefix="demo">Credential tables</TabPanel>
      <TabPanel value="pii" selected={value} idPrefix="demo">PII tables</TabPanel>
      <TabPanel value="logs" selected={value} idPrefix="demo">Log tables</TabPanel>
    </>
  );
}

describe('Tabs', () => {
  test('is a labelled tablist with the selected tab marked and linked to its panel', () => {
    render(<TabsDemo />);
    const list = screen.getByRole('tablist', { name: 'Kind of data' });
    const tabs = within(list).getAllByRole('tab');
    expect(tabs.map(t => t.textContent)).toEqual(['Credentials', 'PII', 'Logs']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    const panel = screen.getByRole('tabpanel', { name: 'Credentials' });
    expect(panel).toHaveTextContent('Credential tables');
    expect(tabs[0]).toHaveAttribute('aria-controls', panel.id);
    // Only the selected panel has content; the others are hidden.
    expect(document.getElementById('demo-panel-pii')).toHaveAttribute('hidden');
    expect(document.getElementById('demo-panel-pii')).toBeEmptyDOMElement();
  });

  test('only the selected tab is in the tab order (roving tabindex)', () => {
    render(<TabsDemo />);
    const [first, second] = screen.getAllByRole('tab');
    expect(first).toHaveAttribute('tabindex', '0');
    expect(second).toHaveAttribute('tabindex', '-1');
  });

  test('arrow keys move focus along the tabs, skip the disabled one and wrap; Enter or Space selects', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TabsDemo onChange={onChange} />);
    const [credentials, pii] = screen.getAllByRole('tab');
    await user.tab();
    expect(credentials).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(pii).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(credentials).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(pii).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('pii');
    expect(screen.getByRole('tabpanel', { name: 'PII' })).toHaveTextContent('PII tables');
    await user.keyboard('{Home}');
    expect(credentials).toHaveFocus();
    await user.keyboard('{End}');
    expect(pii).toHaveFocus();
  });

  test('a disabled tab cannot be selected by pointer', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onChange = vi.fn();
    render(<TabsDemo onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Logs' })).toBeDisabled();
    await user.click(screen.getByRole('tab', { name: 'Logs' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SegmentedControl', () => {
  const OPTIONS = [{ value: 'all', label: 'All rows' }, { value: 'diff', label: 'Only differences' }];

  test('is a labelled group of toggle buttons; the chosen one is pressed', () => {
    render(<SegmentedControl label="Rows" options={OPTIONS} value="diff" onChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'Rows' });
    expect(within(group).getByRole('button', { name: 'Only differences' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'All rows' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('reports the new value on click and on Space, and never reports "nothing" when the pressed one is pressed again', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl label="Rows" options={OPTIONS} value="all" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Only differences' }));
    expect(onChange).toHaveBeenLastCalledWith('diff');
    onChange.mockClear();
    await user.click(screen.getByRole('button', { name: 'All rows' }));
    expect(onChange).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Only differences' }).focus();
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith('diff');
  });
});

describe('Disclosure', () => {
  test('is a native details: closed by default, its summary is the toggle, Enter and Space open it', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { container } = render(<Disclosure summary="Show the files" onToggle={onToggle}>Hidden list</Disclosure>);
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    const summary = screen.getByText('Show the files');
    expect(summary.tagName).toBe('SUMMARY');
    await user.click(summary);
    expect(details.open).toBe(true);
    await waitForToggle(onToggle, true);
  });

  test('defaultOpen starts open, and the onToggle callback is optional', () => {
    const { container } = render(<Disclosure summary="Open already" defaultOpen variant="nested">Body</Disclosure>);
    expect(container.querySelector('details')!.open).toBe(true);
  });
});

async function waitForToggle(fn: ReturnType<typeof vi.fn>, expected: boolean) {
  await vi.waitFor(() => expect(fn).toHaveBeenCalledWith(expected));
}

describe('SegmentedNav and Pager', () => {
  test('SegmentedNav is a labelled navigation of links; the current one says so', () => {
    render(<SegmentedNav label="Evidence level" currentHref="/report/rows/T2/" items={[{ href: '/report/rows/T1/', label: 'T1' }, { href: '/report/rows/T2/', label: 'T2' }]} />);
    const nav = screen.getByRole('navigation', { name: 'Evidence level' });
    expect(within(nav).getByRole('link', { name: 'T2' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'T1' })).not.toHaveAttribute('aria-current');
  });

  test('Pager in button mode: Previous is inert on page 1, Next calls back, the position is announced politely', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Pager page={1} pageCount={3} total={250} pageSize={100} onNext={onNext} />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByText('Previous')).toHaveAttribute('aria-disabled', 'true');
    expect(within(nav).getByText(/Page 1 of 3 · 1–100 of 250 rows/)).toHaveAttribute('aria-live', 'polite');
    await user.click(within(nav).getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test('Pager in link mode renders rel=prev and rel=next links; the last page has no Next; totals are optional', () => {
    const { rerender } = render(<Pager page={2} pageCount={3} previousHref="?page=1" nextHref="?page=3" />);
    expect(screen.getByRole('link', { name: 'Previous' })).toHaveAttribute('rel', 'prev');
    expect(screen.getByRole('link', { name: 'Next' })).toHaveAttribute('rel', 'next');
    rerender(<Pager page={3} pageCount={3} total={0} itemLabel="files" />);
    expect(screen.getByText('Next')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(/Page 3 of 3 · 0 files/)).toBeInTheDocument();
  });
});

describe('fields', () => {
  test('TextField and SelectField are labelled by their visible label', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <TextField label="Find" onChange={e => onChange(e.target.value)} />
        <SelectField label="Show" options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} onChange={e => onChange(e.target.value)} />
      </>,
    );
    await user.type(screen.getByRole('searchbox', { name: 'Find' }), 'ab');
    expect(onChange).toHaveBeenLastCalledWith('ab');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'b');
    expect(onChange).toHaveBeenLastCalledWith('b');
  });
});

describe('ThemeToggle', () => {
  test('one icon toggles only light and dark and persists the choice', async () => {
    localStorage.setItem('redact-secret-benchmarks:theme', 'light');
    const user = userEvent.setup();
    render(<ThemeRoot><ThemeToggle /></ThemeRoot>);
    const button = screen.getByRole('button', { name: /Color theme:/ });
    expect(button).toHaveAttribute('data-mode', 'light');
    await user.click(button);
    expect(button).toHaveAttribute('data-mode', 'dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('redact-secret-benchmarks:theme')).toBe('dark');
    await user.click(button);
    expect(button).toHaveAttribute('data-mode', 'light');
    expect(localStorage.getItem('redact-secret-benchmarks:theme')).toBe('light');
  });
});
