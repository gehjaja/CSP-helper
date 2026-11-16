// Run with Node.js and Playwright. Uses a fresh, isolated browser context per scenario.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const bank = { document: { addEventListener(){} } };
vm.createContext(bank); vm.runInContext(script, bank); bank.validateBank();
assert.equal(bank.BANK.length, 40); assert.equal(bank.CHOICE.length, 56);
assert.deepEqual(Array.from(bank.CHOICE.slice(-6), q => q.ans), [1,1,0,2,1,2]);
const legacy = JSON.parse(JSON.stringify(bank.blankDB()));
delete legacy.favorites; delete legacy.history; delete legacy.progress;
legacy.done=[1]; legacy.wrong=[1]; legacy.qstat={1:{a:1,c:0}};
legacy.daily={'2026-11-15':{answered:1,correct:0,seconds:60}};
const server = http.createServer((req,res) => {
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(req.url === '/seed' ? '<!doctype html><title>Test setup</title>' : html);
});
let browser, base, passed=0;
const errors=[];
async function check(name, fn) { await fn(); console.log('PASS',name); passed++; }
async function ready(page) { await page.waitForFunction(() => activeProfile && !profileBusy && document.getElementById('activeProfileName').textContent.includes(activeProfile.name)); }
async function setup(raw) {
  const context = await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
  const page=await context.newPage();await page.goto(base+'/seed');
  if(raw!==undefined) await page.evaluate(raw=>localStorage.setItem('csp_prep_app_v1',raw),raw);
  await page.goto(base);await ready(page);return {context,page};
}
async function go(page, view) { await page.evaluate(view=>go(view),view); }
async function open(page,id) { await page.evaluate(id=>openQuestion(id),id); }
async function read(page) { return page.evaluate(()=>({id:activeProfile.id,db:DB,progress:captureProgress(),writable:profileWritable,key:KEY})); }
async function create(page,name) { await go(page,'me');await page.fill('#profileName',name);await page.click('#btnCreateProfile');await page.waitForFunction(name=>activeProfile.name===name&&!profileBusy,name);return (await read(page)).id; }
async function select(page,id) { await go(page,'me');await page.selectOption('#profileSelect',id);await page.waitForFunction(id=>activeProfile.id===id&&!profileBusy,id); }
async function importData(page,data) {
  page.once('dialog',dialog=>dialog.accept());
  await page.setInputFiles('#fileInput',{name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
  await page.waitForFunction(()=>document.getElementById('toast').textContent==='导入成功');
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'chrome'});
  await check('legacy migration preserves original bytes and creates only one profile',async()=>{
    const raw=JSON.stringify(legacy);const {context,page}=await setup(raw);
    const first=await read(page);assert.deepEqual(first.db.done,[1]);assert.equal(first.db.daily['2026-11-15'].seconds,60);
    assert.equal(await page.evaluate(()=>localStorage.getItem(LEGACY_KEY)),raw);
    await page.reload();await ready(page);assert.equal((await read(page)).id,first.id);
    assert.equal(await page.evaluate(()=>listProfiles().length),1);await context.close();
  });
  await check('two profiles isolate answers, favorites, settings, history, statistics and checkpoints',async()=>{
    const {context,page}=await setup();const a=(await read(page)).id;
    await open(page,1);await page.click('[data-favorite="1"]');await page.click('[data-lv="mid"]');
    await open(page,'c1');await page.click('[data-opt="0"]');
    assert.equal((await read(page)).db.history.length,2);
    await page.reload();await ready(page);
    assert.equal((await read(page)).progress.choice.revealed,true);assert.equal((await read(page)).db.history.length,2);
    assert.equal(await page.locator('[data-opt="0"]').isDisabled(),true);
    const b=await create(page,'用户 B');assert.notEqual(a,b);assert.equal((await read(page)).db.history.length,0);
    await page.fill('#targetScore','300');await page.locator('#targetScore').dispatchEvent('change');
    await open(page,'c2');await page.click('[data-opt="2"]');await page.click('[data-favorite="c2"]');
    await page.evaluate(()=>practiceNew());await page.click('[data-lv="ok"]');await page.click('#btnNext');
    const bBefore=await read(page);assert.equal(bBefore.progress.practice.idx,1);
    await select(page,a);let state=await read(page);
    assert.deepEqual(state.db.wrong,[1,'c1']);assert.deepEqual(state.db.favorites,[1]);assert.equal(state.db.settings.targetScore,'');
    assert.equal(state.db.history.length,2);assert.equal(state.db.qstat.c1.c,0);
    await go(page,'practice');assert.equal((await read(page)).progress.practice.level,'mid');
    await select(page,b);state=await read(page);
    assert.deepEqual(state.db.wrong,[]);assert.deepEqual(state.db.favorites,['c2']);assert.equal(state.db.settings.targetScore,'300');
    assert.equal(state.db.history.length,2);assert.equal(state.db.qstat.c2.c,1);
    await go(page,'practice');assert.equal((await read(page)).progress.practice.idx,1);
    await page.reload();await ready(page);assert.equal((await read(page)).id,b);
    assert.equal((await read(page)).progress.practice.idx,1);assert.equal((await read(page)).progress.practice.level,'');
    await page.click('[data-lv="no"]');await page.reload();await ready(page);
    assert.equal((await read(page)).progress.practice.level,'no');assert.equal((await read(page)).db.history.length,3);
    if(process.env.QA_DIR) await page.screenshot({path:path.join(process.env.QA_DIR,'mobile-practice.png'),fullPage:true});
    await context.close();
  });
  await check('closing and reopening restores selected profile and answered question without double counting',async()=>{
    const {context,page}=await setup();await create(page,'重开测试');await open(page,'c3');await page.click('[data-opt="1"]');
    const id=(await read(page)).id;await page.close();const reopened=await context.newPage();await reopened.goto(base);await ready(reopened);
    const state=await read(reopened);assert.equal(state.id,id);assert.equal(state.progress.choice.chosen,1);assert.equal(state.progress.choice.revealed,true);assert.equal(state.db.history.length,1);
    await reopened.click('#btnCNext');assert.equal((await read(reopened)).progress.choice.idx,1);
    await reopened.reload();await ready(reopened);assert.equal(await reopened.evaluate(()=>practice.sessionStart),0);
    await context.close();
  });
  await check('elapsed study time is credited only to the outgoing profile',async()=>{
    const {context,page}=await setup();const a=(await read(page)).id;const b=await create(page,'计时用户');await select(page,a);await open(page,1);
    await page.evaluate(()=>{practice.sessionStart=Date.now()-120000;});await select(page,b);
    assert.equal(await page.evaluate(()=>totalSeconds()),0);
    const seconds=await page.evaluate(id=>Object.values(JSON.parse(localStorage.getItem(PROFILE_PREFIX+id)).data.daily).reduce((s,r)=>s+r.seconds,0),a);
    assert.ok(seconds>=120&&seconds<125);await context.close();
  });
  await check('invalid backups and failed reset cannot replace saved records',async()=>{
    const {context,page}=await setup();await open(page,1);await page.click('[data-lv="no"]');await go(page,'me');
    const raw=await page.evaluate(()=>localStorage.getItem(KEY));
    const bad=JSON.parse(JSON.stringify(legacy));bad.qstat[1].c=2;
    await page.setInputFiles('#fileInput',{name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
    await page.waitForFunction(()=>document.getElementById('toast').textContent.startsWith('导入失败'));
    assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),raw);
    await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KEY)throw Error('quota');return originalSetItem.call(this,key,value);};});
    page.once('dialog',d=>d.accept());await page.click('#btnReset');
    assert.equal((await read(page)).db.history.length,1);assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),raw);
    await page.evaluate(()=>{Storage.prototype.setItem=originalSetItem;});await context.close();
  });
  await check('imports and resets affect only the current profile; backup identity cannot redirect writes',async()=>{
    const {context,page}=await setup();const a=(await read(page)).id;await open(page,1);await page.click('[data-lv="no"]');
    await go(page,'me');const downloadPromise=page.waitForEvent('download');await page.click('#btnExport');const download=await downloadPromise;
    const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.user.id,a);assert.equal(backup.data.history.length,1);
    const b=await create(page,'导入目标');const aRaw=await page.evaluate(id=>localStorage.getItem(PROFILE_PREFIX+id),a);
    await importData(page,backup);assert.equal((await read(page)).id,b);assert.equal((await read(page)).db.history.length,1);
    assert.equal(await page.evaluate(id=>localStorage.getItem(PROFILE_PREFIX+id),a),aRaw);
    await go(page,'me');page.once('dialog',d=>d.accept());await page.click('#btnReset');
    assert.equal((await read(page)).db.history.length,0);assert.equal((await read(page)).id,b);
    assert.equal(await page.evaluate(id=>localStorage.getItem(PROFILE_PREFIX+id),a),aRaw);
    await importData(page,legacy);assert.deepEqual((await read(page)).db.done,[1]);assert.equal((await read(page)).id,b);
    await context.close();
  });
  await check('async file import is cancelled when the user switches profiles',async()=>{
    const {context,page}=await setup();const a=(await read(page)).id;const b=await create(page,'另一个用户');await select(page,a);
    await page.evaluate(()=>{window.NativeReader=FileReader;window.FileReader=class{readAsText(){window.pendingReader=this;}};});
    await page.setInputFiles('#fileInput',{name:'slow.json',mimeType:'application/json',buffer:Buffer.from('{}')});
    await select(page,b);
    await page.evaluate(data=>{pendingReader.result=JSON.stringify(data);pendingReader.onload();window.FileReader=NativeReader;},legacy);
    assert.deepEqual((await read(page)).db.done,[]);assert.match(await page.locator('#toast').textContent(),/导入已取消/);
    await context.close();
  });
  await check('same-profile second tab is read only; different profiles can work concurrently',async()=>{
    const {context,page}=await setup();const a=(await read(page)).id;await open(page,1);
    const other=await context.newPage();await other.goto(base);await ready(other);assert.equal((await read(other)).id,a);assert.equal((await read(other)).writable,false);
    await open(other,2);await other.click('[data-lv="ok"]');assert.equal((await read(other)).db.history.length,0);
    const b=await create(other,'并行用户');assert.notEqual(b,a);assert.equal((await read(other)).writable,true);
    await open(other,'c4');await other.click('[data-opt="1"]');
    await page.click('[data-lv="no"]');assert.equal((await read(page)).id,a);assert.deepEqual((await read(page)).db.done,[1]);
    assert.deepEqual((await read(other)).db.done,['c4']);
    await page.reload();await ready(page);assert.equal((await read(page)).id,a);
    await page.close();await select(other,a);assert.equal((await read(other)).writable,true);assert.deepEqual((await read(other)).db.done,[1]);
    await context.close();
  });
  await check('simultaneous first visits migrate once, retaining original legacy data',async()=>{
    const {context,page}=await setup(JSON.stringify(legacy));
    await page.goto(base+'/seed');await page.evaluate(()=>{for(const key of Object.keys(localStorage))if(key!=='csp_prep_app_v1')localStorage.removeItem(key);sessionStorage.clear();});
    const other=await context.newPage();await Promise.all([page.goto(base),other.goto(base)]);await Promise.all([ready(page),ready(other)]);
    assert.equal((await read(page)).id,(await read(other)).id);assert.equal(await page.evaluate(()=>listProfiles().length),1);
    assert.equal(await page.evaluate(()=>localStorage.getItem(LEGACY_KEY)),JSON.stringify(legacy));await context.close();
  });
  await check('damaged legacy records remain recoverable and cannot be silently overwritten',async()=>{
    const {context,page}=await setup('{broken');assert.equal(await page.evaluate(()=>storageReadFailed),true);
    const original=await page.evaluate(()=>localStorage.getItem(KEY));await open(page,1);await page.click('[data-lv="ok"]');
    assert.equal(await page.evaluate(()=>localStorage.getItem(KEY)),original);assert.equal(await page.evaluate(()=>localStorage.getItem(LEGACY_KEY)),'{broken');
    await go(page,'me');await importData(page,legacy);assert.equal(await page.evaluate(()=>storageReadFailed),false);assert.deepEqual((await read(page)).db.done,[1]);
    await context.close();
  });
  await check('quota failure blocks switching away from unsaved records and preserves other profiles',async()=>{
    const {context,page}=await setup();const a=(await read(page)).id;const b=await create(page,'空间测试');await select(page,a);
    const bRaw=await page.evaluate(id=>localStorage.getItem(PROFILE_PREFIX+id),b);
    await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===KEY)throw new DOMException('full','QuotaExceededError');return originalSetItem.call(this,key,value);};});
    await open(page,1);await page.click('[data-lv="no"]');assert.equal((await read(page)).db.history.length,1);
    await page.evaluate(id=>activateProfile(id),b);assert.equal((await read(page)).id,a);
    assert.equal(await page.evaluate(id=>localStorage.getItem(PROFILE_PREFIX+id),b),bRaw);
    await page.evaluate(()=>{Storage.prototype.setItem=originalSetItem;saveDB();});await page.reload();await ready(page);
    assert.equal((await read(page)).db.history.length,1);await context.close();
  });
  await check('all 96 questions render, score once, and appear in correct history with no page overflow',async()=>{
    const {context,page}=await setup();
    for(const q of bank.BANK){ await open(page,q.id);assert.match(await page.locator('.prob-title').textContent(),new RegExp(q.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));await page.click('[data-lv="ok"]'); }
    for(const q of bank.CHOICE){ await open(page,q.id);await page.click('[data-opt="'+q.ans+'"]');assert.match(await page.locator('#choiceBody .a-title').textContent(),/答对了/); }
    const state=await read(page);assert.equal(state.db.history.length,96);assert.equal(state.db.done.length,96);assert.equal(state.db.wrong.length,0);
    assert.equal(new Set(state.db.history.map(r=>r.id)).size,96);
    await go(page,'stats');assert.equal(await page.locator('#historyBody [data-history]').count(),20);await page.click('#historyMore');assert.equal(await page.locator('#historyBody [data-history]').count(),40);
    for(const view of ['home','bank','me','practice','choice','stats','wrong']){
      await go(page,view);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),view+' mobile overflow');
    }
    if(process.env.QA_DIR){await go(page,'me');await page.screenshot({path:path.join(process.env.QA_DIR,'mobile-profiles.png'),fullPage:true});}
    await page.setViewportSize({width:1280,height:900});await go(page,'bank');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await context.close();
  });
  assert.deepEqual(errors,[],'browser console exceptions');
  console.log('All '+passed+' browser scenario groups passed. Bank: 40 programming + 56 choice.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
