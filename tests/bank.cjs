const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const context = {document:{addEventListener(){}}};
vm.createContext(context);
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
context.validateBank();
assert.equal(context.BANK.length,42);assert.equal(context.CHOICE.length,56);
const htmlIds=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(htmlIds).size,htmlIds.length,'duplicate HTML ids');
// [修补] 同一道题的样例输入必须两两不同，否则同一组数据会展示出两个互斥答案。
for(const q of context.BANK){
  const inputs=q.samples.map(s=>s.in.trim());
  assert.equal(new Set(inputs).size,inputs.length,'duplicate sample input '+q.id);
}
for(let id=1;id<=42;id++)assert.ok(context.byId(id));
for(let id=1;id<=56;id++)assert.ok(context.byId('c'+id));
console.log('Bank structure, stable ids, categories, options, answer indices and required fields passed: 98 questions.');
const compiler = process.env.CXX;
if(compiler){
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'ziyong12-bank-'));
  let samples=0;
  try{
    for(const q of context.BANK){
      const source=path.join(temp,q.id+'.cpp'), binary=path.join(temp,q.id+(process.platform==='win32'?'.exe':''));
      fs.writeFileSync(source,q.code);
      const compile=spawnSync(compiler,['-std=c++14','-O2','-Wall','-Wextra',source,'-o',binary],{encoding:'utf8',timeout:30000});
      assert.equal(compile.status,0,'compile '+q.id+': '+compile.stderr);
      for(const sample of q.samples){
        const run=spawnSync(binary,[],{input:sample.in+'\n',encoding:'utf8',timeout:5000});
        assert.equal(run.status,0,'run '+q.id+': '+run.stderr);
        const actual=run.stdout.trim().split(/\s+/),expected=sample.out.trim().split(/\s+/);
        assert.equal(actual.length,expected.length,'output token count '+q.id);
        actual.forEach((s,i)=>{
          if(s===expected[i])return;
          const x=Number(s),y=Number(expected[i]);
          assert.ok(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x-y)<=1e-4,'sample '+q.id+': '+s+' != '+expected[i]);
        });
        samples++;
      }
    }
    console.log('All 42 C++14 programs compiled; '+samples+' sample cases passed.');
  }finally{
    // Delete only the exact directory returned by mkdtemp, under the system temp root.
    assert.equal(path.dirname(path.resolve(temp)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith('ziyong12-bank-'));
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
