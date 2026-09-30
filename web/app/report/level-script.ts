/** Runs before first paint on a direct visit to a level URL. The same rule as LevelSync, as plain script. */
export const LEVEL_SCRIPT =
  "(function(){var p=new URLSearchParams(location.search),l=p.get('level'),r=document.documentElement;" +
  "if(l==='T2'||l==='T3')r.dataset.level=l;if(p.get('peers')==='1')r.dataset.peers='1';})();";
