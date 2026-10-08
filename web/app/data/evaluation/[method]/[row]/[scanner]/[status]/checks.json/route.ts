import { resolveMethodChecksFile, resolveMethodChecksFileParams } from '../../../../../../../../resolvers/evaluation-pages';

/**
 * Writes `data/evaluation/<method>/<row>/<scanner>/<status>/checks.json` into the static export (#623): the checks behind one count of a
 * method table, packed, in run order. Built from the same per-method lists as the method page's links and its checks page (so the file, the
 * figure and the index cannot disagree), bounded by one list, and fetched by `ChecksView` through `lib/build-data.ts` only when that list is
 * opened. Decision: docs/decisions/2026-10-07-link-method-cells-to-the-checks-behind-each-count.md.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  return resolveMethodChecksFileParams();
}

export async function GET(_request: Request, { params }: { params: Promise<{ method: string; row: string; scanner: string; status: string }> }) {
  const file = await resolveMethodChecksFile(await params);
  if (!file) return new Response('Not found', { status: 404 });
  return Response.json(file);
}
