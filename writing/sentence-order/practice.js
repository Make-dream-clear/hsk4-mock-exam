'use strict';
const EXERCISES = JSON.parse(document.getElementById('sentence-order-data').textContent);
const order = HSK4Order;
const $ = id => document.getElementById(id);
let currentEx = 0, previousEx = null, answered = false, answerFragments = [], reviewQueue = null;
const firstResults = {}, firstSentences = {};
let orderLearning = null;
function trackOrder(){return orderLearning ||= window.HSK4Learning?.create('sentence_order','order','sentence-order',EXERCISES.length);}
const labels = {1:'Basic',2:'Intermediate',3:'Advanced',4:'Real exam'};
function counts() {
  const values = Object.values(firstResults);
  return {matched:values.filter(v=>v==='matched').length, review:values.filter(v=>v==='review').length, untouched:EXERCISES.length-values.length};
}
function renderExercise() {
  const ex = EXERCISES[currentEx];
  answered = false; answerFragments = [];
  $('exerciseBox').hidden = false; $('resultsBox').hidden = true;
  $('exProgress').textContent = `Exercise ${currentEx+1} / ${EXERCISES.length}`;
  $('exerciseSelect').value = String(currentEx);
  $('exLevel').textContent = labels[ex.level]; $('exLevel').className = 'exercise-level level-'+ex.level;
  $('exGrammar').textContent = ex.grammar + ' · ' + ex.groupLabel;
  $('exAttempt').textContent = firstResults[ex.id] ? 'Practice attempt: your first-attempt record stays unchanged. / 再次练习，不改写首次记录。' : 'Use every tile once. You can remove a tile by selecting it again. / 每个词块用一次，点击已选词块可移回。';
  const indices = ex.fragments.map((_,i)=>i);
  for(let i=indices.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]];}
  $('fragmentBank').innerHTML = indices.map(i=>`<button type="button" class="fragment chinese" data-index="${i}">${order.escape(ex.fragments[i])}</button>`).join('');
  $('answerZone').className = 'answer-zone'; $('answerZone').innerHTML = '';
  $('btnCheck').hidden = false; $('btnCheck').disabled = true;
  $('btnReset').hidden = false; $('btnRetry').hidden = true; $('btnNext').hidden = true; $('btnSimilar').hidden = true;
  $('btnBack').hidden = previousEx === null;
  $('exFeedback').hidden = true; $('exFeedback').className = 'exercise-feedback'; $('exFeedback').innerHTML = '';
  $('staticExercises').open = false;
}
function updateDisplay() {
  const ex=EXERCISES[currentEx];
  $('fragmentBank').querySelectorAll('button').forEach(button=>{
    const used=answerFragments.includes(Number(button.dataset.index));
    button.disabled=used; button.classList.toggle('in-answer',used);
  });
  $('answerZone').innerHTML=answerFragments.map(i=>`<button type="button" class="fragment in-zone chinese" data-index="${i}" aria-label="${order.escape('Remove / 移回 '+ex.fragments[i])}">${order.escape(ex.fragments[i])}</button>`).join('');
  $('btnCheck').disabled=answerFragments.length!==ex.fragments.length;
}
$('fragmentBank').addEventListener('click',event=>{
  const button=event.target.closest('button[data-index]'); if(!button || answered)return;
  const i=Number(button.dataset.index); if(!answerFragments.includes(i)){trackOrder()?.start();answerFragments.push(i);updateDisplay();}
});
$('answerZone').addEventListener('click',event=>{
  const button=event.target.closest('button[data-index]'); if(!button || answered)return;
  answerFragments=answerFragments.filter(i=>i!==Number(button.dataset.index)); updateDisplay();
});
function checkAnswer() {
  if(answered)return;
  const ex=EXERCISES[currentEx],result=order.evaluate(ex,answerFragments);
  if(result==='incomplete')return;
  answered=true;
  const sentence=answerFragments.map(i=>ex.fragments[i]).join('');
  const retried=Object.prototype.hasOwnProperty.call(firstResults,ex.id);
  order.recordFirst(firstResults,ex.id,result);
  const trackingId='q-'+(currentEx+1);
  trackOrder()?.answer(trackingId,result==='matched'?'matched':'needs_review',{attempt_type:retried?'retry':'first',topic_id:ex.group});
  trackOrder()?.explanation(trackingId);
  if(Object.keys(firstResults).length===EXERCISES.length)trackOrder()?.complete();
  if(!retried)firstSentences[ex.id]=sentence;
  $('answerZone').classList.add(result==='matched'?'correct':'needs-review');
  $('answerZone').querySelectorAll('button').forEach(b=>b.disabled=true);
  $('fragmentBank').querySelectorAll('button').forEach(b=>b.disabled=true);
  const matches=ex.answers.map(answer=>{
    const indices=order.tileOrder(ex.fragments,answer);
    return `<li><p class="chinese">${order.escape(answer)}</p><div class="reference-tiles" aria-label="Reference tile order / 参考词块顺序">${indices.map(i=>`<span>${order.escape(ex.fragments[i])}</span>`).join('')}</div></li>`;
  }).join('');
  const status=result==='matched'?'Matches a checked expression / 匹配已核对表达':'Compare your word order / 请对照检查语序';
  $('exFeedback').className='exercise-feedback show '+(result==='matched'?'pass':'needs-review');
  $('exFeedback').hidden=false;
  $('exFeedback').innerHTML=`<p role="status"><strong>${status}</strong></p>${result==='review'?'<p>This order is not in our checked answer list. That alone does not prove it is ungrammatical. Compare the structure and meaning below. / 未匹配并不直接等于语法错误，请对照下面的结构和含义检查。</p>':''}${retried?'<p>Your first-attempt record is unchanged. / 首次作答记录保持不变。</p>':''}<h3>Checked expressions / 已核对表达</h3><ol class="reference-answers">${matches}</ol>${order.renderNotes(ex)}`;
  $('btnCheck').hidden=true; $('btnReset').hidden=true; $('btnRetry').hidden=false; $('btnNext').hidden=false;
  $('btnSimilar').hidden=!EXERCISES.some((q,i)=>i!==currentEx&&q.group===ex.group);
  $('btnNext').textContent=reviewQueue?'Next review / 下一道复习题':currentEx===EXERCISES.length-1?'Review progress / 查看进度':'Next / 下一题';
}
function resetExercise(){if(answered)trackOrder()?.retry('q-'+(currentEx+1));renderExercise();$('fragmentBank').querySelector('button').focus();}
function navigateTo(i,keepQueue=false){
  if(!Number.isInteger(i)||i<0||i>=EXERCISES.length)return;
  previousEx=currentEx;currentEx=i;if(!keepQueue)reviewQueue=null;renderExercise();$('exerciseSelect').focus();
}
function nextExercise(){
  if(reviewQueue){const pos=reviewQueue.indexOf(currentEx);if(pos+1<reviewQueue.length)navigateTo(reviewQueue[pos+1],true);else showResults();}
  else if(currentEx+1<EXERCISES.length)navigateTo(currentEx+1);else showResults();
}
function similarExercise(){
  const candidates=EXERCISES.map((q,i)=>({q,i})).filter(({q,i})=>q.group===EXERCISES[currentEx].group&&i!==currentEx);
  const next=candidates.find(({q})=>!firstResults[q.id])||candidates.find(({i})=>i>currentEx)||candidates[0];
  if(next)navigateTo(next.i);
}
function showResults(){
  orderLearning?.submit({answered_count:Object.keys(firstResults).length});
  $('exerciseBox').hidden=true;$('resultsBox').hidden=false;
  const c=counts();
  $('resultsScore').textContent=`${c.matched} matched · ${c.review} to compare · ${c.untouched} not attempted`;
  $('resultsMsg').textContent='First attempts in this session / 本轮首次作答：matched means your order appears in the checked list. An unmatched order needs review, not an automatic grammar-failure grade. Retries do not increase these counts. / 未匹配需复核，并非自动判语法错误；重做不增加首次计数。';
  $('reviewList').innerHTML=EXERCISES.map((q,i)=>firstResults[q.id]==='review'?`<li><button type="button" data-exercise="${i}">Exercise ${i+1} · ${order.escape(q.grammar)}</button><p class="chinese">${order.escape(firstSentences[q.id])}</p></li>`:'').join('')||'<li>No unmatched first attempts yet. / 暂无首次未匹配题。</li>';
  $('btnReviewQueue').disabled=c.review===0;
  $('resultsHeading').focus();
}
function startReview(){
  const queue=EXERCISES.map((q,i)=>firstResults[q.id]==='review'?i:null).filter(i=>i!==null);
  if(!queue.length)return;
  orderLearning?.retry();navigateTo(queue[0]);reviewQueue=queue;
}
function restartAll(){
  orderLearning=null;
  for(const key of Object.keys(firstResults))delete firstResults[key];
  for(const key of Object.keys(firstSentences))delete firstSentences[key];
  currentEx=0;previousEx=null;reviewQueue=null;renderExercise();$('exerciseSelect').focus();
}
$('exerciseSelect').innerHTML=EXERCISES.map((ex,i)=>`<option value="${i}">${i+1}. ${order.escape(ex.grammar)}</option>`).join('');
$('exerciseSelect').addEventListener('change',e=>navigateTo(Number(e.target.value)));
$('btnRetry').addEventListener('click',resetExercise);
$('btnSimilar').addEventListener('click',similarExercise);
$('btnBack').addEventListener('click',()=>navigateTo(previousEx));
$('btnProgress').addEventListener('click',showResults);
$('btnReviewQueue').addEventListener('click',startReview);
$('btnResume').addEventListener('click',()=>{renderExercise();$('exerciseSelect').focus();});
$('reviewList').addEventListener('click',event=>{const button=event.target.closest('[data-exercise]');if(button)navigateTo(Number(button.dataset.exercise));});
document.querySelectorAll('[data-order-static]').forEach(button=>button.addEventListener('click',()=>{navigateTo(Number(button.dataset.orderStatic));$('exerciseBox').scrollIntoView({block:'start'});}));
document.querySelectorAll('[data-order-interactive]').forEach(el=>el.hidden=false);
renderExercise();
