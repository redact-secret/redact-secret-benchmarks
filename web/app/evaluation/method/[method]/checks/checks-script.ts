/** Runs before first paint on a direct visit that names a list (`?row=&scanner=&status=`). The same rule as ChecksSync, as plain script. */
export const CHECKS_SCRIPT =
  "(function(){var p=new URLSearchParams(location.search);if(p.get('row')&&p.get('scanner')&&p.get('status'))document.documentElement.dataset.checks='1';})();";
