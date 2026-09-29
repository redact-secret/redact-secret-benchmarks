// DIAGNOSTIC ONLY: new/old ratio of medians with a 95% percentile-bootstrap interval (10,000 resamples, seeded).
import { readFileSync } from 'node:fs';
const med = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (a, b) => { const r = []; for (let i = 0; i < 10000; i++) { const x = a.map(() => a[Math.floor(rnd() * a.length)]), y = b.map(() => b[Math.floor(rnd() * b.length)]); r.push(med(x) / med(y)); } r.sort((p, q) => p - q); return [r[249], r[9749]]; };
for (const file of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(file)); console.log(`# ${file}: ${d.cpu}, ${d.rounds} rounds`);
  const keys = [...new Set(d.samples.map(s => `${s.profile}|${s.variant}`))];
  for (const k of keys) for (const m of ['initializeMs', 'instantiateMs', 'initCallMs', 'wholeMs', 'incrementalMs']) {
    const [p, v] = k.split('|'); if (m !== 'incrementalMs' && m !== 'wholeMs' && v !== 'official') continue; if (m === 'wholeMs' && !v.startsWith('official')) continue;
    const g = ver => d.samples.filter(s => s.profile === p && s.variant === v && s.version === ver).map(s => s[m]).filter(Number.isFinite);
    const o = g('old'), n = g('new'); if (!o.length) continue; const [lo, hi] = boot(n, o);
    console.log([p, v, m, med(o).toFixed(2), med(n).toFixed(2), (med(n) / med(o)).toFixed(3), `[${lo.toFixed(3)}, ${hi.toFixed(3)}]`, `n=${o.length}/${n.length}`].join('\t'));
  }
}
