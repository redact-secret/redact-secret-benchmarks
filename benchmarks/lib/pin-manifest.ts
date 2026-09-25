import { AFTER_FIRST_RUN, type IntakeStatus } from './adversarial-intake.ts';

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

/** The fields of an adversarial pack's intake record that the pin manifest reads. */
export interface PinnablePack {
  id: string;
  sample: boolean;
  status: IntakeStatus;
  fixtures: readonly { id: string }[];
  expectations: { digest: string };
}

/**
 * Pin entries for adversarial packs (#310): each non-sample pack whose expectations are frozen
 * (`frozen-first-run` or later) contributes its expectations digest under `corpusHashes[<pack id>]`
 * and its fixtures as `<pack id>--<fixture id>`, the identity known-gap records already use. That
 * lets the product repository's pin check accept a regression record that points at a pack fixture.
 * A pack still in intake has no frozen expectations and is left out.
 */
export function packPinEntries(packs: readonly PinnablePack[]): { corpusHashes: Record<string, string>; fixtureIds: string[] } {
  const corpusHashes: Record<string, string> = {};
  const fixtureIds: string[] = [];
  for (const pack of packs) {
    if (pack.sample || !AFTER_FIRST_RUN.includes(pack.status)) continue;
    corpusHashes[pack.id] = pack.expectations.digest;
    for (const fixture of pack.fixtures) fixtureIds.push(`${pack.id}--${fixture.id}`);
  }
  return { corpusHashes, fixtureIds };
}

/** Category corpus hashes plus pack entries; a pack id that reuses a category id is an error. */
export function mergePinSources(
  categories: { corpusHashes: Record<string, string>; fixtureIds: string[] },
  packs: { corpusHashes: Record<string, string>; fixtureIds: string[] },
): { corpusHashes: Record<string, string>; fixtureIds: string[] } {
  for (const id of Object.keys(packs.corpusHashes)) {
    if (id in categories.corpusHashes) throw new Error(`Adversarial pack id ${id} collides with a corpus category id in the pin manifest`);
  }
  const fixtureIds = new Set(categories.fixtureIds);
  for (const id of packs.fixtureIds) {
    if (fixtureIds.has(id)) throw new Error(`Adversarial pack fixture id ${id} collides with a corpus fixture id in the pin manifest`);
    fixtureIds.add(id);
  }
  return { corpusHashes: { ...categories.corpusHashes, ...packs.corpusHashes }, fixtureIds: [...fixtureIds] };
}
