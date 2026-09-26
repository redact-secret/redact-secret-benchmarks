import { escapeHtml } from './html';

/**
 * EvidenceCrumb: the bookmarkable evidence hierarchy for the current page.
 * Every part but the current one is a link, so canonical fixture bytes remain
 * reachable from provider/family, scenario, and development-history views.
 */
export interface CrumbPart { label: string; href?: string }

export function evidenceCrumb(parts: CrumbPart[]): string {
  const items = parts.map((part, i) => {
    const last = i === parts.length - 1;
    return `<li${last ? ' aria-current="page"' : ''}>${part.href && !last ? `<a href="${escapeHtml(part.href)}">${escapeHtml(part.label)}</a>` : escapeHtml(part.label)}</li>`;
  });
  return `<nav class="crumb" aria-label="Breadcrumb"><ol>${items.join('')}</ol></nav>`;
}
