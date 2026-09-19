import { logo, logoSprite } from './logo';
import { escape as e } from './types';

/** App chrome: one top bar, four entrances, one search. Mounted once so polling re-renders never steal focus. */
export interface NavItem { href: string; label: string; short: string; current: (path: string) => boolean }
export interface SearchTarget { href: string; label: string; hint: string }
interface ShellOptions { nav: NavItem[]; targets: () => SearchTarget[]; navigate: (path: string) => void }

const THEME_KEY = 'redact-secret-benchmarks:theme';
const SEARCH_LIMIT = 12;
let options: ShellOptions;
let main: HTMLElement;

const isDark = () => {
  const forced = document.documentElement.getAttribute('data-theme');
  return forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};

function bindTheme(button: HTMLButtonElement) {
  const label = () => {
    const next = isDark() ? 'Light' : 'Dark';
    button.innerHTML = `<span class="wide">${next} theme</span><span class="narrow">${next}</span>`;
    button.setAttribute('aria-label', `Switch to ${next.toLowerCase()} theme`);
  };
  button.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    label();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', label);
  label();
}

/** Every word of the query must appear; detectors and suites are listed before fixtures. */
export function searchTargets(targets: SearchTarget[], query: string, limit = SEARCH_LIMIT): SearchTarget[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return targets.filter(t => { const text = `${t.label} ${t.hint} ${t.href}`.toLowerCase(); return words.every(w => text.includes(w)); }).slice(0, limit);
}

function bindSearch(input: HTMLInputElement, list: HTMLElement) {
  let active = -1;
  const links = () => Array.from(list.querySelectorAll<HTMLAnchorElement>('a'));
  const close = () => { list.hidden = true; list.innerHTML = ''; active = -1; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); };
  const mark = () => links().forEach((a, i) => {
    a.setAttribute('aria-selected', String(i === active));
    if (i === active) { input.setAttribute('aria-activedescendant', a.id); a.scrollIntoView({ block: 'nearest' }); }
  });
  const render = () => {
    const found = searchTargets(options.targets(), input.value);
    if (!input.value.trim()) return close();
    list.innerHTML = found.length
      ? found.map((t, i) => `<li role="presentation"><a id="search-option-${i}" role="option" aria-selected="false" tabindex="-1" href="${e(t.href)}">${e(t.label)}<small>${e(t.hint)}</small></a></li>`).join('')
      : '<li class="none" role="presentation">No detector, suite or fixture matches.</li>';
    list.hidden = false; active = found.length ? 0 : -1;
    input.setAttribute('aria-expanded', 'true');
    mark();
  };
  input.addEventListener('input', render);
  input.addEventListener('focus', () => { if (input.value.trim()) render(); });
  input.addEventListener('keydown', event => {
    const all = links();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (list.hidden) render();
      if (!all.length) return;
      event.preventDefault();
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length;
      mark();
    } else if (event.key === 'Enter' && all[active]) {
      event.preventDefault();
      const path = new URL(all[active].href).pathname;
      input.value = ''; close(); options.navigate(path);
    } else if (event.key === 'Escape') close();
  });
  list.addEventListener('click', () => { input.value = ''; close(); });
  document.addEventListener('click', event => { if (!(event.target as Element).closest('.search')) close(); });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((event.target as Element).tagName)) { event.preventDefault(); input.focus(); }
  });
}

export function mountShell(app: HTMLElement, shellOptions: ShellOptions) {
  options = shellOptions;
  const links = (short: boolean) => options.nav.map(item => `<a href="${e(item.href)}" data-nav="${e(item.href)}">${e(short ? item.short : item.label)}</a>`).join('');
  app.innerHTML = `<a class="skip" href="#main">Skip to content</a>${logoSprite()}
    <header class="top"><div class="top-in">
      <a class="brand" href="${e(options.nav[0].href)}" aria-label="Redact Secret benchmarks, ${e(options.nav[0].label)}">${logo()}</a>
      <nav class="nav" aria-label="Primary">${links(false)}</nav>
      <div class="top-tools">
        <div class="search" role="search"><label class="visually-hidden" for="global-search">Search detectors, suites and fixtures</label><input id="global-search" type="search" role="combobox" aria-expanded="false" aria-controls="global-search-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Search detectors, suites, fixtures"><ul class="search-list" id="global-search-list" role="listbox" aria-label="Search results" hidden></ul></div>
        <button class="btn" id="theme-toggle" type="button"></button>
      </div>
    </div></header>
    <main class="content" id="main" tabindex="-1"></main>
    <footer class="foot"><div class="foot-in"><p class="small">Project-maintained measurements on shared synthetic inputs. This site records results; it makes no product claims.</p><p class="small"><a href="https://github.com/redact-secret/redact-secret-benchmarks">Repository</a> · refreshes every 5 s</p></div></footer>
    <nav class="tabs" aria-label="Primary, compact">${links(true)}</nav>`;
  main = app.querySelector<HTMLElement>('#main')!;
  bindTheme(app.querySelector<HTMLButtonElement>('#theme-toggle')!);
  bindSearch(app.querySelector<HTMLInputElement>('#global-search')!, app.querySelector<HTMLElement>('#global-search-list')!);
}

export function renderPage(content: string, label: string) {
  document.title = `${label} · Redact Secret Benchmarks`;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach(a => {
    const item = options.nav.find(n => n.href === a.dataset.nav)!;
    if (item.current(path)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  main.innerHTML = content;
}
