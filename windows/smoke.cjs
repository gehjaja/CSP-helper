const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try {
    const ctx=await browser.newContext({serviceWorkers:'block'});
    await ctx.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:41763/')?r.continue():r.abort());
    const page=await ctx.newPage();
    await page.goto('http://127.0.0.1:41763/');
    await page.waitForFunction(()=>activeProfile && !profileBusy);
    assert.equal(await page.evaluate(()=>BANK.length),71);
    await page.evaluate(()=>openQuestion(41));
    await page.selectOption('#studyLanguage','python');
    await page.fill('#studyCode','import sys\nn,*h=map(int,sys.stdin.buffer.read().split())\nprint(max(min(h[i:j])*(j-i) for i in range(n) for j in range(i+1,n+1)))');
    await page.getByRole('button',{name:'运行 Python 样例'}).click();
    await page.waitForFunction(()=>document.querySelector('#sampleRunnerMount pre').textContent.includes('公开样例通过 2 / 2'),null,{timeout:60000});
    await page.click('[data-lv="ok"]');
    await page.reload(); await page.waitForFunction(()=>activeProfile && DB.done.includes(41));
    console.log('Offline bank, Python samples and saved progress passed');
  } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
