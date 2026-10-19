#!/usr/bin/env node
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os');
const load=require('./sentence-order-data'),order=require('../writing/sentence-order/learning');
const root=path.join(__dirname,'..'),items=load(root);
assert.equal(items.length,80);
assert.equal(items.filter(q=>q.id.startsWith('curated-')).length,10);
let expressions=0;
for(const q of items){
  assert(items.some(other=>other.id!==q.id&&other.group===q.group),'Each item needs another exercise in its group');
  for(const answer of q.answers){
    const indices=order.tileOrder(q.fragments,answer);
    assert.equal(order.evaluate(q,indices),'matched',q.id+': '+answer);
    expressions++;
  }
  assert.equal(order.evaluate(q,[0]),'incomplete');
  assert.equal(order.evaluate(q,q.fragments.map(()=>0)),'incomplete');
  assert.equal(order.evaluate(q,q.fragments.map((_,i)=>i===0?99:i)),'incomplete');
  const html=order.renderNotes(q);
  for(const language of ['en','zh-CN']) assert.equal((html.match(new RegExp('lang="'+language+'"','g'))||[]).length,3);
}
for(const id of ['test-18-86','test-18-91','test-18-95'])assert.equal(items.find(q=>q.id===id).answers.length,2,'Slash-separated source alternatives');
assert.equal(order.tileOrder(['a','ab'],'aba').join(','),'1,0','Backtrack when tile prefixes overlap');
const records={};order.recordFirst(records,'q1','incomplete');assert.deepEqual(records,{});
order.recordFirst(records,'q1','review');order.recordFirst(records,'q1','matched');assert.deepEqual(records,{q1:'review'},'Retry must retain first attempt');
order.recordFirst(records,'q2','matched');order.recordFirst(records,'q2','matched');assert.equal(Object.keys(records).length,2);
const hostile=structuredClone(items[0]);hostile.notes.tip.en='<img src=x onerror=alert(1)>';
assert(!order.renderNotes(hostile).includes('<img'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'order-source-'));fs.mkdirSync(path.join(temp,'data'));
const write=(name,value)=>fs.writeFileSync(path.join(temp,'data',name),JSON.stringify(value));
try{
  write('index.json',[]);write('sentence-order-curated.json',[{id:'one',fragments:['我','来了'],display:'我来了。',grammar:'Example',level:1}]);
  const meta={one:{sourceAnswer:'我来了。',sourceFragments:['我','来了'],group:'clause',notes:items[0].notes}};
  write('sentence-order-notes.json',meta);assert.equal(load(temp).length,1);
  meta.one.sourceAnswer='我走了。';write('sentence-order-notes.json',meta);assert.throws(()=>load(temp),/changed source answer/);
  meta.one.sourceAnswer='我来了。';meta.one.alternatives=['我我来了'];write('sentence-order-notes.json',meta);assert.throws(()=>load(temp),/cannot be assembled/);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log(`PASS ${items.length} bilingual explanations, ${expressions} buildable expressions, three dual-answer regressions, complete-tile checks, first-attempt accounting and source-drift protection.`);
