import { createHash } from 'node:crypto';

export function synthesize(namespace, seed, length, alphabet) {
  let out = '';
  for (let block = 0; out.length < length; block += 1) {
    const digest = createHash('sha256').update(`${namespace}:${seed}:${block}`).digest();
    for (const byte of digest) {
      if (out.length === length) break;
      out += alphabet[byte % alphabet.length];
    }
  }
  return out;
}

// Group E historically shares this exact seed domain, independently of carrier corpus ownership.
export const carrierSynthetic = (seed, length, alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') => synthesize('batch2:739:r2', seed, length, alphabet);
