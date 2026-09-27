import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Operations = { rename: typeof rename };
type Validations = { artifact(bytes: Buffer): void | Promise<void>; index(bytes: Buffer): void | Promise<void>; beforeCommit(): void | Promise<void> };

/** Publish an immutable content-addressed artifact, then atomically move the sole mutable commit marker. */
export async function publishArtifactAndIndex(piiTarget: string, piiBytes: string, indexTarget: string, indexBytes: string,
  validations: Validations, operations: Operations = { rename }): Promise<void> {
  await Promise.all([mkdir(path.dirname(piiTarget), { recursive: true }), mkdir(path.dirname(indexTarget), { recursive: true })]);
  const piiTemporary = `${piiTarget}.tmp`, indexTemporary = `${indexTarget}.tmp`;
  try {
    await writeFile(piiTemporary, piiBytes);
    await validations.artifact(await readFile(piiTemporary));
    await operations.rename(piiTemporary, piiTarget);
    await validations.artifact(await readFile(piiTarget));
    await writeFile(indexTemporary, indexBytes);
    await validations.index(await readFile(indexTemporary));
    await validations.beforeCommit();
    await operations.rename(indexTemporary, indexTarget);
  } finally {
    // Content-addressed artifacts are never rolled back or deleted: an unreferenced file is harmless,
    // while the previous index must keep its previous immutable target addressable.
    await Promise.all([piiTemporary, indexTemporary].map(file => unlink(file).catch(() => undefined)));
  }
}
