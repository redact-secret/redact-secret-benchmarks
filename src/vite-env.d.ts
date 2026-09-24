/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" builds the customer-only route allowlist: Workbench paths stop resolving. */
  readonly VITE_PUBLIC_ROUTES_ONLY?: string;
  /** "production" or "staging", set by publish-site.yml; anything else, or unset, is a local build (#155). */
  readonly VITE_SITE_ENV?: string;
  /** Benchmarks commit that produced the build, set by publish-site.yml from the checked-out HEAD (#155). */
  readonly VITE_BUILD_COMMIT?: string;
  /** Benchmarks release tag a production build was published from, set by publish-site.yml. */
  readonly VITE_BUILD_RELEASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
