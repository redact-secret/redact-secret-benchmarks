/** Runs before first paint on a direct visit to `?fixture=<id>`. The same rule as FixtureSync, as plain script. */
export const FIXTURE_SCRIPT =
  "(function(){var f=new URLSearchParams(location.search).get('fixture');if(f)document.documentElement.dataset.fixture='1';})();";
