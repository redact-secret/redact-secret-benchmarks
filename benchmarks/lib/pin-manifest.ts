export interface PinManifestPins {
  sourceRevision: string;
  redactSecretRevision: string;
  redactSecretVersion: string;
  packageVersion: string;
}

export interface PinManifest {
  schemaVersion: 1;
  /** This repository's commit as of the last generation that changed pins, corpus hashes, or the fixture list. */
  revision: string;
  pins: PinManifestPins;
  corpusHashes: Record<string, string>;
  fixtureIds: string[];
}

export type PinManifestContent = Pick<PinManifest, 'schemaVersion' | 'pins' | 'corpusHashes' | 'fixtureIds'>;

/**
 * `revision` cannot reference the commit that carries this very file (a commit cannot embed its own
 * hash), so it only advances when the meaningful content actually changes; otherwise the previous
 * commit's file is reproduced byte-for-byte, which is what lets `git diff --exit-code` catch drift
 * without also flagging every unrelated commit.
 */
export function buildPinManifest(
  input: { pins: PinManifestPins; corpusHashes: Record<string, string>; fixtureIds: string[] },
  current: PinManifest | null,
  revisionIfChanged: string,
): PinManifest {
  const content: PinManifestContent = {
    schemaVersion: 1,
    pins: input.pins,
    corpusHashes: input.corpusHashes,
    fixtureIds: [...input.fixtureIds].sort(),
  };
  const unchanged = current !== null && contentEqual(current, content);
  const revision = unchanged ? current!.revision : revisionIfChanged;
  return { schemaVersion: content.schemaVersion, revision, pins: content.pins, corpusHashes: content.corpusHashes, fixtureIds: content.fixtureIds };
}

function contentEqual(a: PinManifestContent, b: PinManifestContent): boolean {
  return a.schemaVersion === b.schemaVersion &&
    JSON.stringify(a.pins) === JSON.stringify(b.pins) &&
    JSON.stringify(a.corpusHashes) === JSON.stringify(b.corpusHashes) &&
    JSON.stringify(a.fixtureIds) === JSON.stringify(b.fixtureIds);
}
