import { escapeHtml } from './html';

/**
 * DomainBar: the domain switch and the accounting identity on one line, kept
 * apart. The switch is a control, so it is a segment; the identity is read,
 * so it is labelled text. Switching changes which accounting the page reads,
 * not which rows it filters, so the accounting version is always visible.
 */
export interface DomainBarLink { href: string; label: string; current: boolean }
/** `value` is HTML (it usually carries <code>); escape untrusted text before passing it in. */
export interface DomainBarIdentity { label: string; value: string }
export interface DomainBarInput { label: string; links: DomainBarLink[]; identities: DomainBarIdentity[] }

export function domainBar({ label, links, identities }: DomainBarInput): string {
  if (links.filter(link => link.current).length !== 1) throw new Error('DomainBar marks exactly one domain as current');
  if (!identities.some(identity => /accounting/i.test(identity.label))) throw new Error('DomainBar always names the accounting it reads');
  const seg = links.map(link => `<a href="${escapeHtml(link.href)}"${link.current ? ' aria-current="page"' : ''}>${escapeHtml(link.label)}</a>`).join('');
  const ids = identities.map(identity => `<div><dt>${escapeHtml(identity.label)}</dt><dd>${identity.value}</dd></div>`).join('');
  return `<div class="domain-bar"><nav class="seg" aria-label="${escapeHtml(label)}">${seg}</nav><dl class="domain-ids">${ids}</dl></div>`;
}
