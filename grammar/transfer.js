/* Open-ended rewriting: self-review only, with no answer text in analytics. */
(function(){
 'use strict';
 document.querySelectorAll('.grammar-transfer').forEach(section=>{
  const input=section.querySelector('textarea'),boxes=[...section.querySelectorAll('input[type=checkbox]')];
  const feedback=section.querySelector('[role=status]'),model=section.querySelector('details'),retry=section.querySelector('[data-transfer-retry]');
  let session,started=false,round=0;
  const track=()=>session||(session=window.HSK4Learning?.create('grammar','interactive',section.dataset.slug+'-transfer-r20261021',1));
  input.addEventListener('input',()=>{
   boxes.forEach(b=>b.checked=false);feedback.textContent='';
   if(input.value.trim()&&!started){started=true;track()?.start(round?'retry':'first');track()?.answer('draft','draft_started',{attempt_type:round?'retry':'first'});}
  });
  model.addEventListener('toggle',()=>{if(model.open)track()?.explanation('model','requested');});
  section.querySelector('[data-transfer-review]').addEventListener('click',()=>{
   if(!input.value.trim()){feedback.textContent='先写出自己的句子。 / Write your sentence first.';input.focus();return;}
   if(boxes.some(b=>!b.checked)){feedback.textContent='请逐项核对题意、关系和表达；其他正确说法也可以。 / Review every point; your wording can differ.';return;}
   track()?.answer('rewrite','self_reviewed',{attempt_type:round?'retry':'review'});track()?.complete({result:'self_reviewed',answered_count:1});
   feedback.textContent='已完成本轮自查；这不是自动判对。试着再换一种说法。 / Self-reviewed, not automatically graded. Try another wording.';
   retry.hidden=false;
  });
  retry.addEventListener('click',()=>{
   track()?.retry('rewrite');round++;session=null;started=false;
   const previous=section.querySelector('[data-previous]');previous.hidden=false;previous.querySelector('p').textContent=input.value;
   input.value='';boxes.forEach(b=>b.checked=false);model.open=false;feedback.textContent='';retry.hidden=true;input.focus();
  });
 });
})();
