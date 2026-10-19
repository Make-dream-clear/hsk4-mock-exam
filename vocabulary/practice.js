(function(){
'use strict';
const lib=HSK4Vocabulary,$=id=>document.getElementById(id),words=new Map(vocabulary.map(w=>[w.id,w]));
const contexts=lib.validateContext(JSON.parse($('vocabulary-context-data').textContent),vocabulary);
const allContext=new Map(contexts.map(q=>[q.id,q]));
const valid=new Set([...vocabulary.map(w=>'meaning-'+w.id),...allContext.keys()]);
const key='hsk4_vocab_review_v1';let saved=[],canSave=true;
try{saved=lib.parseReview(localStorage.getItem(key),valid);}catch{canSave=false;}
let questions=[],index=0,first={},answered=false,mode='meaning',returnFocus=null,reviewing=false,initialSize=0,scope='filtered';
let learning=null, roundAnswers=new Set();
function save(){try{localStorage.setItem(key,JSON.stringify(saved));}catch{canSave=false;}updateReview();}
function updateReview(){document.querySelectorAll('[data-vocab-review]').forEach(b=>b.textContent=`Saved review (${saved.length}) / 待复习`);}
function remember(id){if(!saved.includes(id))saved.push(id);save();}
function resolve(id){if(allContext.has(id))return lib.makeContext(allContext.get(id));const w=words.get(Number(id.replace('meaning-','')));return w?lib.makeMeaning(w,vocabulary):null;}
function show(){
 returnFocus=document.activeElement;$('quiz-overlay').classList.add('active');document.body.style.overflow='hidden';
 $('context-library').open=false;
}
function focusBody(){const heading=$('quiz-body').querySelector('[tabindex="-1"]');if(heading)heading.focus();$('quiz-overlay').querySelector('.modal').scrollTop=0;}
function storageNote(){return canSave?'Review list stays in this browser. Session results reset when you start a new set. / 待复习保存在本浏览器；开始新一轮会重置本轮记录。':'Browser storage is unavailable; this review list lasts until you reload. / 浏览器未能保存，待复习仅保留到本页刷新前。';}
function openQuiz(kind='meaning',all=false){
 if(!$('quiz-overlay').classList.contains('active'))show();
 mode=kind;scope=kind==='saved'?'saved':all?'all':'filtered';first={};reviewing=kind==='saved';index=0;
 const pool=(all?vocabulary:filtered).filter(w=>w.meaning?.trim()),ids=new Set(pool.map(w=>w.id));
 if(kind==='saved')questions=saved.map(resolve).filter(Boolean);
 else if(kind==='context')questions=lib.shuffle(contexts.filter(q=>ids.has(q.wordId))).map(lib.makeContext);
 else questions=lib.shuffle(pool).slice(0,20).map(w=>lib.makeMeaning(w,vocabulary));
 initialSize=questions.length;learning=null;roundAnswers=new Set();
 if(!questions.length){
  $('quiz-progress').textContent='No matching exercises / 暂无匹配题';$('quiz-next-btn').hidden=true;
  $('quiz-body').innerHTML=`<h3 tabindex="-1">${kind==='saved'?'Your review list is empty / 暂无待复习题':'No exercises match these filters / 当前筛选下没有可练题目'}</h3><p>${kind==='context'?'The context set covers 24 selected words; the full list still has 1,000 entries. / 语境题目前覆盖 24 个目标词，词表仍有 1,000 词。':'Your word filters have been kept. / 已保留你的词表筛选。'}</p>${kind!=='saved'?'<button class="btn btn-primary" data-action="all">'+(kind==='context'?'Practise all 24 context exercises / 练全部语境题':'Start from the full word list / 从完整词表开始')+'</button>':''}<p>${storageNote()}</p>`;focusBody();return;
 }
 learning=window.HSK4Learning?.create('vocabulary',mode,'vocabulary-'+mode,questions.length);learning?.start(kind==='saved'?'review':'first');
 render();
}
function closeQuiz(){
 $('quiz-overlay').classList.remove('active');document.body.style.overflow='';applyFilters();
 if(returnFocus?.isConnected)returnFocus.focus();
}
function render(){
 if(index>=questions.length){results();return;}
 const q=questions[index],w=words.get(q.wordId);answered=false;
 $('quiz-progress').textContent=`${reviewing?'Review':'Practice'} ${index+1} / ${questions.length}`;
 $('quiz-next-btn').hidden=true;
 const prompt=q.kind==='context'?`<p class="chinese context-stem">${lib.escape(q.stem)}</p><p>${lib.escape(q.translation)}</p>`:`<p>Choose the target word for this meaning. / 选择与释义对应的目标词。</p><p class="meaning-prompt">${lib.escape(w.meaning)}</p><details><summary>Need a clue? / 看提示</summary><p>${lib.escape(w.pinyin)}</p><p class="chinese">${lib.escape(lib.hintSentence(w))}</p></details>`;
 $('quiz-body').innerHTML=`<h3 tabindex="-1">${q.kind==='context'?'Choose in context / 语境选词':'Meaning recall / 词义回忆'}</h3><p class="quiz-scope">${q.kind==='context'?'Choose the best fit for the intended meaning. / 按本句要表达的意思选择。':(scope==='saved'?'From your saved review list. / 来自已保存的待复习题。':scope==='all'?'From the full word list, as selected. / 按你的选择，从完整词表出题。':'Target words follow your filters; answer choices come from the whole list. / 目标词沿用筛选，备选词来自完整词表。')}</p>${prompt}<div class="quiz-options" id="quiz-options">${lib.shuffle(q.options).map(o=>`<button type="button" class="quiz-opt-btn" data-choice="${o.id}"><span class="chinese">${lib.escape(lib.writtenForm(o.word))}</span><span>${lib.escape(words.get(o.id).pinyin)}</span></button>`).join('')}</div><div id="vocab-feedback" hidden></div>`;
 focusBody();
}
function wordCard(w){return `<section class="quiz-word-card"><h4>${lib.escape(lib.writtenForm(w.word))} · ${lib.escape(w.pinyin)}</h4><p>${lib.escape(w.meaning)}</p><p class="chinese">${lib.escape(w.example_cn)}</p><p>${lib.escape(w.example_pinyin)}</p><p>${lib.escape(w.example_en)}</p></section>`;}
function answer(choice){
 if(answered)return;const q=questions[index];if(!q.options.some(o=>o.id===choice))return;
 answered=true;const matched=choice===q.wordId,isFirst=lib.recordFirst(first,q,choice),w=words.get(q.wordId);
 learning?.answer(q.id,matched?'matched':'needs_review',{attempt_type:isFirst?'first':'retry',topic_id:q.kind});
 learning?.explanation(q.id);roundAnswers.add(q.id);
 if(roundAnswers.size===questions.length)learning?.complete();
 if(!matched)remember(q.id);
 $('quiz-options').querySelectorAll('button').forEach(b=>{b.disabled=true;b.classList.add('disabled');if(Number(b.dataset.choice)===q.wordId)b.classList.add('correct');else if(Number(b.dataset.choice)===choice)b.classList.add('wrong');});
 const feedback=$('vocab-feedback');feedback.hidden=false;
 feedback.innerHTML=`<h3 tabindex="-1" role="status">${matched?'Matches the target / 匹配目标词':'Compare these words / 对照辨析'}</h3><p>${!isFirst?'Retry: your first-attempt record is unchanged. / 重做不改变首次记录。':matched?'Use the example to check how the word is used. / 结合例句检查用法。':'Added to your review list. / 已加入待复习。'}</p>${q.kind==='context'?`<p class="chinese context-stem">${lib.escape(q.stem.replace('___',w.word))}</p><p>Clue / 线索：${lib.escape(q.clue)}</p>${lib.notes(q)}`:`${wordCard(w)}${!matched?'<h4>Your choice / 你选的词</h4>'+wordCard(words.get(choice))+'<p>English glosses can overlap. Compare the examples; this check records whether you recalled the target word, not whether the other word is impossible in every context. / 英文释义可能交叉；请比较例句。这里记录是否回忆起目标词，不把另一个词判为所有语境下都错误。</p>':''}`}<div class="vocab-actions"><button type="button" class="btn btn-secondary" data-action="retry">Retry with answer hidden / 隐藏答案重做</button><button type="button" class="btn btn-secondary" data-action="save">${saved.includes(q.id)?'Saved for review / 已加入待复习':'Keep for review / 留待复习'}</button>${saved.includes(q.id)?'<button type="button" class="btn btn-secondary" data-action="remove">Remove from review / 移出待复习</button>':''}</div><p id="review-save-status" role="status">${storageNote()}</p>`;
 $('quiz-next-btn').hidden=false;feedback.querySelector('h3').focus();
}
function results(){
 const records=Object.values(first),matched=records.filter(r=>r.matched).length;
 $('quiz-progress').textContent='Session review / 本轮回顾';$('quiz-next-btn').hidden=true;
 const missed=Object.keys(first).filter(id=>!first[id].matched);
 $('quiz-body').innerHTML=`<h3 tabindex="-1">First attempts / 本轮首次作答</h3><p class="meaning-prompt">${matched} matched · ${records.length-matched} to review</p><p>${records.length} distinct exercises attempted in this session (starting set: ${initialSize}). Retries do not add points, and quiz results do not mark words as mastered. / 本轮已作答 ${records.length} 道不同题目，起始题组 ${initialSize} 道；重做不重复计分，也不自动标记掌握。</p><ul class="vocab-review-list">${missed.map(id=>{const q=resolve(id),r=first[id];return `<li>${lib.escape(words.get(q.wordId).word)} — ${q.kind==='context'?'context / 语境':'meaning / 词义'}<br>Your first choice / 首次选择：${lib.escape(words.get(r.choice).word)} <button type="button" data-retry-id="${lib.escape(id)}">Retry / 重做</button></li>`;}).join('')||'<li>No unmatched first attempts in this session. / 本轮首次作答均匹配目标词。</li>'}</ul><div class="vocab-actions">${missed.length?'<button type="button" class="btn btn-primary" data-action="missed">Review this session / 重练本轮未匹配题</button>':''}<button type="button" class="btn btn-secondary" data-action="saved">Open saved review (${saved.length}) / 打开待复习</button><button type="button" class="btn btn-secondary" data-action="new">New set / 新一轮</button></div><p>${storageNote()}</p>`;focusBody();
}
function retryIds(ids){questions=ids.map(resolve).filter(Boolean);index=0;reviewing=true;roundAnswers=new Set();
 learning=window.HSK4Learning?.create('vocabulary',mode,'vocabulary-'+mode,questions.length);
 if(questions.length){learning?.start('review');learning?.retry();}render();}
$('quiz-body').addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.choice){answer(Number(b.dataset.choice));return;}
 if(b.dataset.retryId){retryIds([b.dataset.retryId]);return;}
 const action=b.dataset.action;
 if(action==='retry'){learning?.retry(questions[index].id);render();}
 if(action==='all')openQuiz(mode,true);
 if(action==='missed')retryIds(Object.keys(first).filter(id=>!first[id].matched));
 if(action==='saved')openQuiz('saved');
 if(action==='new')openQuiz(mode==='saved'?'meaning':mode);
 if(action==='save'){remember(questions[index].id);b.textContent='Saved for review / 已加入待复习';const remove=$('quiz-body').querySelector('[data-action="remove"]');if(remove){remove.disabled=false;remove.textContent='Remove from review / 移出待复习';}else b.insertAdjacentHTML('afterend','<button type="button" class="btn btn-secondary" data-action="remove">Remove from review / 移出待复习</button>');$('review-save-status').textContent=storageNote();}
 if(action==='remove'){saved=saved.filter(id=>id!==questions[index].id);save();b.disabled=true;b.textContent='Removed / 已移出';const keep=$('quiz-body').querySelector('[data-action="save"]');if(keep)keep.textContent='Keep for review / 留待复习';$('review-save-status').textContent=storageNote();}
});
$('quiz-overlay').addEventListener('keydown',event=>{
 if(event.key==='Escape'){event.preventDefault();closeQuiz();return;}
 if(event.key!=='Tab')return;
 const list=Array.from($('quiz-overlay').querySelectorAll('button:not(:disabled),a[href],summary,[tabindex="0"]')).filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));
 const firstEl=list[0],lastEl=list[list.length-1];
 if(event.shiftKey&&(document.activeElement===firstEl||!list.includes(document.activeElement))){event.preventDefault();lastEl?.focus();}
 else if(!event.shiftKey&&(document.activeElement===lastEl||!list.includes(document.activeElement))){event.preventDefault();firstEl?.focus();}
});
window.openQuiz=openQuiz;window.closeQuiz=closeQuiz;window.quizNext=()=>{if(answered){index++;render();}};
document.querySelectorAll('[data-vocab-interactive]').forEach(el=>el.hidden=false);updateReview();
})();
