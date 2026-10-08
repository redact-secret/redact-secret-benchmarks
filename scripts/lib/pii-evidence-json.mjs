// Policy and receipt metadata permit null; public artifact JSON intentionally does not.
const refuse = code => { throw new Error(`PII evidence JSON refusal: ${code}`); };
export function parseEvidenceJson(text) {
  if (typeof text !== 'string' || text.charCodeAt(0) === 0xfeff) refuse('invalid-json');
  let cursor = 0;
  const whitespace = () => { while (' \t\r\n'.includes(text[cursor]) && cursor < text.length) cursor++; };
  const string = () => {
    const start = cursor++;
    while (cursor < text.length && text[cursor] !== '"') { if (text[cursor] === '\\') cursor++; cursor++; }
    if (cursor >= text.length) refuse('invalid-json');
    return JSON.parse(text.slice(start, ++cursor));
  };
  const value = depth => {
    if (depth > 64) refuse('invalid-json');
    whitespace();
    const char = text[cursor];
    if (char === '"') return string();
    if (char === '{' || char === '[') {
      cursor++;
      const object = char === '{', end = object ? '}' : ']', result = object ? Object.create(null) : [];
      whitespace();
      if (text[cursor] === end) { cursor++; return result; }
      for (;;) {
        whitespace();
        if (object) {
          if (text[cursor] !== '"') refuse('invalid-json');
          const key = string(); whitespace();
          if (Object.hasOwn(result, key) || text[cursor++] !== ':') refuse('invalid-json');
          result[key] = value(depth + 1);
        } else result.push(value(depth + 1));
        whitespace();
        if (text[cursor] === end) { cursor++; return result; }
        if (text[cursor++] !== ',') refuse('invalid-json');
      }
    }
    for (const [token, parsed] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(token, cursor)) { cursor += token.length; return parsed; }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(cursor));
    if (!number || !Number.isFinite(Number(number[0]))) refuse('invalid-json');
    cursor += number[0].length; return Number(number[0]);
  };
  const parsed = value(0); whitespace();
  if (cursor !== text.length) refuse('invalid-json');
  return parsed;
}
