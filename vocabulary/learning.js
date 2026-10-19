(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HSK4Vocabulary=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const writtenForm=word=>word.replace(/\d+$/,'');
function hintSentence(word){const target=writtenForm(word.word);return word.example_cn.includes(target)?word.example_cn.split(target).join('___'):'';}
function shuffle(list,random=Math.random){const copy=[...list];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
function validateContext(items,words){
 const map=new Map(words.map(w=>[w.id,w])),seen=new Set();
 for(const q of items){
  if(!q.id||seen.has(q.id))throw Error('Duplicate or missing context ID');seen.add(q.id);
  if(map.get(q.wordId)?.word!==q.word)throw Error(q.id+': changed target word');
  if(q.options.length<2||new Set(q.options.map(o=>o.id)).size!==q.options.length||!q.options.some(o=>o.id===q.wordId))throw Error(q.id+': invalid options');
  for(const o of q.options)if(map.get(o.id)?.word!==o.word)throw Error(q.id+': changed option');
  if(q.stem.split('___').length!==2||!q.clue||!q.stem.includes(q.clue)||!q.translation)throw Error(q.id+': missing sentence clue');
  for(const section of ['reason','contrast','tip'])for(const lang of ['en','zh'])if(!q[section]?.[lang]?.trim())throw Error(q.id+': missing explanation');
 }
 return items;
}
function notes(q){return `<section class="vocab-explanation"><p class="vocab-credit">Mandarin Zone practice notes · 本站原创练习解析</p>${[['reason','Why this fits / 为什么选它'],['contrast','Compare the other word / 另一个词怎么用'],['tip','Check next time / 下次怎么判断']].map(([key,title])=>`<div><h4>${title}</h4><p lang="en">${escape(q[key].en)}</p><p lang="zh-CN">${escape(q[key].zh)}</p></div>`).join('')}</section>`;}
function staticLibrary(items,words){
 const map=new Map(words.map(w=>[w.id,w]));
 return `<section id="context-practice" class="vocab-context"><h2>Use words in context / 在句子里选词</h2><p>24 original exercises across 12 word pairs. Choose the best fit for the sentence and its intended English meaning. These are learning exercises, not official exam questions. / 24 道原创练习，根据语境和英文所表达的意思选词；不属于官方试题。</p><button type="button" class="btn btn-primary" data-vocab-interactive hidden onclick="openQuiz('context')">Practise matching words / 练当前筛选词</button><p>Interactive practice uses your current word filters. The reference library below always contains all 24 exercises. / 互动练习沿用词表筛选；下方参考库始终保留全部 24 题。</p><details id="context-library"><summary>Browse all 24 sentences &amp; explanations / 浏览全部句子与解析</summary>${items.map((q,i)=>`<article id="${escape(q.id)}" class="context-reference"><h3>${i+1}. ${escape(q.pair)}</h3><p class="chinese">${escape(q.stem)}</p><p>${escape(q.translation)}</p><p>${q.options.map(o=>escape(o.word)+' · '+escape(map.get(o.id).pinyin)).join(' / ')}</p><details><summary>Show answer and explanation / 查看答案与解析</summary><p class="chinese">${escape(q.stem.replace('___',q.word))}</p><p>Clue / 线索：${escape(q.clue)}</p>${notes(q)}</details></article>`).join('')}</details></section>`;
}
const meaningTokens=w=>new Set(w.meaning.toLowerCase().match(/[a-z]{3,}/g)?.filter(t=>!['the','and','for','with','one','someone','something','into','from'].includes(t))||[]);
function makeMeaning(word,all,random=Math.random){
 const targetTokens=meaningTokens(word);
 const candidates=all.filter(w=>w.id!==word.id&&writtenForm(w.word)!==writtenForm(word.word)&&w.meaning&&![...meaningTokens(w)].some(t=>targetTokens.has(t)));
 const chosen=[],seen=new Set();
 for(const candidate of shuffle(candidates,random)){
  const form=writtenForm(candidate.word);if(seen.has(form))continue;
  seen.add(form);chosen.push(candidate);if(chosen.length===3)break;
 }
 return {id:'meaning-'+word.id,kind:'meaning',wordId:word.id,options:shuffle([word,...chosen],random).map(w=>({id:w.id,word:w.word}))};
}
function makeContext(q){return {...q,kind:'context'};}
function recordFirst(records,q,choice){if(!q.options.some(o=>o.id===choice))return false;if(Object.prototype.hasOwnProperty.call(records,q.id))return false;records[q.id]={choice,matched:choice===q.wordId};return true;}
function parseReview(raw,valid){try{const ids=JSON.parse(raw);return Array.isArray(ids)?[...new Set(ids.filter(id=>typeof id==='string'&&valid.has(id)))]:[];}catch{return [];}}
return {escape,writtenForm,hintSentence,shuffle,validateContext,notes,staticLibrary,makeMeaning,makeContext,recordFirst,parseReview};
});
