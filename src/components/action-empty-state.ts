import { escapeHtml } from './html';

/**
 * ActionEmptyState: one sentence saying what is missing, one command to run
 * next. It does not apologise. A dashed `ink-muted` border, because nothing
 * here is a status.
 */
/** `body` and `mark` are HTML (a sentence may carry <code>); escape any untrusted value before passing it in. */
export interface ActionEmptyStateInput { title: string; body: string; command?: string; mark?: string }

export function actionEmptyState({ title, body, command, mark }: ActionEmptyStateInput): string {
  if (/\b(sorry|apolog|oops|unfortunately)/i.test(`${title} ${body}`)) throw new Error('ActionEmptyState states what is missing and what to run; it does not apologise');
  return `<div class="empty-state" role="status"><h3 class="h3">${escapeHtml(title)}</h3><p class="small">${body}</p>${command ? `<pre class="cmd"><code>${escapeHtml(command)}</code></pre>` : ''}${mark ? `<p>${mark}</p>` : ''}</div>`;
}
