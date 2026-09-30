/**
 * Header and logo rules (#554), run by `npm run check:header` and by
 * tests/web-header.test.mjs at the repository root (pure node, no install).
 *
 *  canonical-asset  public/logo-light.svg and logo-dark.svg are byte-identical to
 *                   the design system's Logos group. The hashes below pin them;
 *                   they change only when the design system changes them.
 *  header-logo      SiteHeader renders both files through an image, and draws no
 *                   mark of its own (no <svg>, <path>, or CSS triangle).
 *  header-tokens    SiteHeader.module.css has no colour literal, no raw length
 *                   (outside @media conditions), no !important; the logo's width
 *                   is the --logo-w token and its height follows the asset.
 *
 * The rendered size and aspect of the logo are checked in the browser by
 * scripts/check-layout.mjs.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANONICAL = {
  'logo-light.svg': 'b09acd3c75e6beaa30f0a6810adad17f7fc44a4378704544dff8bf0ea632b85e',
  'logo-dark.svg': '6d8928163da50847793b7c9b09b2863a6e3e2cf12b62da9558dff7b7fe4dc16d',
};

const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Pure: takes the file contents, returns `{ rule, message }` problems. */
export function findHeaderViolations({ logos, tsx, css }) {
  const problems = [];
  const add = (rule, message) => problems.push({ rule, message });

  for (const [name, sha] of Object.entries(CANONICAL)) {
    if (logos[name] === undefined) add('canonical-asset', `public/${name} is missing`);
    else if (createHash('sha256').update(logos[name]).digest('hex') !== sha) add('canonical-asset', `public/${name} is not the canonical asset (hash differs)`);
  }

  const code = tsx.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  for (const name of Object.keys(CANONICAL)) {
    // The path is the plain string, or the base path (NEXT_PUBLIC_BASE_PATH) followed by it.
    if (!new RegExp(`src=(?:["']|\\{\`\\$\\{BASE\\})/${name.replace('.', '\\.')}(?:["']|\`\\})`).test(code)) add('header-logo', `SiteHeader must render /${name}`);
  }
  if (/<svg\b|<path\b|<symbol\b|dangerouslySetInnerHTML/.test(code)) add('header-logo', 'SiteHeader must not draw the mark itself; use the canonical files');
  if (/\.(?:png|jpe?g|webp|gif)\b/i.test(code)) add('header-logo', 'SiteHeader must use the canonical SVG, not a raster copy');

  const rules = stripComments(css);
  if (/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(/.test(rules)) add('header-tokens', 'SiteHeader.module.css has a colour literal; use a token');
  if (/!important/.test(rules)) add('header-tokens', 'SiteHeader.module.css uses !important');
  const outsideMedia = rules.replace(/@media[^{]*\{/g, '{');
  if (/(?<![\w-])-?\d*\.?\d+(?:px|rem|em)\b/.test(outsideMedia.replace(/var\([^)]*\)/g, ''))) add('header-tokens', 'SiteHeader.module.css has a raw length; use a space token or a measure');
  if (/border-(?:left|right|bottom)\s*:[^;]*transparent/.test(rules) && /width:\s*0\b/.test(rules) && /height:\s*0\b/.test(rules)) add('header-logo', 'SiteHeader.module.css draws a CSS triangle instead of the canonical logo');
  const logoRule = rules.match(/\.logoLight,\s*\.logoDark\s*\{([^}]*)\}/);
  if (!logoRule) add('header-tokens', 'SiteHeader.module.css must size .logoLight and .logoDark together');
  else {
    if (!/width:\s*var\(--logo-w\)/.test(logoRule[1])) add('header-tokens', 'the logo width must be var(--logo-w)');
    if (!/height:\s*auto/.test(logoRule[1])) add('header-tokens', 'the logo height must be auto, so the asset is never stretched');
  }
  return problems;
}

export async function checkHeader(webRoot) {
  const read = file => readFile(path.join(webRoot, file));
  const logos = {};
  for (const name of Object.keys(CANONICAL)) logos[name] = await read(`public/${name}`).catch(() => undefined);
  const tsx = (await read('components/shell/SiteHeader.tsx')).toString('utf8');
  const css = (await read('components/shell/SiteHeader.module.css')).toString('utf8');
  return findHeaderViolations({ logos, tsx, css }).map(p => `[${p.rule}] ${p.message}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = await checkHeader(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  console.log('header ok: canonical logo files, no drawn mark, tokens only');
}
