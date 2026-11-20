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
assert.equal(bank.BANK.length, 71); assert.equal(bank.CHOICE.length, 56);
assert.deepEqual(Array.from(bank.CHOICE.slice(-6), q => q.ans), [1,1,0,2,1,2]);
const legacy = JSON.parse(JSON.stringify(bank.blankDB()));
delete legacy.favorites; delete legacy.history; delete legacy.progress;
legacy.done=[1]; legacy.wrong=[1]; legacy.qstat={1:{a:1,c:0}};
legacy.daily={'2026-11-15':{answered:1,correct:0,seconds:60}};
const server = http.createServer((req,res) => {
  // Mirror the pinned browser runtime locally so CI can exercise real Python offline.
  const runtimeFiles=['pyodide.js','pyodide.asm.js','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json'];
  if(runtimeFiles.some(name=>req.url==='/runtime/'+name)){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Content-Type',req.url.endsWith('.wasm')?'application/wasm':req.url.endsWith('.js')?'text/javascript':'application/octet-stream');
    res.end(fs.readFileSync(path.join(path.dirname(require.resolve('pyodide/package.json')),path.basename(req.url))));
    return;
  }
  if(req.url==='/sample-frame.html' && !process.env.CSP_LIVE_RUNTIME){
    const frame=fs.readFileSync(path.join(root,'sample-frame.html'),'utf8');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end(frame.replaceAll('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/',base+'/runtime/').replaceAll('https://cdn.jsdelivr.net',base));
    return;
  }
  if(req.url==='/index.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
  const assets=['sw.js','icon-192.png','icon-512.png','manifest.webmanifest','python-refs.js','paper.js','review.js','runner.js','sample-frame.html'];
  if(assets.includes(req.url.slice(1))){res.setHeader('Content-Type',req.url.endsWith('.js')?'application/javascript':req.url.endsWith('.png')?'image/png':req.url.endsWith('.webmanifest')?'application/manifest+json':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,req.url.slice(1))));return;}
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
  await check('Android home opens install instructions and consumes each browser prompt once',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36'});
    const page=await context.newPage();
    // Exercise both browser paths independently of the host Chrome install policy.
    await page.addInitScript(()=>window.addEventListener('beforeinstallprompt',event=>{
      if(event.isTrusted){event.preventDefault();event.stopImmediatePropagation();}
    },true));
    await page.goto(base);await ready(page);
    const home=page.locator('#installFromHome');
    assert.ok(await home.isVisible());
    await home.click();
    assert.ok(await page.locator('#androidSteps ol').isVisible());
    assert.equal(await page.locator('#installNative').isVisible(),false);
    for(const outcome of ['dismissed','accepted']){
      await go(page,'home');
      await page.evaluate(outcome=>{
        const event=new Event('beforeinstallprompt',{cancelable:true});
        event.prompt=async()=>{window.promptCalls=(window.promptCalls||0)+1;};
        event.userChoice=Promise.resolve({outcome});
        window.dispatchEvent(event);
      },outcome);
      await home.click();
      assert.match(await page.textContent('#installStatus'),outcome==='dismissed'?/已取消/:/已确认/);
      assert.equal(await page.locator('#installNative').isVisible(),false);
    }
    assert.equal(await page.evaluate(()=>window.promptCalls),2);
    await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
    assert.match(await page.textContent('#installStatus'),/已安装/);
    await go(page,'home');assert.equal(await home.isVisible(),false);
    await context.close();
  });
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
  await check('all 127 questions render, score once, and appear in correct history with no page overflow',async()=>{
    const {context,page}=await setup();
    for(const q of bank.BANK){ await open(page,q.id);assert.match(await page.locator('.prob-title').textContent(),new RegExp(q.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));await page.click('[data-lv="ok"]'); }
    for(const q of bank.CHOICE){ await open(page,q.id);await page.click('[data-opt="'+q.ans+'"]');assert.match(await page.locator('#choiceBody .a-title').textContent(),/答对了/); }
    const state=await read(page);assert.equal(state.db.history.length,127);assert.equal(state.db.done.length,127);assert.equal(state.db.wrong.length,0);
    assert.equal(new Set(state.db.history.map(r=>r.id)).size,127);
    await go(page,'stats');assert.equal(await page.locator('#historyBody [data-history]').count(),20);await page.click('#historyLast');assert.equal(await page.locator('#historyBody [data-history]').count(),7);
    for(const view of ['home','bank','me','practice','choice','stats','wrong']){
      await go(page,view);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),view+' mobile overflow');
    }
    if(process.env.QA_DIR){await go(page,'me');await page.screenshot({path:path.join(process.env.QA_DIR,'mobile-profiles.png'),fullPage:true});}
    await page.setViewportSize({width:1280,height:900});await go(page,'bank');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await context.close();
  });
  await check('Python executes published examples and reports wrong output independently of self review and OJ records',async()=>{
    const {page,context}=await setup();
    await open(page,41);await page.selectOption('#studyLanguage','python');
    const report=page.locator('#sampleRunnerMount pre');
    async function run(code){
      await page.fill('#studyCode',code);await page.getByRole('button',{name:'运行 Python 样例'}).click();
      await page.waitForFunction(()=>/公开样例通过|运行失败|超时/.test(document.querySelector('#sampleRunnerMount pre').textContent),{},{timeout:95000});
      return report.textContent();
    }
    assert.match(await run('print(0)'),/公开样例通过 0 \/ 2/);
    assert.match(await run('import sys\nn,*h=map(int,sys.stdin.buffer.read().split())\nprint(max(min(h[i:j])*(j-i) for i in range(n) for j in range(i+1,n+1)))'),/公开样例通过 2 \/ 2/);
    await page.click('[data-lv="ok"]');await go(page,'home');assert.equal(await page.textContent('#kAcc'),'0');
    await open(page,41);await page.selectOption('#ojVerdict','accepted');await page.fill('#ojReceipt','run-42');
    await page.fill('#programNotes','注意等高柱');await page.selectOption('#studyLanguage','cpp');await page.fill('#studyCode','// C++ draft');
    await page.reload();await ready(page);assert.equal(await page.inputValue('#ojReceipt'),'run-42');
    assert.equal(await page.inputValue('#studyCode'),'// C++ draft');await page.selectOption('#studyLanguage','python');
    assert.match(await page.inputValue('#studyCode'),/min\(h/);await go(page,'home');assert.equal(await page.textContent('#kAcc'),'1');
    const a=(await read(page)).id;await create(page,'独立草稿');await open(page,41);
    assert.equal(await page.inputValue('#programNotes'),'');assert.equal(await page.inputValue('#ojVerdict'),'none');
    await select(page,a);await open(page,41);assert.equal(await page.inputValue('#programNotes'),'注意等高柱');
    await context.close();
  });
  await check('mixed wrong queue resumes the answered step after reload and counts repeated misses',async()=>{
    const {page,context}=await setup();
    for(let i=0;i<2;i++){await open(page,1);await page.click('[data-lv="no"]');}
    await open(page,'c1');await page.click('[data-opt="0"]');await go(page,'wrong');
    assert.match(await page.textContent('#wrongBody'),/自评未做出 2 次/);
    await page.click('#startWrong');await page.click('[data-lv="ok"]');await page.reload();await ready(page);
    await go(page,'wrong');await page.click('#startWrong');await page.click('#btnNext');await page.click('[data-opt="'+bank.CHOICE[0].ans+'"]');await page.click('#btnCNext');
    const {db}=await read(page);assert.equal(db.reviewQueue,null);assert.equal(db.wrong.length,0);assert.equal(db.history.length,5);
    await go(page,'stats');assert.match(await page.textContent('#totalStats'),/首次作答（有明细）0 \/ 1/);
    assert.match(await page.textContent('#totalStats'),/重复作答（有明细）1 \/ 1/);
    await context.close();
  });
  await check('daily resume survives reload, cancelled navigation and midnight, then completes exactly once',async()=>{
    const {page,context}=await setup();
    await page.click('#startDaily');await page.click('[data-lv="ok"]');await page.click('#btnNext');
    const original=(await read(page)).db.reviewQueue;
    await go(page,'home');await page.reload();await ready(page);
    assert.equal(await page.isVisible('#resumeOtherReview'),false);
    assert.match(await page.textContent('#startDaily'),/继续今日复习/);
    assert.match(await page.textContent('#dailyStatus'),/第 2 \/ 3 题/);
    assert.match(await page.textContent('#todayReview'),/已作答/);
    for(const selector of ['#startPractice','#replaceDaily']){
      page.once('dialog',d=>d.dismiss());await page.click(selector);
      assert.deepEqual((await read(page)).db.reviewQueue,original);
    }
    await page.evaluate(()=>{const day=dkey(shiftDay(new Date(),-1));DB.dailyPlan.day=DB.reviewQueue.day=day;saveDB();});
    await page.reload();await ready(page);assert.match(await page.textContent('#dailyStatus'),/跨天/);
    await page.click('#startDaily');assert.equal(await page.textContent('.prob-title'),bank.BANK.find(q=>q.id===original.ids[1]).title);
    assert.match(await page.textContent('#practiceBody'),/后面还有 1 题/);
    await page.click('#skipPractice');await page.click('[data-lv="mid"]');await page.click('#btnNext');
    let state=await read(page);assert.equal(state.db.history.length,2);assert.equal(state.db.reviewQueue,null);
    assert.equal(state.db.dailyPlan.day,original.day);assert.deepEqual(state.db.dailyPlan.steps,{});
    await page.click('#startDaily');await page.click('#skipPractice');await go(page,'home');
    page.once('dialog',d=>d.accept());await page.click('#startPractice');
    assert.equal((await read(page)).db.reviewQueue,null);await go(page,'home');
    assert.match(await page.textContent('#todayReview'),/已跳过/);
    await page.click('#startDaily');assert.equal((await read(page)).db.reviewQueue.pos,1);
    await page.click('#skipPractice');await page.click('#skipPractice');
    assert.equal(await page.isDisabled('#startDaily'),true);
    const previous=(await read(page)).db.dailyPlan.ids;
    await page.click('#replaceDaily');state=await read(page);
    assert.equal(new Set(state.db.dailyPlan.ids).size,3);assert.ok(state.db.dailyPlan.ids.every(id=>!previous.includes(id)));
    await context.close();
  });
  await check('daily replacements rotate across reload, profiles and pool exhaustion',async()=>{
    const {page,context}=await setup(), firstProfile=(await read(page)).id;
    const initial=(await read(page)).db.dailyPlan.ids;
    const seen=new Set(initial);
    let previous=initial;
    for(let batch=1;batch<=44;batch++){
      if(batch===4){await page.reload();await ready(page);}
      if(batch===8){
        await create(page,'独立轮换');await go(page,'home');
        assert.deepEqual((await read(page)).db.dailyPlan.ids,initial);
        await select(page,firstProfile);await go(page,'home');
      }
      await page.click('#replaceDaily');
      const ids=(await read(page)).db.dailyPlan.ids;
      assert.equal(new Set(ids).size,3);
      assert.ok(ids.every(id=>!previous.includes(id)));
      assert.equal(ids.filter(id=>!seen.has(id)).length,Math.min(3,127-seen.size));
      ids.forEach(id=>seen.add(id));previous=ids;
    }
    assert.equal(seen.size,127);
    await page.evaluate(()=>{DB.dailyPlan.day=dkey(shiftDay(new Date(),-1));go('home');});
    assert.deepEqual((await read(page)).db.dailyPlan.ids,initial);
    await context.close();
  });
  await check('daily mistakes cool down across dates, legacy totals qualify for spaced review',async()=>{
    const {page,context}=await setup();
    const results=await page.evaluate(()=>{
      DB.qstat.c2={a:2,c:1};DB.done=BANK.map(q=>q.id);DB.wrong=[1];
      const dates=[0,1,2,3].map(n=>dkey(shiftDay(new Date(),n)));
      const original=today,groups=[];
      try{
        for(const day of dates){
          today=()=>day;
          DB.dailyPlan=null;renderDailyReview();groups.push(DB.dailyPlan.ids);
        }
      }finally{today=original;}
      return {groups,due:dueChoices()};
    });
    assert.ok(results.due.includes('c2'));
    assert.deepEqual(results.groups.map(ids=>ids.includes(1)),[true,false,false,true]);
    assert.ok(results.groups.every(ids=>new Set(ids).size===3));
    await context.close();
  });
  await check('mock clock, backup reminder, rename and delete are profile-scoped',async()=>{
    const {page,context}=await setup();const a=(await read(page)).id;
    await page.click('#paperAction');
    assert.equal(await page.locator('[data-paper-question]:disabled').count(),5);
    assert.equal(await page.locator('#paperPanel a').count(),5);
    await page.fill('[data-score="2"]','70');await page.locator('[data-score="2"]').dispatchEvent('change');
    await page.reload();await ready(page);assert.equal(await page.inputValue('[data-score="2"]'),'70');assert.match(await page.textContent('#paperClock'),/剩余/);
    await page.evaluate(()=>{DB.paper.start-=4*3600000;DB.lastExportDay=dkey(shiftDay(new Date(),-45));go('home');});
    assert.equal(await page.locator('[data-paper-question]:disabled').count(),0);
    assert.match(await page.textContent('#paperClock'),/模拟结束/);assert.match(await page.textContent('#backupStatus'),/45 天/);
    const b=await create(page,'临时档案');await go(page,'home');assert.equal(await page.locator('[data-score]').count(),0);
    assert.match(await page.textContent('#backupStatus'),/尚无导出/);await go(page,'me');await page.fill('#renameInput','改名测试');await page.click('#renameProfile');
    await page.reload();await ready(page);assert.match(await page.textContent('#activeProfileName'),/改名测试/);
    page.once('dialog',d=>d.accept());await page.click('#deleteProfile');await page.waitForFunction(id=>activeProfile.id===id&&!profileBusy,a);
    assert.equal(await page.evaluate(id=>localStorage.getItem(PROFILE_PREFIX+id),b),null);await go(page,'home');assert.match(await page.textContent('#paperTotal'),/70 分/);
    await context.close();
  });
  await check('idle time stops at two minutes and daily recommendations pick overdue mistakes',async()=>{
    const {page,context}=await setup();await open(page,42);
    const seconds=await page.evaluate(()=>{
      practice.sessionStart=lastStudyActivity=Date.now()-5*60000;
      flushSession();resumeStudyTimer();
      return [DB.work[42].seconds,practice.sessionStart];
    });
    assert.deepEqual(seconds,[120,0]);
    await open(page,'c1');await page.click('[data-opt="0"]');await open(page,'c2');await page.click('[data-opt="'+bank.CHOICE[1].ans+'"]');
    await page.evaluate(()=>{
      const yesterday=shiftDay(new Date(),-1).toISOString();
      DB.history.forEach(r=>r.at=yesterday);DB.dailyPlan=null;go('home');
    });
    assert.equal((await read(page)).db.dailyPlan.ids[0],'c1');
    await go(page,'choice');assert.match(await page.textContent('#choiceReviewInfo'),/到期 1 题/);
    await page.click('#startSpaced');assert.equal((await read(page)).db.reviewQueue.ids[0],'c1');
    await page.click('[data-opt="'+bank.CHOICE[0].ans+'"]');await page.click('#btnCNext');await go(page,'choice');
    assert.equal(await page.isDisabled('#startSpaced'),true);await context.close();
  });
  await check('mobile practice restores the ordinary group after a single question and revises one event',async()=>{
    const {page,context}=await setup();
    await page.click('#startPractice');
    await page.click('#skipPractice');
    const before=(await read(page)).progress.practice;
    assert.equal(before.idx,1);assert.equal((await read(page)).db.history.length,0);
    await go(page,'bank');await page.selectOption('#bankType','t3');
    assert.equal(await page.locator('#bankResults [data-question]').count(),20);
    await page.selectOption('#bankType','all');await page.locator('[data-question="1"]').click();
    await page.click('[data-lv="no"]');await page.reload();await ready(page);
    await page.getByLabel('修改本次自评').selectOption('ok');
    let state=await read(page);assert.equal(state.db.history.length,1);
    assert.deepEqual(state.db.qstat[1],{a:1,c:1});assert.deepEqual(state.db.wrong,[]);
    await page.getByLabel('参考语言').selectOption('Python');assert.match(await page.textContent('.code-block'),/skips/);
    await page.click('#btnNext');await page.click('#btnAgain');
    assert.equal((await read(page)).progress.practice.ids.length,1);
    await go(page,'home');await page.click('#startPractice');
    state=await read(page);assert.deepEqual(state.progress.practice.ids,before.ids);assert.equal(state.progress.practice.idx,1);
    await page.evaluate(()=>{practice.sessionStart=Date.now()-10000;go('home');});assert.equal(await page.textContent('#kMin + small'),'秒');
    for(const width of [320,768]){
      await page.setViewportSize({width,height:844});await go(page,'practice');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await context.close();
  });
  await check('offline relaunch restores the same profile, question, and Python reference',async()=>{
    const {page,context}=await setup();await open(page,42);await page.click('[data-lv="mid"]');
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    await context.setOffline(true);await page.reload();await ready(page);
    assert.equal((await read(page)).progress.practice.level,'mid');
    await page.getByLabel('参考语言').selectOption('Python');assert.match(await page.textContent('.code-block'),/def visit/);
    await page.fill('#programNotes','offline');await page.reload();await ready(page);
    assert.equal(await page.inputValue('#programNotes'),'offline');await context.close();
  });
  await check('daily mix after finishing all basic problems, position labels and local mock navigation',async()=>{
    const {context,page}=await setup();
    await page.evaluate(()=>{
      DB.done=BANK.filter(q=>questionSlot(q)<=2).map(q=>q.id);
      DB.wrong=[]; DB.dailyPlan=null; go('home');
    });
    const slots=()=>page.evaluate(()=>DB.dailyPlan.ids.map(id=>questionSlot(byId(id))));
    const mix=await slots();
    assert.equal(mix.filter(n=>n<=2).length,2);assert.ok(mix.includes(3));
    await page.reload();await ready(page);assert.deepEqual(await slots(),mix);
    await page.evaluate(()=>{DB.dailyPlan=null;DB.wrong=[42,51];go('home');});
    assert.equal((await slots()).filter(n=>n>=3).length,1);
    assert.equal(await page.locator('#todayReview .slot-badge').count(),3);
    assert.equal(await page.locator('[data-paper-question]').count(),5);
    await page.click('[data-paper-question="51"]');
    assert.match(await page.textContent('#practiceBody .slot-badge'),/T3.*2024/);
    await go(page,'wrong');assert.match(await page.textContent('#wrongBody'),/T5/);
    await go(page,'bank');await page.selectOption('#bankType','t3');await page.selectOption('#bankOrder','slot');
    assert.match(await page.textContent('#bankType option[value=t4]'),/T4（6 道）/);
    assert.match(await page.textContent('#bankResults'),/早期题（2014）/);
    assert.equal(await page.locator('#bankResults [data-question]').first().getAttribute('data-question'),'53');
    for(const [slot, titles] of [['t4',['十滴水','通讯延迟']], ['t5',['文件夹合并','最佳文章']]]){
      await page.selectOption('#bankType',slot);
      assert.equal(await page.locator('#bankResults [data-question]').count(),6);
      for(const title of titles) assert.ok((await page.textContent('#bankResults')).includes(title));
    }
    await page.selectOption('#bankType','all');await page.fill('#bankQuery','202406');
    assert.equal(await page.locator('#bankResults [data-question]').count(),5);
    await context.close();
  });
  assert.deepEqual(errors,[],'browser console exceptions');
  console.log('All '+passed+' browser scenario groups passed. Bank: 71 programming + 56 choice.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
