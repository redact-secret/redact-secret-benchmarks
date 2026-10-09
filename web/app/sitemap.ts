import type { MetadataRoute } from 'next';
import { resolveSitemapPage } from '../resolvers/sitemap-pages';

export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return resolveSitemapPage();
}
