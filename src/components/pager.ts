import { escapeHtml } from './html';

/**
 * Pager: Previous, "Page n of m", Next. A list that fits on one page has
 * nothing to turn, so the controls stay hidden instead of sitting there
 * disabled. `lead` is HTML placed before the controls (a row count).
 */
export function pager(id: string, lead = ''): string {
  const key = escapeHtml(id);
  return `<div class="pager">${lead}<span class="pager-turn" id="${key}-turn" hidden><button class="btn" type="button" id="${key}-prev">Previous</button><span id="${key}-page"></span><button class="btn" type="button" id="${key}-next">Next</button></span></div>`;
}

/** Wires the two buttons; call the returned function after every render with the zero-based page and the page count. */
export function bindPager(id: string, turn: (delta: -1 | 1) => void): (page: number, pages: number) => void {
  const part = <T extends HTMLElement>(name: string) => document.getElementById(`${id}-${name}`) as T;
  const prev = part<HTMLButtonElement>('prev'), next = part<HTMLButtonElement>('next');
  prev.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));
  return (page, pages) => {
    part('turn').hidden = pages <= 1;
    part('page').textContent = `Page ${page + 1} of ${pages}`;
    prev.disabled = page === 0; next.disabled = page + 1 >= pages;
  };
}
