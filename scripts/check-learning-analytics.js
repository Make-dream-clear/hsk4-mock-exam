'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'learning-analytics.js'), 'utf8');
function browser(host = 'hsk4.mandarinzone.com', automated = false) {
  const calls = [];
  const window = {location:{hostname:host}, navigator:{webdriver:automated}, gtag:(...args)=>calls.push(args)};
  vm.runInNewContext(source, {window});
  return {window, calls, api:window.HSK4Learning};
}
const {api,calls} = browser();
const s=api.create('grammar','quiz','ba-sentence-ba-full',2);
s.complete(); assert.equal(calls.length,0, 'A displayed page is not a started or completed practice');
s.start();s.start();
s.answer('q-1','needs_review');s.explanation('q-1');s.explanation('q-1');
s.retry('q-1');s.answer('q-1','matched');s.explanation('q-1');
s.answer('q-2','matched');s.complete();s.complete();
assert.equal(calls.filter(c=>c[1]==='learning_start').length,1);
assert.equal(calls.filter(c=>c[1]==='learning_complete').length,1);
assert.equal(calls.find(c=>c[1]==='learning_complete')[2].answered_count,2);
assert.deepEqual(calls.filter(c=>c[1]==='learning_answer').map(c=>c[2].attempt_type),['first','retry','first']);
assert.equal(calls.filter(c=>c[1]==='learning_explanation').length,2,'Rerender does not count another explanation; retry can');
api.emit('learning_answer',{learning_area:'writing',practice_mode:'essay',activity_id:'essay-1',result:'draft_started',answer:'My name is SECRET',search:'SECRET',email:'secret@example.com',question_id:'private answer!',correct_count:NaN,answered_count:-1});
const safe=calls.at(-1)[2];
for(const key of ['answer','search','email','question_id','correct_count','answered_count'])assert.ok(!(key in safe));
assert.ok(!JSON.stringify(calls).includes('SECRET'));
const n=calls.length;
api.emit('page_view',safe);api.emit('learning_start',{activity_id:'missing-classification'});
assert.equal(calls.length,n,'No extra page views or unclassified events');
for(const host of ['localhost','127.0.0.1','preview.example.com']){
  const test=browser(host);test.api.create('exam','paper','test-01',100).start();assert.equal(test.calls.length,0);
}
const robot=browser(undefined,true);robot.api.create('exam','paper','test-01',100).start();assert.equal(robot.calls.length,0);
const blocked=browser();blocked.window.gtag=()=>{throw new Error('blocked');};
assert.doesNotThrow(()=>blocked.api.create('exam','paper','test-01',100).answer('q-1','selected'));
delete blocked.window.gtag;
assert.doesNotThrow(()=>blocked.api.create('writing','picture','sentence-1',1).start());
const disabled=browser();disabled.window['ga-disable-G-L4CMDLM3DL']=true;disabled.api.create('exam','paper','test-01',100).start();assert.equal(disabled.calls.length,0);
console.log('Learning analytics: privacy allowlist, environment isolation, retry/first separation, completion and explanation deduplication passed.');

for (const mode of ['retelling','explain','roleplay','describe']) {
  const topic=browser();
  const first=topic.api.create('topics',mode,'food-culture-r20261021',4);
  first.explanation('model','requested');
  first.complete();
  assert(!topic.calls.some(c=>['learning_start','learning_complete'].includes(c[1])), 'Reading a model must not count as speaking or completing');
  first.start();
  for(let i=1;i<=4;i++)first.answer(`point-${i}`,'self_reviewed');
  first.complete({result:'self_reviewed'});first.complete({result:'self_reviewed'});
  assert.equal(topic.calls.filter(c=>c[1]==='learning_complete').length,1);
  const completed=topic.calls.find(c=>c[1]==='learning_complete')[2];
  assert.equal(completed.learning_area,'topics');assert.equal(completed.practice_mode,mode);
  assert.equal(completed.result,'self_reviewed');assert.equal(completed.answered_count,4);assert(!('correct_count' in completed));
  first.retry('whole-task');
  const retry=topic.api.create('topics',mode,'food-culture-r20261021',4);retry.start('retry');
  retry.answer('point-1','self_reviewed',{attempt_type:'retry'});
  assert.equal(topic.calls.at(-1)[2].attempt_type,'retry');
}
console.log('Topic analytics: model-only visits, four activity modes, self-review completion, no automatic score, and retry classification passed.');
