let stopSampleRun=null;
function matchesSample(q,actual,expected){
  if(q.id===46){
    const lines=text=>text.replace(/\r\n/g,"\n").replace(/\n$/,"");
    return lines(actual)===lines(expected);
  }
  const a=actual.trim().split(/\s+/),b=expected.trim().split(/\s+/);
  const tolerance={26:0.0001,28:0.1,32:0.1}[q.id];
  const number=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  return a.length===b.length && a.every((v,i)=>v===b[i] || (tolerance && number.test(v) && number.test(b[i]) && Math.abs(Number(v)-Number(b[i]))<=tolerance));
}
function mountSampleRunner(q,mount){
  const language=document.getElementById("studyLanguage"),editor=document.getElementById("studyCode");
  mount.innerHTML='<button type="button" class="favorite-btn">运行 Python 样例</button> <button type="button" hidden>停止</button><pre class="sample-pre" aria-live="polite"></pre>';
  const [run,stop]=mount.querySelectorAll("button"),report=mount.querySelector("pre");
  function sync(){
    if(stopSampleRun) stopSampleRun();
    run.hidden=language.value!=="python";
    report.textContent=run.hidden?"C++ 可在外部 OJ 提交评测。":"首次运行需要联网加载 Python 环境。每组样例最多运行 5 秒。";
  }
  sync();language.addEventListener("change",sync);editor.addEventListener("input",sync);
  run.onclick=()=>{
    if(!editor.value.trim()){report.textContent="请先写入 Python 代码。";return;}
    const frame=document.createElement("iframe"),channel=new MessageChannel();
    let timer,passed=0;
    function finish(){clearTimeout(timer);channel.port1.postMessage("stop");channel.port1.close();frame.remove();stop.hidden=true;run.disabled=false;stopSampleRun=null;}
    function timeout(ms,msg){clearTimeout(timer);timer=setTimeout(()=>{report.textContent+="\n"+msg;finish();},ms);}
    stopSampleRun=()=>{report.textContent+="\n已停止";finish();};stop.onclick=stopSampleRun;stop.hidden=false;run.disabled=true;
    report.textContent="正在加载 Python 环境…";
    channel.port1.onmessage=({data})=>{
      if(data.error){report.textContent+="\n运行失败："+data.error;finish();return;}
      if(data.done){report.textContent+="\n公开样例通过 "+passed+" / "+q.samples.length;finish();return;}
      timeout(5000,"样例运行超时");if(data.ready){report.textContent="";return;}
      const sample=q.samples[data.i];if(!sample||typeof data.output!=="string")return;
      const ok=matchesSample(q,data.output,sample.out);if(ok)passed++;
      report.textContent+="样例 "+(data.i+1)+(ok?" 通过":" 未通过\n期望："+sample.out+"\n得到："+data.output.slice(0,1000))+"\n";
    };
    frame.hidden=true;frame.sandbox="allow-scripts";frame.src="sample-frame.html";
    frame.onload=()=>frame.contentWindow.postMessage({code:editor.value,inputs:q.samples.map(s=>s.in)},"*",[channel.port2]);
    mount.append(frame);timeout(90000,"运行时加载超时，请检查网络并重试。");
  };
}
