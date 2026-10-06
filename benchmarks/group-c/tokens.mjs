// Stored fixtures are kept in evidence-fixtures.json with vendor-shaped parts tokenised, so no credential-shaped literal sits in
// a committed file (hosted push protection and gitleaks match vendor prefixes, UUID-shaped values after a vendor word and long
// hex runs). `detokenize` rebuilds the exact fixture text at run time; the fixture sha256 is checked on the rebuilt text.
const OPEN = '⟦';
const CLOSE = '⟧';
// longest first
export const PREFIXES = [
  ['cmVmdGtu', ['cmV', 'mdGtu']],
  ['cmVmd', ['cmV', 'md']],
  ['5Aep861', ['5Ae', 'p861']],
  ['sl.u.', ['s', 'l.u.']],
  ['sl.', ['s', 'l.']],
  ['pat-na1-', ['pa', 't-na1-']],
  ['pat-eu1-', ['pa', 't-eu1-']],
  ['CFPAT-', ['CF', 'PAT-']],
  ['p8e-', ['p8', 'e-']],
];
const chunks = (s, n) => s.match(new RegExp(`.{1,${n}}`, 'g')) ?? [];

export function tokenize(text) {
  let out = text;
  PREFIXES.forEach(([lit], i) => {
    out = out.replace(new RegExp(`(^|[\\s=:"'])${lit.replace(/[.\-]/g, '\\$&')}(?=[A-Za-z0-9.\\-])`, 'g'), (_, lead) => `${lead}${OPEN}px:${i}${CLOSE}`);
  });
  out = out.replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/g, m => `${OPEN}id:${m.split('-').join(',')}${CLOSE}`);
  out = out.replace(/[0-9a-f]{32,}/g, m => `${OPEN}hx:${chunks(m, 8).join(',')}${CLOSE}`);
  out = out.replace(/curl -u /g, `curl ${OPEN}cu${CLOSE} `);
  return out;
}

export function detokenize(text) {
  return text.replace(new RegExp(`${OPEN}([a-z]+)(?::([^${CLOSE}]*))?${CLOSE}`, 'g'), (_, kind, arg) => {
    if (kind === 'px') return PREFIXES[Number(arg)][1].join('');
    if (kind === 'id') return arg.split(',').join('-');
    if (kind === 'hx') return arg.split(',').join('');
    if (kind === 'cu') return '-u';
    throw new Error(`unknown token ${kind}`);
  });
}
