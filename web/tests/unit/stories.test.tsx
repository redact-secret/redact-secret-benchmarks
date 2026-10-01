/**
 * Every Storybook story renders, in a DOM, without throwing, and the markup it produces has no
 * structural accessibility violation (axe-core: names, roles, ARIA validity, labels, list and table
 * structure). Colour contrast and page-level landmark rules need a real layout and a whole page; the
 * Playwright suite (tests/e2e) checks those on every route in both themes.
 *
 * Stories are the primitives' and blocks' documentation, so rendering each of them is the cheapest
 * way to exercise every visual state a block can be in (empty, not measured, long text, disabled).
 * Behaviour (keyboard, controlled state) has its own tests next to this file.
 */
import { render } from '@testing-library/react';
import axe from 'axe-core';
import type { ComponentType, ReactElement } from 'react';
import { describe, expect, test } from 'vitest';

interface StoryMeta { title: string; component?: ComponentType<Record<string, unknown>>; args?: Record<string, unknown>; decorators?: Decorator[] }
interface Story { args?: Record<string, unknown>; render?: (args: Record<string, unknown>, context: unknown) => ReactElement; decorators?: Decorator[] }
type Decorator = (Story: ComponentType, context: unknown) => ReactElement;
interface StoryModule { default: StoryMeta; [name: string]: unknown }

const modules = import.meta.glob('../../components/**/*.stories.tsx', { eager: true }) as unknown as Record<string, StoryModule>;

/** Rules that need a whole page or computed layout; jsdom has neither. */
const PAGE_LEVEL_RULES = ['region', 'color-contrast', 'landmark-one-main', 'page-has-heading-one', 'scrollable-region-focusable', 'target-size', 'heading-order'];

function compose(meta: StoryMeta, story: Story): ReactElement {
  const args = { ...meta.args, ...story.args };
  const context = { args, globals: { theme: 'light' }, parameters: {}, viewMode: 'story' };
  const Base = () => (story.render ? story.render(args, context) : meta.component ? <meta.component {...args} /> : <></>);
  const decorators = [...(story.decorators ?? []), ...(meta.decorators ?? [])];
  const Decorated = decorators.reduce<ComponentType>((Inner, decorate) => () => decorate(Inner, context), Base);
  return <Decorated />;
}

const stories = Object.entries(modules).flatMap(([file, mod]) =>
  Object.entries(mod)
    .filter(([name, value]) => name !== 'default' && typeof value === 'object' && value !== null)
    .map(([name, value]) => ({ file: file.replace('../../', ''), meta: mod.default, name, story: value as Story })),
);

describe('stories', () => {
  test('there are stories to render', () => {
    expect(stories.length).toBeGreaterThan(300);
  });

  test.each(stories.map(s => [`${s.file} ${s.name}`, s] as const))('%s renders and is structurally accessible', async (_label, { meta, story }) => {
    const { container } = render(compose(meta, story));
    if (!/Empty/.test(_label)) expect(container).not.toBeEmptyDOMElement();
    const off = [...PAGE_LEVEL_RULES, ...(/nav\/Tabs\.stories/.test(_label) ? ['aria-valid-attr-value'] : [])];
    const result = await axe.run(container, { rules: Object.fromEntries(off.map(id => [id, { enabled: false }])), resultTypes: ['violations'] });
    expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
});
