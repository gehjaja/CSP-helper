function readReviewQueue(raw){
  if(!raw || !["daily","wrong","spaced"].includes(raw.mode) || !Array.isArray(raw.ids) ||
    raw.ids.length > BANK.length+CHOICE.length || !raw.ids.every(byId) || !Number.isInteger(raw.pos) ||
    raw.pos<0 || raw.pos>=raw.ids.length) return null;
  const ids=raw.ids.map(id=>byId(id).id);
  if(new Set(ids).size!==ids.length || (raw.mode==="daily" && ids.length!==3)) return null;
  return {mode:raw.mode,ids,pos:raw.pos,day:validDate(raw.day)?raw.day:""};
}
function readDailyPlan(raw){
  if(!raw || raw.version!==2 || !validDate(raw.day) || !Array.isArray(raw.ids) ||
     raw.ids.length!==3 || !raw.ids.every(byId)) return null;
  const ids=raw.ids.map(id=>byId(id).id);
  if(new Set(ids).size!==ids.length) return null;
  const steps={};
  for(const id of ids){
    if(["已作答","已跳过","已走过"].includes(raw.steps?.[id])) steps[id]=raw.steps[id];
  }
  const recent=Array.isArray(raw.recent) && raw.recent.length<=BANK.length+CHOICE.length
    ? [...new Set(raw.recent.map(id=>byId(id)?.id).filter(id=>id!==undefined))] : [];
  return {version:2,day:raw.day,ids,steps,recent};
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
  return CHOICE.filter(q=>schedule.has(q.id)?schedule.get(q.id).due<=today():(DB.done.includes(q.id)||DB.qstat[q.id]?.a>0)).map(q=>q.id);
}
function coolingMistakes(){
  const cutoff=dkey(shiftDay(new Date(today()+"T12:00:00"),-3));
  return new Set(DB.wrong.filter(id=>DB.reviewOffers[id]>cutoff));
}
function planThree(previous=[], cooling=coolingMistakes()){
  const excluded=new Set(previous), chosen=[];
  const wrong=rankedWrong(), due=dueChoices();
  const available=id=>!excluded.has(id) && !cooling.has(id);
  const easy=BANK.filter(q=>questionSlot(q)<=2).map(q=>q.id);
  const recent=new Map(DB.history.map(row=>[row.questionId,Date.parse(row.at)]));
  const reviewOrder=easy.slice().sort((a,b)=>(recent.get(a)||0)-(recent.get(b)||0));
  const hard=BANK.filter(q=>questionSlot(q)>=3).sort((a,b)=>questionSlot(a)-questionSlot(b)).map(q=>q.id);
  const fresh=ids=>ids.filter(id=>!DB.done.includes(id));
  function pick(ids){
    const id=ids.find(id=>available(id) && !chosen.includes(id));
    if(id!==undefined) chosen.push(id);
  }
  pick(wrong);
  pick([...fresh(easy),...reviewOrder]);
  if(!chosen.some(id=>questionSlot(byId(id))>=3)) pick([...fresh(hard),...hard]);
  if(chosen.length<3) pick([...due,...fresh(easy),...reviewOrder]);
  // If a whole slot is cooling down, use another eligible question first.
  const pool=[...reviewOrder,...hard,...CHOICE.map(q=>q.id)];
  for(const id of pool){
    if(chosen.length===3) break;
    if(available(id) && !chosen.includes(id)) chosen.push(id);
  }
  if(chosen.length===3) return chosen;
  // Even a profile with the entire bank on cooldown can open a full group.
  for(const id of pool.filter(id=>!excluded.has(id)).sort((a,b)=>(DB.reviewOffers[a]||"").localeCompare(DB.reviewOffers[b]||""))){
    if(chosen.length===3) break;
    if(!chosen.includes(id)) chosen.push(id);
  }
  return chosen;
}
function setDailyPlan(recent=[]){
  const cooling=coolingMistakes(), total=BANK.length+CHOICE.length;
  // Keep three eligible candidates. At the end of a rotation, release only
  // the oldest offers needed to fill the last group alongside unseen questions.
  const useCooldown=total-cooling.size>=3;
  const poolSize=useCooldown?total-cooling.size:total;
  const eligibleHistory=useCooldown?recent.filter(id=>!cooling.has(id)):recent;
  const keepFrom=Math.max(0,eligibleHistory.length-(poolSize-3));
  const ids=planThree(eligibleHistory.slice(keepFrom),cooling), day=today();
  DB.dailyPlan={version:2,day,ids,steps:{},recent};
  for(const id of ids){if(DB.wrong.includes(id)) DB.reviewOffers[id]=day;}
}
function currentStepAnswered(group){
  const id=group.ids[group.pos], state=isChoice(byId(id))?choice:practice;
  return state.list.length===1 && state.list[state.idx]?.id===id &&
    (state===choice?state.revealed:!!state.level);
}
function ensureDailyPlan(){
  const group=DB.reviewQueue;
  if(group?.mode!=="daily" && (!DB.dailyPlan || DB.dailyPlan.day!==today())) setDailyPlan();
}
function renderDailyReview(){
  ensureDailyPlan();
  const plan=DB.dailyPlan, active=DB.reviewQueue?.mode==="daily"?DB.reviewQueue:null;
  const completed=Object.keys(plan.steps).length;
  const prior=plan.day!==today();
  const label=prior?plan.day+" 的三题":"今日三题";
  document.getElementById("dailyTitle").textContent=label;
  document.getElementById("dailyStatus").textContent=active
    ? (prior?"上次的练习跨天保留。":"")+"当前第 "+(active.pos+1)+" / "+plan.ids.length+" 题"
    : "本组进度 "+completed+" / "+plan.ids.length;
  document.getElementById("todayReview").innerHTML=plan.ids.map((id,index)=>{
    const q=byId(id), current=active?.pos===index;
    const status=current?(currentStepAnswered(active)?"已作答，待进入下一步":"当前题"):plan.steps[id]||"待练";
    return '<p>'+slotBadge(q)+esc(q.title||q.q)+' <small>· '+(DB.wrong.includes(id)?"错题巩固":DB.done.includes(id)?"复习":"新题")+" · "+status+'</small></p>';
  }).join("");
  const button=document.getElementById("startDaily");
  button.disabled=!active && completed===plan.ids.length;
  if(button.disabled) button.textContent="本组已结束";
  else if(active || completed) button.textContent=prior?"继续上次复习":"继续今日复习";
  else button.textContent="开始今日练习";
  const resume=document.getElementById("resumeOtherReview"), other=DB.reviewQueue;
  resume.hidden=!other || !!active;
  if(!resume.hidden) resume.textContent="继续"+(other.mode==="wrong"?"错题":"到期")+"复习（第 "+(other.pos+1)+" / "+other.ids.length+" 题）";
}
function leaveReviewQueue(){
  const group=DB.reviewQueue;
  if(!group) return true;
  if(!canEdit() || !confirm("离开当前复习组？正在第 "+(group.pos+1)+" / "+group.ids.length+" 题。已保存的作答记录会保留。")) return false;
  if(group.mode==="daily" && currentStepAnswered(group)) DB.dailyPlan.steps[group.ids[group.pos]]="已作答";
  DB.reviewQueue=null;
  return true;
}
function replaceDailyPlan(){
  if(!canEdit()) return;
  if(DB.reviewQueue?.mode==="daily" && !leaveReviewQueue()) return;
  const plan=DB.dailyPlan;
  const earlier=plan.day===today() ? (plan.recent || []) : [];
  const recent=earlier.filter(id=>!plan.ids.includes(id)).concat(plan.ids);
  setDailyPlan(recent);
  saveDB();
  renderDailyReview();
}
function renderSpacedReview(){
  const count=dueChoices().length;
  document.getElementById("choiceReviewInfo").textContent="今天到期 "+count+" 题。答错次日复习，连续答对后延长至 2、4、7、14 天。旧档案中只有累计次数的题可立即复习。";
  document.getElementById("startSpaced").disabled=!count && DB.reviewQueue?.mode!=="spaced";
}
function startReview(mode){
  if(!canEdit()) return;
  let queue=DB.reviewQueue;
  const continuing=queue?.mode===mode;
  if(!continuing){
    if(mode==="daily") ensureDailyPlan();
    const ids=mode==="wrong"?rankedWrong():mode==="daily"?DB.dailyPlan.ids.slice():dueChoices();
    if(!ids.length){toast("当前没有待复习的题");return;}
    const pos=mode==="daily"?ids.findIndex(id=>!DB.dailyPlan.steps[id]):0;
    if(pos<0 || !leaveReviewQueue()) return;
    queue=DB.reviewQueue={mode,ids,pos,day:mode==="daily"?DB.dailyPlan.day:today()};
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
  info.textContent=(group.day && group.day!==today()?group.day+" 的复习 · ":"")+"本组第 "+(group.pos+1)+" / "+group.ids.length+" 题，后面还有 "+(group.ids.length-group.pos-1)+" 题";box.prepend(info);
  if(button) button.textContent=group.pos+1===group.ids.length?"完成本组":"下一道复习题";
}
function advanceReviewQueue(q){
  const group=DB.reviewQueue;
  if(!q || group?.ids[group.pos]!==q.id) return false;
  flushSession();
  if(group.mode==="daily") DB.dailyPlan.steps[q.id]=currentStepAnswered(group)?"已作答":"已跳过";
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
