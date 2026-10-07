/**
 * The machine this site build runs on (#621): the PUBLICATION host. It is read when the page is built and is never the host of a measurement: the
 * scanner page shows it apart from the measurement host the official run recorded (`OfficialRun.host`), because a build can reuse runs measured
 * elsewhere and earlier. Bounded tokens only: no path, username or hostname.
 */
import { arch, platform } from 'node:os';
import { once } from './repo';

export interface BuildHost {
  /** The date of the build (UTC). */
  builtOn: string;
  platform: string;
  arch: string;
  node: string;
  /** The GitHub-hosted runner image, when the build runs in GitHub Actions; `null` otherwise. */
  ci: { image: string | null; imageVersion: string | null } | null;
}

const TOKEN = /^[A-Za-z0-9._+-]{1,64}$/;
const token = (v: string | undefined): string | null => (v && TOKEN.test(v) ? v : null);

export function readBuildHost(env: Record<string, string | undefined> = process.env, now: Date = new Date()): BuildHost {
  return {
    builtOn: now.toISOString().slice(0, 10), platform: platform(), arch: arch(), node: process.version,
    ci: env.GITHUB_ACTIONS === 'true' ? { image: token(env.ImageOS), imageVersion: token(env.ImageVersion) } : null,
  };
}

export function loadBuildHost(): Promise<BuildHost> {
  return once('build-host', async () => readBuildHost());
}
