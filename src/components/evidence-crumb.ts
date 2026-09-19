import { escapeHtml } from './html';

/**
 * EvidenceCrumb: detector › suite › fixture › case › assertion. Every part but
 * the current one is a bookmarkable link, so the bytes are never more than two
 * clicks away.
 */
export interface CrumbPart { label: string; href?: string }

export function evidenceCrumb(parts: CrumbPart[]): string {
  const items = parts.map((part, i) => {
    const last = i === parts.length - 1;
    return `<li${last ? ' aria-current="page"' : ''}>${part.href && !last ? `<a href="${escapeHtml(part.href)}">${escapeHtml(part.label)}</a>` : escapeHtml(part.label)}</li>`;
  });
  return `<nav class="crumb" aria-label="Breadcrumb"><ol>${items.join('')}</ol></nav>`;
}
