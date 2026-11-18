const archiveRefs={
2:"https://blog.siriyang.cn/posts/20191231194316id.html",3:"https://www.cnblogs.com/SiriYang/p/12121169.html",5:"https://www.cnblogs.com/yuhan-blog/p/12308991.html",
7:"https://www.cnblogs.com/whysopt/p/16125491.html",9:"https://www.cnblogs.com/rabbit1103/p/17248366.html",10:"https://developer.aliyun.com/article/1201384",11:"https://blog.51cto.com/u_15786578/5665638",
15:"https://blog.51cto.com/wydxry/3085275",17:"https://blog.51cto.com/u_16173351/6573265",19:"https://www.cnblogs.com/wydxry/p/10732321.html",20:"https://www.cnblogs.com/wydxry/p/10730131.html",21:"https://kaitolab.net/blog/csp-202009-1/"};
function problemRef(q){
  if(q.sourceUrl)return q.sourceUrl;
  if(archiveRefs[q.id])return archiveRefs[q.id];
  const m=q.source.match(/(\d{6})-(\d)/);
  return "https://oj.shumeng.tech/p/CSP"+m[1]+"ABCDE"[Number(m[2])-1];
}
const paperNames=["词频统计","相似度计算","化学方程式配平","十滴水","文件夹合并"];
const duration=4*60*60*1000;
function readPaper(raw){
  if(!raw || !Number.isSafeInteger(raw.start)||raw.start<0 || !Array.isArray(raw.scores)||raw.scores.length!==5 ||
    !raw.scores.every(x=>x===null||Number.isInteger(x)&&x>=0&&x<=100))return null;
  return {start:raw.start,end:Number.isSafeInteger(raw.end)?raw.end:null,scores:raw.scores.slice()};
}
function renderPaper(){
  const state=DB.paper,root=document.getElementById("paperPanel");
  const ended=state && (state.end!==null||Date.now()>=state.start+duration);
  const counts=[0,0,0,0,0];BANK.forEach(q=>counts[Number(q.source.slice(-1))-1]++);
  root.innerHTML='<h2 class="card-title">整套模拟 · 2024 年 3 月 CSP</h2><p class="about">本站收录 '+counts.map((n,i)=>'T'+(i+1)+' '+n+' 题').join(' / ')+'。下面是同一场的 5 道公开题面，提交代码需登录曙梦 OJ，使用该站评测数据。</p>'+
  paperNames.map((name,i)=>'<div class="goal-line"><a target="_blank" rel="noopener noreferrer" href="https://oj.shumeng.tech/p/CSP202403'+'ABCDE'[i]+'">T'+(i+1)+' '+name+' ↗</a>'+(state?'<label>OJ 得分 <input aria-label="第 '+(i+1)+' 题实得分" style="width:4em" type="number" min="0" max="100" data-score="'+i+'" value="'+(state.scores[i]??'')+'"></label>':'')+'</div>').join('')+
  '<p class="about" id="paperClock"></p><p id="paperTotal"></p><button class="btn ghost" id="paperAction">'+(!state?'开始 4 小时模拟':ended?'重新模拟':'提前交卷')+'</button>';
  function total(){if(state)document.getElementById("paperTotal").textContent="本人登记 "+state.scores.filter(x=>x!==null).length+" / 5 题，共 "+state.scores.reduce((a,b)=>a+(b||0),0)+" 分";}
  total();tickPaper();
  root.querySelectorAll("[data-score]").forEach(el=>{el.onchange=()=>{
    if(!canEdit()||!el.checkValidity()){renderPaper();return;}
    state.scores[Number(el.dataset.score)]=el.value===""?null:Number(el.value);saveDB();total();
  };});
  document.getElementById("paperAction").onclick=()=>{
    if(!canEdit())return;
    if(state && state.end===null && Date.now()<state.start+duration){if(!confirm("结束本次模拟并交卷？"))return;state.end=Date.now();}
    else {if(state&&!confirm("重新模拟将替换上次模拟的登记分数。继续吗？"))return;
      DB.paper={start:Date.now(),end:null,scores:Array(5).fill(null)};}
    saveDB();renderPaper();
  };
}
function tickPaper(){
  const el=document.getElementById("paperClock"),s=DB.paper;if(!el)return;
  if(!s){el.textContent="开始后持续计时 4 小时，切后台、刷新或关闭页面仍计入考试时间。";return;}
  const left=Math.max(0,Math.ceil((s.start+duration-Date.now())/1000));
  if(!left||s.end!==null){el.textContent=s.end!==null?"已交卷":"4 小时已到，模拟结束";document.getElementById("paperAction").textContent="重新模拟";return;}
  el.textContent="剩余 "+[Math.floor(left/3600),Math.floor(left/60)%60,left%60].map(x=>String(x).padStart(2,"0")).join(":");
}
