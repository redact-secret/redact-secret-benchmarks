// Pure CRC32 (IEEE 802.3, reflected polynomial 0xEDB88320), identical to node:zlib's crc32.
// Browser-reachable contracts (`benchmarks/lib/assessment.ts`) validate checksums with it, so it
// must stay free of Node built-ins and globals (tests/web-browser-graph.test.mjs).
const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** Unsigned CRC32 of `text` read as Latin-1: each UTF-16 code unit contributes its low byte, like Buffer.from(text, 'latin1'). */
export function crc32Latin1(text: string): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < text.length; i++) c = TABLE[(c ^ (text.charCodeAt(i) & 0xFF)) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** Standard Base64 of the four little-endian bytes of `value`, via btoa (available in browsers and Node). */
export function uint32LeBase64(value: number): string {
  return btoa(String.fromCharCode(value & 0xFF, (value >>> 8) & 0xFF, (value >>> 16) & 0xFF, (value >>> 24) & 0xFF));
}
