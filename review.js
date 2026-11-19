function readReviewQueue(raw){
  if(!raw || !["daily","wrong","spaced"].includes(raw.mode) || !Array.isArray(raw.ids) ||
    raw.ids.length > BANK.length+CHOICE.length || !raw.ids.every(byId) || !Number.isInteger(raw.pos) ||
    raw.pos<0 || raw.pos>=raw.ids.length) return null;
  return {mode:raw.mode,ids:raw.ids.map(id=>byId(id).id),pos:raw.pos};
}
function readDailyPlan(raw){
  return raw && raw.version===2 && validDate(raw.day) && Array.isArray(raw.ids) && raw.ids.length===3 && raw.ids.every(byId)
    ? {version:2,day:raw.day,ids:raw.ids.map(id=>byId(id).id)} : null;
}
function missCount(id){ const stat=DB.qstat[id]; return stat ? stat.a-stat.c : 0; }
function rankedWrong(){ return DB.wrong.slice().sort((a,b)=>missCount(b)-missCount(a)); }
function dueChoices(){
  const schedule=new Map();
  for(const row of DB.history){
    if(row.kind!=="choice") continue;
    const prev=schedule.get(row.questionId);
    const day=dkey(new Date(row.at));
    const streak=row.correct ? Math.min(4,(prev?.streak||0)+(prev?.day===day?0:1)) : 0;
    const due=dkey(shiftDay(new Date(row.at),[1,2,4,7,14][streak]));
    schedule.set(row.questionId,{streak,day,due});
  }
  return CHOICE.filter(q=>schedule.has(q.id)?schedule.get(q.id).due<=today():DB.done.includes(q.id)).map(q=>q.id);
}
function planThree(){
  const chosen=[];
  const wrong=rankedWrong(), due=dueChoices();
  const easy=BANK.filter(q=>questionSlot(q)<=2).map(q=>q.id);
  const recent=new Map(DB.history.map(row=>[row.questionId,Date.parse(row.at)]));
  const reviewOrder=easy.slice().sort((a,b)=>(recent.get(a)||0)-(recent.get(b)||0));
  const hard=BANK.filter(q=>questionSlot(q)>=3).sort((a,b)=>questionSlot(a)-questionSlot(b)).map(q=>q.id);
  const fresh=ids=>ids.filter(id=>!DB.done.includes(id));
  function pick(ids){
    const id=ids.find(id=>!chosen.includes(id));
    if(id!==undefined) chosen.push(id);
  }
  // A difficult mistake can fill both the review and challenge requirements.
  pick(wrong);
  pick([...fresh(easy),...reviewOrder]);
  if(!chosen.some(id=>questionSlot(byId(id))>=3)) pick([...fresh(hard),...hard]);
  if(chosen.length<3) pick([...due,...fresh(easy),...reviewOrder]);
  return chosen;
}
function renderDailyReview(){
  if(!DB.dailyPlan || DB.dailyPlan.day!==today()){
    const ongoing=DB.reviewQueue;
    const ids=ongoing?.mode==="daily" && ongoing.ids.length===3 ? ongoing.ids.slice() : planThree();
    DB.dailyPlan={version:2,day:today(),ids};
  }
  document.getElementById("todayReview").innerHTML=DB.dailyPlan.ids.map(id=>{
    const q=byId(id);
    return '<p>'+slotBadge(q)+esc(q.title||q.q)+' <small>· '+(DB.wrong.includes(id)?"错题巩固":DB.done.includes(id)?"复习":"新题")+'</small></p>';
  }).join("");
}
function renderSpacedReview(){
  const count=dueChoices().length;
  document.getElementById("choiceReviewInfo").textContent="今天到期 "+count+" 题。答错次日复习，连续答对后延长至 2、4、7、14 天。";
  document.getElementById("startSpaced").disabled=!count && DB.reviewQueue?.mode!=="spaced";
}
function startReview(mode){
  if(!canEdit()) return;
  let queue=DB.reviewQueue;
  const continuing=queue?.mode===mode;
  if(!continuing){
    const ids=mode==="wrong"?rankedWrong():mode==="daily"?DB.dailyPlan.ids.slice():dueChoices();
    if(!ids.length){toast("当前没有待复习的题");return;}
    queue=DB.reviewQueue={mode,ids,pos:0};
  }
  const id=queue.ids[queue.pos];
  const view=isChoice(byId(id))?"choice":"practice", state=view==="choice"?choice:practice;
  if(continuing && state.list.length===1 && state.list[state.idx]?.id===id) go(view);
  else openQuestion(id,true);
}
function renderReviewStep(box,q,button){
  const group=DB.reviewQueue;
  if(group?.ids[group.pos]!==q.id) return;
  const info=document.createElement("p");info.className="about";
  info.textContent="本组第 "+(group.pos+1)+" / "+group.ids.length+" 题";box.prepend(info);
  if(button) button.textContent=group.pos+1===group.ids.length?"完成本组":"下一道复习题";
}
function advanceReviewQueue(q){
  const group=DB.reviewQueue;
  if(!q || group?.ids[group.pos]!==q.id) return false;
  flushSession();
  group.pos++;
  if(group.pos<group.ids.length) openQuestion(group.ids[group.pos],true);
  else {DB.reviewQueue=null;go(group.mode==="wrong"?"wrong":"home");toast("本组练习完成");}
  return true;
}
function renderChoiceAttempts(){
  const previous=new Set(), counts=[[0,0],[0,0]], recorded={};
  DB.history.forEach(row=>{if(row.kind==="choice") recorded[row.questionId]=(recorded[row.questionId]||0)+1;});
  for(const row of DB.history){
    if(row.kind!=="choice") continue;
    const repeat=previous.has(row.questionId)||DB.qstat[row.questionId]?.a>recorded[row.questionId];
    const bucket=counts[Number(repeat)]; bucket[0]+=Number(row.correct);bucket[1]++;previous.add(row.questionId);
  }
  document.getElementById("totalStats").insertAdjacentHTML("beforeend",counts.map(([right,n],i)=>
    '<div class="goal-line"><span>'+["首次作答","重复作答"][i]+'（有明细）</span><b>'+right+' / '+n+' · '+(n?Math.round(100*right/n)+'%':'—')+'</b></div>').join(""));
}
