import type { FooterLink } from '../components/shell/SiteFooter';

/** Where the footer sends a reader beyond this site. */
export const FOOTER_LINKS: FooterLink[] = [
  { label: 'redactsecret.com', href: 'https://redactsecret.com' },
  { label: 'GitHub · redact-secret', href: 'https://github.com/redact-secret/redact-secret' },
  { label: 'GitHub · benchmarks', href: 'https://github.com/redact-secret/redact-secret-benchmarks' },
  { label: 'Security', href: 'https://github.com/redact-secret/redact-secret-benchmarks/blob/main/SECURITY.md' },
];

export const LICENSE_HREF = 'https://github.com/redact-secret/redact-secret-benchmarks/blob/main/LICENSE';
