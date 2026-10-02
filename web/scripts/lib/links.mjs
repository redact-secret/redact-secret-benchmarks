/**
 * Link checks for the static export. The app is the site root, so "inside the app" no longer means "under a prefix":
 * a link is inside the app when the path it names is a page or file of the export. A link to a legacy route
 * (`/coverage`, `/suites/<id>`) or to anything the export does not hold is outside it.
 */
import { stat } from 'node:fs/promises';
import path from 'node:path';

/** The path part of an href, without query or fragment. */
export const hrefPath = href => href.split(/[?#]/)[0];

/** True when `href` (root-relative, with the base path in front) names a page or a file of the export in `out`. */
export async function linkResolves(out, basePath, href) {
  let p = hrefPath(href);
  if (basePath) { if (p !== basePath && !p.startsWith(`${basePath}/`)) return false; p = p.slice(basePath.length) || '/'; }
  p = decodeURIComponent(p);
  const file = path.join(out, p.endsWith('/') ? `${p}index.html` : p);
  if (!file.startsWith(out + path.sep)) return false;
  try { return (await stat(file)).isFile(); } catch { return false; }
}
