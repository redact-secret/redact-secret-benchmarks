import type { Fixture, Range } from '../types.ts';
import type { Operator } from '../engine/types.ts';
// Map every byte boundary through a text transformation. This also maps
// authored envelopes and multiple spans, without searching for secret values.
export function mapFixture(seed: Fixture, transform: (character: string, offset: number) => string, prefix = '', suffix = '') {
  let content = prefix, oldOffset = 0, newOffset = Buffer.byteLength(prefix);
  const offsets = new Map([[0, Buffer.byteLength(prefix)]]);
  for (const character of seed.content) {
    const transformed = transform(character, oldOffset);
    content += transformed;
    newOffset += Buffer.byteLength(transformed);
    oldOffset += Buffer.byteLength(character);
    offsets.set(oldOffset, newOffset);
  }
  const mapRange = <T extends Range>(r: T): T => ({ ...r, start: offsets.get(r.start)!, end: offsets.get(r.end)! });
  return { ...seed, content: content + suffix, expected: seed.expected.map(r => ({
    ...mapRange(r), ...(r.envelope ? { envelope: mapRange(r.envelope) } : {}),
  })) };
}

const context = (id: string, supports: Operator['supports'], apply: (fixture: Fixture) => Fixture): Operator => ({ id, version: 1,
  supports: (c, parameters = {}) => !Object.keys(parameters).length && supports(c),
  generate: c => ({ fixture: apply(c.seed), strategy: 'derived', property: 'context', relation: 'same-detection' }) });

export const contextOperators = [
  context('context.unicode-prefix', () => true, f => mapFixture(f, c => c, '# 🔑 密钥 café\n')),
  context('context.indent', () => true, f => mapFixture(f, c => c, '    ')),
  context('encoding.crlf', c => /(^|[^\r])\n/.test(c.seed.content), f => {
    const input = Buffer.from(f.content);
    return mapFixture(f, (c, offset) => c === '\n' && input[offset - 1] !== 13 ? '\r\n' : c);
  }),
  // Wrap a single-line fixture as a JSON string. Reject values that require
  // escaping: they would change secret bytes and need a different relation.
  context('context.json', c => !/["\\\x00-\x1f]/.test(c.seed.content),
    f => mapFixture(f, c => c, '{"value":"', '"}')),
  context('context.quote', c => !/["\\\x00-\x1f]/.test(c.seed.content), f => mapFixture(f, c => c, '"', '"')),
  context('context.single-quote', c => !/['\\\x00-\x1f]/.test(c.seed.content), f => mapFixture(f, c => c, "'", "'")),
  context('context.yaml', c => !/['\x00-\x1f]/.test(c.seed.content), f => mapFixture(f, c => c, "value: '", "'\n")),
  context('context.markdown', c => !/[`\r\n]/.test(c.seed.content), f => mapFixture(f, c => c, '`', '`')),
];
