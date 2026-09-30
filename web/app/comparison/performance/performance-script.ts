/**
 * Runs before first paint on a direct visit to `?with=&setting=`. The same rule as PerformanceSync
 * (resolvers/performance.ts `peerOf`, `settingOf`), as plain script. It always sets both, defaults
 * included, so the CSS picks exactly one panel.
 */
export const PERFORMANCE_SCRIPT =
  "(function(){var p=new URLSearchParams(location.search),r=document.documentElement,w=p.get('with'),s=p.get('setting');" +
  "r.dataset.peer=w==='openredaction'?'openredaction':'flare-redact';" +
  "r.dataset.setting=s==='default'||s==='pii-global'?s:'pii-global-us';})();";
