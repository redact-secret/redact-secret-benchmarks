import { crc32 } from "node:zlib";
import { base36Crc } from "../../../benchmarks/lib/beta8/212.ts";

// Shared authoring helpers for the Beta.12 #1012 slices (categories `beta8-1012a`..`beta8-1012e`): the credential
// variants the product first ships at 4fb7882 (the AWS secret access key, the Google OAuth client secret, the routable
// GitLab PAT, the ASIA key id and the Vercel vcp_/vca_/vcr_ classes). See docs/specs/beta8-evidence.md, "Beta.12
// first-measured variant slices (#1012)".
//
// Every positive, twin and control is authored from the research records in the product repository
// (redact-secret docs/audits/evidence/1012/*.md and 1013/vercel.md at 4fb78827f1ddf5b3106f25130ca510a836ada186), never from
// product detector code. Every credential-shaped value is built at generation time from a public `synthetic` seed;
// nothing is copied from a provider example, a scanner test vector or an issued key, and no complete key-shaped literal
// appears in any source file. The contract guard and the nine #860 probe contexts are the #464 helpers, reused unchanged.

export { ALNUM, LOWER, DIGITS, HEX, URLSAFE, LOWER_ALNUM, UPPER_DIGITS, at, guard, probeContexts, authorPositives } from "./464-shared.mjs";
export { base36Crc };

/** Base62 in 0-9A-Za-z digit order (the Vercel checksum-suffix encoding the #1013 record describes). */
export const BASE62_DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const BASE32_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
/** The AWS secret access key alphabet (Base64 without padding). */
export const AWS_SECRET_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/+";

/** The Vercel checksum suffix as the #1013 record describes it: base62 of the CRC-32 of the 50 characters before it, zero-padded to 6. */
export function vercelChecksum(body50) {
  let n = crc32(Buffer.from(body50, "latin1")) >>> 0, out = "";
  do { out = BASE62_DIGITS[n % 62] + out; n = Math.floor(n / 62); } while (n > 0);
  return out.padStart(6, "0");
}

/** The next character of `alphabet` after `ch`, so a mismatching check value is always a real change. */
export const other = (alphabet, ch) => alphabet[(alphabet.indexOf(ch) + 1) % alphabet.length];

/**
 * A routable GitLab token from a base64url `payload`: <prefix><payload>.<version>.<base36 length><base36 CRC32 of all before>
 * (routable_token.rb). `length` overrides the length holder (for a length-holder twin); the CRC is always recomputed.
 */
export function routableToken(prefix, payload, { version = "01", length = payload.length } = {}) {
  const head = `${prefix}${payload}.${version}.${length.toString(36).padStart(2, "0")}`;
  return head + base36Crc(head);
}

/** The payload routable_token.rb encodes for a PAT: 16 random bytes + sorted "k:v" routing lines (base36 values) + one length byte, base64url unpadded. */
export function routablePatPayload(synthetic, seed, routing) {
  const lines = Object.entries(routing).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v.toString(36)}`).join("\n");
  const bytes = Buffer.concat([Buffer.from(synthetic(`${seed}:random`, 32, "0123456789abcdef"), "hex"), Buffer.from(lines), Buffer.from([lines.length])]);
  return bytes.toString("base64url");
}
