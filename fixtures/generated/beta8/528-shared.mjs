import { crc32 } from "node:zlib";

// Shared authoring helpers for the Beta.12 #528 slices (categories `beta8-528a`..`beta8-528j`), the #1014
// broad-discovery READY credential families. See docs/specs/beta8-evidence.md, "Beta.12 broad-discovery slices (#528)".
//
// Every positive, twin and control is authored from the step-3 handoffs in the product repository
// (redact-secret docs/audits/evidence/1014/*.md at 4f220ea000b58fa2e0e431ad88dea4eccb393fb0), never from product
// detector code. Every credential-shaped value is built at generation time from a public `synthetic` seed; nothing is
// copied from a provider example, a scanner test vector or an issued key, and no complete key-shaped literal appears in
// any source file. The contract guard and the nine #860 probe contexts are the #464 helpers, reused unchanged.

export { ALNUM, LOWER, DIGITS, HEX, URLSAFE, LOWER_ALNUM, UPPER_DIGITS, at, guard, probeContexts, authorPositives } from "./464-shared.mjs";

export const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
/** Base62 in 0-9A-Za-z digit order (Polar's checksum encoding). */
export const BASE62_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
/** A-Za-z0-9 order (the crates.io trusted-publishing check-character alphabet as the handoff describes it). */
export const ALPHA_FIRST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A lowercase-hex UUID (8-4-4-4-12) from 32 synthetic hex characters. */
export const uuidOf = hex32 => `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20, 32)}`;

/** Standard, padded Base64 of 16 bytes taken from 32 synthetic hex characters: 22 characters then ==. */
export const base64Of16 = hex32 => Buffer.from(hex32, "hex").toString("base64");

/** Polar's era-2 checksum: the CRC32 of the 37 random characters, in base62 (0-9A-Za-z), zero-padded to 6. */
export function polarChecksum(random37) {
  let n = crc32(Buffer.from(random37, "latin1")) >>> 0, out = "";
  do { out = BASE62_DIGITS[n % 62] + out; n = Math.floor(n / 62); } while (n > 0);
  return out.padStart(6, "0");
}

/** The crates.io trusted-publishing check character as the handoff describes it: XOR of the 31 raw bytes, modulo 62, in A-Za-z0-9. */
export function cratesCheckChar(raw31) {
  let x = 0;
  for (const byte of Buffer.from(raw31, "latin1")) x ^= byte;
  return ALPHA_FIRST[x % 62];
}

/** The next character of `alphabet` after `ch`, so a mismatching check value is always a real change. */
export const other = (alphabet, ch) => alphabet[(alphabet.indexOf(ch) + 1) % alphabet.length];
