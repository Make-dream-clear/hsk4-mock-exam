/* Local practice only: never persist or transmit typed answers. */
(function () {
  'use strict';
  window.answer = function (btn, correct) {
    const item=btn.closest('.q-item');
    if(item.dataset.answered==='true')return;
    item.dataset.answered='true';
    item.querySelectorAll('.q-opt').forEach(o=>{
      o.disabled=true; o.classList.add('disabled');
      if(o.dataset.correct==='1')o.classList.add('correct');
    });
    if(!correct)btn.classList.add('wrong');
    item.querySelector('.q-explain').style.display='block';
    item.querySelector('.q-retry').hidden=false;
  };
  window.retryPattern=function(btn){
    const item=btn.closest('.q-item');
    if(item.dataset.answered!=='true')return;
    delete item.dataset.answered;
    item.querySelectorAll('.q-opt').forEach(o=>{o.disabled=false;o.classList.remove('disabled','correct','wrong');});
    item.querySelector('.q-explain').style.display='none';
    btn.hidden=true;item.querySelector('.q-opt').focus();
  };
  window.checkFill=function(btn){
    const item=btn.closest('.fill-item');
    if(btn.classList.contains('done'))return;
    const inputs=Array.from(item.querySelectorAll('.fill-input'));
    const values=inputs.map(i=>i.value.replace(/\s/g,''));
    const missing=values.indexOf('');
    if(missing!==-1){inputs[missing].focus();return;}
    const accepted=JSON.parse(item.dataset.answers);
    const matched=accepted.some(a=>a.length===values.length&&a.every((v,i)=>v===values[i]));
    item.dataset.result=matched?'matched':'needs_review';
    btn.classList.add('done');btn.disabled=true;
    inputs.forEach(i=>{i.disabled=true;i.classList.add(matched?'correct':'wrong');});
    const fb=item.querySelector('.fill-feedback');
    fb.className='fill-feedback show '+(matched?'pass':'fail');
    fb.textContent=(matched?'✓ Matches a reviewed answer. / 匹配参考答案。 ':'Check the intended meaning and compare. / 请对照题意复核。 ')+'Reference / 参考：'+accepted.map(a=>a.join(' / ')).join('；');
    item.querySelector('.fill-explanation').hidden=false;
    item.querySelector('.fill-retry-btn').hidden=false;
  };
  window.retryFill=function(btn){
    const item=btn.closest('.fill-item'),check=item.querySelector('.fill-check-btn');
    if(!check.classList.contains('done'))return;
    delete item.dataset.result;
    check.classList.remove('done');check.disabled=false;
    item.querySelectorAll('.fill-input').forEach(i=>{i.disabled=false;i.value='';i.classList.remove('correct','wrong');});
    const fb=item.querySelector('.fill-feedback');fb.textContent='';fb.className='fill-feedback';
    item.querySelector('.fill-explanation').hidden=true;btn.hidden=true;
    item.querySelector('.fill-input').focus();
  };
  document.querySelectorAll('.fill-input').forEach(input=>input.addEventListener('keydown',function(e){
    if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();window.checkFill(input.closest('.fill-item').querySelector('.fill-check-btn'));}
  }));
})();
