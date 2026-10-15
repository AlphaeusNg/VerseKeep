import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { openMedMore, openTopicTools, openTopics } from './disclose.mjs';
test.use({ serviceWorkers: 'block' });
for (const setting of [{width:320},{width:375},{width:768},{width:1280},{width:375,text:2},{width:768,zoom:2}]) {
 test(`sizing ${JSON.stringify(setting)}`, async ({page})=>{
  test.setTimeout(45000);
  await page.setViewportSize({width:setting.width,height:900});
  await page.route('**/*', async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='127.0.0.1') return route.continue();
   const type=route.request().resourceType();
   return route.fulfill({status:200,contentType:type==='document'?'text/html':type==='script'?'application/javascript':'application/json',body:type==='document'?'<title>Fixture</title>':type==='script'?'':'{}'});
  });
  await page.goto('/?v=Psalm%2056%3A3');
  await expect(page.locator('.med-ref')).toHaveText('Psalm 56:3');
  if(setting.text) await page.evaluate(()=>{
    const elements=[...document.querySelectorAll('*')].map(el=>[el,getComputedStyle(el).fontSize]);
    for(const [el,size] of elements) el.style.fontSize=`${parseFloat(size)*2}px`;
  });
  if(setting.zoom) await page.evaluate(()=>document.documentElement.style.zoom='2');
  const snapshots=[];
  const measure=async flow=> snapshots.push(await page.evaluate(flow=>{
    const visible=el=>el.checkVisibility({checkVisibilityCSS:true}) && !el.closest('[hidden]') && ![...document.querySelectorAll('details:not([open])')].some(d=>d.contains(el)&&!d.querySelector('summary').contains(el));
    const name=el=>el.id || el.className || el.tagName;
    const nodes=[...document.querySelectorAll('button,a,input,select,summary,textarea')].filter(visible);
    return {flow,scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth,
      small:nodes.filter(el=>{const r=el.getBoundingClientRect();return r.width<24||r.height<24}).map(el=>({name:name(el),w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height})).filter((el,i,a)=>a.findIndex(other=>other.name===el.name)===i),
      clipped:nodes.filter(el=>el.scrollWidth>el.clientWidth+2&&el.clientWidth>0).map(el=>({name:name(el),w:el.clientWidth,sw:el.scrollWidth})),
      overflow:[...document.querySelectorAll('main *')].filter(visible).filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+2||r.left< -2}).slice(0,12).map(name)};
  },flow));
  await measure('meditation');
  await page.locator('#med-more').click(); await page.locator('#med-save').click();
  await page.locator('#med-saved summary').click(); await measure('more-saved');
  await page.locator('#meditate').screenshot({path:`/tmp/versekeep-sizing-${setting.width}-${setting.text?'text':setting.zoom?'zoom':'normal'}-med.png`});
  await openMedMore(page); await page.locator('#med-focus').click(); await measure('focus'); await page.locator('#med-focus').click();
  await openTopics(page);
  await page.locator('#theme-grid [data-drill]').first().click();
  for (const mode of ['study','blank','type','order','quiz']) {await page.locator(`#play-panel [data-mode="${mode}"]`).click(); await measure(mode);}
  await page.locator('#play-panel').screenshot({path:`/tmp/versekeep-sizing-${setting.width}-${setting.text?'text':setting.zoom?'zoom':'normal'}-practice.png`});
  await openTopicTools(page);
  await page.locator('#btn-review-due').click();await measure('review');
  const backup=await page.evaluate(()=>window.VerseKeepSession.exportSnapshot({}).snapshot);
  page.once('dialog',d=>d.dismiss());
  await page.locator('#device-import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await measure('import-cancel');
  await page.locator('#wp-details > summary').click(); await measure('wallpapers');
  for(const format of ['phone','desktop']) {await page.locator(`[data-wp-format="${format}"]`).click(); await measure('wallpapers-'+format);}
  await page.locator('#wp-search').fill('dawn'); await expect(page.locator('#wp-search-meta')).toContainText(/1|match/); await measure('wallpaper-filter'); await page.locator('#wp-search-clear').click();
  const card=page.locator('.wp-card[data-wp-id="dawn-hills"]');
  await card.locator('[data-apply]').click();
  await page.locator('#wallpapers').screenshot({path:`/tmp/versekeep-sizing-${setting.width}-${setting.text?'text':setting.zoom?'zoom':'normal'}-wallpapers.png`});
  const download=page.waitForEvent('download'); await card.locator('.wp-dl-mini').click(); await download;
  await card.locator('.wp-view-mini').click(); await expect(page.locator('body')).toHaveClass(/is-background-view/); await measure('background-preview'); await page.locator('#background-view-exit').click(); await page.waitForTimeout(750);
  await page.locator('#music-dock-tab').click(); await measure('music-open');
  await page.screenshot({path:`/tmp/versekeep-sizing-${setting.width}-${setting.text?'text':setting.zoom?'zoom':'normal'}-music.png`});
  await page.locator('#music-dock-close').click(); await measure('music-closed');
  writeFileSync(`/tmp/versekeep-sizing-${setting.width}-${setting.text?'text':setting.zoom?'zoom':'normal'}.json`,JSON.stringify({setting,snapshots},null,2));
  for(const snapshot of snapshots) {
    expect(snapshot.scroll, `${snapshot.flow}: horizontal page overflow`).toBeLessThanOrEqual(snapshot.width+1);
    expect(snapshot.clipped.filter(el=>!['wp-summary','wp-search','theme-search'].includes(el.name)), `${snapshot.flow}: clipped control labels`).toEqual([]);
    expect(snapshot.small.filter(el=>/theme-drill|wp-view|wp-dl|wp-heart|wp-grid|nav-music/.test(el.name)), `${snapshot.flow}: undersized adjacent controls`).toEqual([]);
  }
  const containment=await page.locator('.wp-card').evaluateAll(cards=>cards.filter(card=>card.checkVisibility()).flatMap(card=>{
   const r=card.getBoundingClientRect(); return [...card.querySelectorAll('.wp-side-actions button')].filter(el=>{const b=el.getBoundingClientRect();return b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1}).map(el=>el.className);
  }));
  expect(containment,'wallpaper actions stay inside their cards').toEqual([]);
  const titles=await page.locator('.theme-card strong').evaluateAll(titles=>titles.filter(el=>el.checkVisibility()).filter(el=>el.getBoundingClientRect().bottom>el.closest('.theme-card').getBoundingClientRect().bottom+1).map(el=>el.textContent));
  expect(titles,'topic titles remain inside their cards').toEqual([]);
 });
}

for (const width of [390, 320]) {
 test(`practice mode row scrolls at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/?v=Psalm%2056%3A3');
  await openMedMore(page);
  await page.locator('#med-practice-verse').click();
  const row = page.locator('#play-panel .mode-row');
  const chips = row.locator('[data-mode]');
  const centers = await chips.evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return rect.top + rect.height / 2;
  }));
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1);
  const geometry = await row.evaluate(node => ({ scroll: node.scrollWidth, client: node.clientWidth }));
  if (width === 320) expect(geometry.scroll).toBeGreaterThan(geometry.client);
  else expect(geometry.scroll).toBeGreaterThanOrEqual(geometry.client);
  await expect(row).toHaveClass(/is-scrollable/);
  expect(await chips.evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth + 2))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  const last = row.getByRole('button', { name: 'Which verse?', exact: true });
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await expect(last).toHaveAttribute('aria-pressed', 'true');
  await expect(row).toHaveClass(/at-end/);
  await expect(page.locator('#quiz-choices')).toBeVisible();
 });
}
