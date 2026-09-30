// Static export of the redesigned site (#547). Output goes to web/out, never to
// the repository's dist/, which is what publish-site.yml syncs; nothing here can
// change what develop or main publish today.
//
// BASE_PATH is where the site is served. It defaults to /next, the preview prefix
// decided in docs/decisions/2026-09-30-...; cutover builds with BASE_PATH= (empty).
import path from 'node:path';

const basePath = process.env.BASE_PATH ?? '/next';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  // `next/image` with `unoptimized` does not add the base path to a public file; components read this to do it.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // tokens.css and tokens.json are read from the existing site's src/ until cutover (theme/tokens.ts).
  experimental: { externalDir: true },
  // The repo root, so files read from ../src resolve and the parent lockfile is not mistaken for a second workspace.
  turbopack: { root: path.resolve(import.meta.dirname, '..') },
  reactStrictMode: true,
};

export default nextConfig;
