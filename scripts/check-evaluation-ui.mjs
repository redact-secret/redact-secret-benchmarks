/** Optional browser QA: install Playwright outside the repo or provide PLAYWRIGHT_MODULE. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.UI_BASE_URL ?? 'http://localhost:4173';
const evidence = JSON.parse(await readFile('public/results/evaluation-v1.json','utf8'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const output = 'results-output/ui-verification';
await mkdir(output,{recursive:true});
const context = await browser.newContext({ viewport:{width:1440,height:1000} });
const page = await context.newPage(), errors = [], routes = [];
page.on('pageerror', e => errors.push(e.message));
const ready = async () => {
  await page.locator('.content h1').waitFor();
  assert.ok(!/missing or unreadable|invalid evaluation|Unable to load/.test(await page.locator('.content').innerText()));
};
try {
  for (const route of ['/evaluation','/evaluation/failures','/evaluation/reviews','/evaluation/operators',...['twin','benign','metamorphic','mutation','differential','holdout'].map(m=>`/evaluation/method/${m}`),'/evaluation/detector/github-token']) {
    await page.goto(origin+route); await ready();
    await page.reload(); await ready();
    routes.push({route, heading:await page.locator('.content h1').innerText()});
    if (route === '/evaluation') {
      const all = evidence.cases.flatMap(c=>c.assertions.map(a=>({...a,caseId:c.id})));
      const failures=all.filter(a=>a.status==='fail');
      const cards = await page.locator('.eval-metrics').first().innerText();
      assert.ok(cards.includes(`${new Set(failures.map(a=>a.caseId)).size}\nAffected failing cases`));
      assert.ok(cards.includes(`${failures.length}\nFailed assertions`));
      await page.screenshot({path:`${output}/desktop-dashboard.png`,fullPage:true});
    }
    if (route === '/evaluation/method/holdout') assert.equal(await page.locator('.content a[href^="/fixture/"]').count(),0);
  }
  await page.goto(origin+'/evaluation/failures'); await ready();
  await page.locator('[data-eval-filter="method"]').selectOption('twin');
  await page.locator('[data-eval-filter="scanner"]').selectOption('redact-secret');
  assert.ok((await page.locator('#evaluation-rows').innerText()).includes('Overlaps absolute failure'));
  assert.equal(await page.locator('#evaluation-rows .eval-review-required').count(),0);
  await page.screenshot({path:`${output}/desktop-failures.png`,fullPage:true});
  await page.goto(origin+'/evaluation/reviews'); await ready();
  await page.locator('[data-eval-filter="method"]').selectOption('mutation');
  assert.equal(await page.locator('#evaluation-rows .eval-fail').count(),0);
  assert.ok(await page.locator('#evaluation-rows .eval-review-required').count()>0);
  await page.locator('#evaluation-next').click();
  assert.match(await page.locator('#evaluation-page').innerText(), /Page 2/);
  await page.waitForTimeout(5500);
  assert.equal(await page.locator('[data-eval-filter="method"]').inputValue(),'mutation');
  assert.match(await page.locator('#evaluation-page').innerText(), /Page 2/);
  await page.screenshot({path:`${output}/desktop-reviews.png`,fullPage:true});
  for (const route of ['/evaluation','/evaluation/reviews','/evaluation/method/mutation']) {
    await page.setViewportSize({width:390,height:844});
    await page.goto(origin+route); await ready();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1), `page overflow: ${route}`);
    await page.locator('.content h1').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${output}/mobile-${route.split('/').at(-1)}.png`,fullPage:true});
  }
  const mock = async (body,status=200) => {
    await page.route('**/results/evaluation-v1.json',route=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)}));
    await page.goto(origin+'/evaluation'); await page.locator('.content h1').waitFor();
  };
  await mock({},404);
  assert.match(await page.locator('.content').innerText(),/missing or unreadable/);
  await page.screenshot({path:`${output}/mobile-empty.png`,fullPage:true});
  await page.unroute('**/results/evaluation-v1.json');
  const stale=structuredClone(evidence); Object.keys(stale.corpusHashes).forEach(k=>stale.corpusHashes[k]='stale');
  await mock(stale); assert.match(await page.locator('.content').innerText(),/Stale evaluation/);
  await page.unroute('**/results/evaluation-v1.json');
  const malformed=structuredClone(evidence); malformed.cases[0].content='PRIVATE_SENTINEL';
  await mock(malformed); assert.match(await page.locator('.content').innerText(),/Invalid public evaluation contract/);
  await page.unroute('**/results/evaluation-v1.json');
  await page.goto(origin+'/benchmark/github-token'); await page.locator('a[href="/evaluation/detector/github-token"]').click(); await ready();
  assert.match(page.url(),/evaluation\/detector\/github-token/);
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/checks.json`,JSON.stringify({routes,errors,viewports:[1440,390],checks:['direct navigation and reload','case/assertion counts','filters','pagination and polling state','review != failure','holdout no fixture links','missing/stale/malformed data','detector bidirectional navigation','no page overflow']},null,2));
  console.log(`Browser QA passed: ${routes.length} routes, desktop and mobile, filters, empty states. Screenshots: ${output}`);
} finally { await browser.close(); }
