/** Components are self-contained so they can move to the design system: no app imports, no data access. */
export const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const formatPercent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
export const formatCount = (value: number) => value.toLocaleString('en-US');
