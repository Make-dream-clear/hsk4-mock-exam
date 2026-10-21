const fs=require('fs'),assert=require('node:assert/strict');
const lib=require('../vocabulary/learning'),words=require('../data/vocabulary.json'),contexts=require('../data/vocabulary-context.json');
lib.validateContext(contexts,words);
const transfers=contexts.flatMap(q=>q.transfer?[q.transfer]:[]);
assert.equal(transfers.length,6);
assert.equal(new Set([...contexts,...transfers].map(q=>q.id)).size,30);
for(const q of contexts.filter(q=>q.transfer)){
 assert.notEqual(q.stem,q.transfer.stem,'A transfer must use a new situation');
 assert.notEqual(q.wordId,q.transfer.wordId,'These first six transfers test a changed intended meaning');
 const broken=structuredClone(q);broken.transfer.word='错误词';
 assert.throws(()=>lib.validateContext([broken],words),/changed target/);
}
assert.equal(contexts.length,24);assert.equal(new Set(contexts.map(q=>q.pair)).size,12);assert.equal(new Set(contexts.map(q=>q.wordId)).size,24);
for(const q of contexts){
 const first={};assert(!lib.recordFirst(first,q,999999));assert(lib.recordFirst(first,q,q.options.find(o=>o.id!==q.wordId).id));assert(!lib.recordFirst(first,q,q.wordId));assert.equal(first[q.id].matched,false);
 assert(lib.notes(q).includes('lang="en"'));assert(lib.notes(q).includes('lang="zh-CN"'));
 const tampered=structuredClone(q);tampered.word='更改';assert.throws(()=>lib.validateContext([tampered],words),/changed target/);
}
for(const w of words){
 const q=lib.makeMeaning(w,words,()=>0.42);
 assert(q.options.some(o=>o.id===w.id));assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(o=>o.word)).size,4);
 assert(q.options.every(o=>words.some(v=>v.id===o.id&&v.word===o.word)));
 const hint=lib.hintSentence(w);assert(!hint.includes(lib.writtenForm(w.word)),'A hint must mask the target '+w.word);
}
const valid=new Set(['meaning-1001','context-1']);
for(const raw of ['null','{}','not json','42'])assert.deepEqual(lib.parseReview(raw,valid),[]);
assert.deepEqual(lib.parseReview('["context-1","context-1","missing",1001,"meaning-1001"]',valid),['context-1','meaning-1001']);
const hostile=structuredClone(contexts[0]);hostile.reason.en='<script>alert(1)</script>';
assert(!lib.notes(hostile).includes('<script>'));
const html=fs.readFileSync(require('path').join(__dirname,'../vocabulary/index.html'),'utf8');
assert.equal((html.match(/class="context-reference"/g)||[]).length,24);
assert.equal((html.match(/class="vocab-card"/g)||[]).length,1000);
assert.deepEqual(JSON.parse(html.match(/<script id="vocabulary-context-data" type="application\/json">([\s\S]*?)<\/script>/)[1]),contexts);
assert(html.includes('data-vocab-review'));assert(html.includes('id="study-status"'));
console.log('PASS 24 bilingual context exercises, 12 pairs, all 1,000 word quiz options, source bindings, first-attempt records, saved-review validation, escaping and native content.');
