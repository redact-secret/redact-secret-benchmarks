import { resolveRowsFile, resolveRowsFileParams } from '../../../../../../resolvers/pages';

/**
 * Writes `data/rows/<kind>/<id>/rows.json` into the static export: every row of a rows table that
 * has more rows than its page ships. Built from the same resolver as the page (so the file and the
 * page cannot disagree), compact, and fetched by `RowsView` through `lib/build-data.ts`. Decision:
 * docs/decisions/2026-09-30-allow-same-origin-fetch-of-build-emitted-data.md.
 */
export const dynamic = 'force-static';
export const dynamicParams = false;

export async function generateStaticParams() {
  return resolveRowsFileParams();
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const rows = await resolveRowsFile(kind, id);
  if (!rows) return new Response('Not found', { status: 404 });
  return Response.json(rows);
}
