/**
 * Runs before first paint on a direct visit to `?analysis=&domain=&view=`. The same
 * rule as RuntimeSync (resolvers/comparison.ts `analysisOf`, `domainOf`, `viewOf`), as plain script.
 * It always sets all three, defaults included, so the CSS picks exactly one panel.
 */
export const RUNTIME_SCRIPT =
  "(function(){var p=new URLSearchParams(location.search),r=document.documentElement,a=p.get('analysis'),d=p.get('domain'),v=p.get('view');" +
  "r.dataset.analysis=a==='internal'?'internal':'external';r.dataset.domain=d==='credentials'?'credentials':'pii';" +
  "r.dataset.view=v==='speed'||v==='accuracy'?v:'all';})();";
