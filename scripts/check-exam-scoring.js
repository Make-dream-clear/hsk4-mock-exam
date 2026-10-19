#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const scoring = require('../exam-scoring');
const root = path.join(__dirname, '..');
const index = require('../data/index.json');
let written = 0;
for (const [i, meta] of index.entries()) {
  const test = JSON.parse(fs.readFileSync(path.join(root, 'data', meta.file), 'utf8'));
  const questions = test.questions;
  const oldChoices = Object.fromEntries(questions.map((q, n) => [n, q.correct_answer_index]));
  const migrated = scoring.normalizeAnswers(questions, oldChoices);
  const result = scoring.summarize(questions, migrated);
  assert.equal(result.writingTotal, 15);
  assert.equal(result.writingAnswered, 0, 'Old choice selections must never count as written work');
  assert.equal(result.scoredTotal, i === 3 ? 84 : i === 6 ? 61 : 85);
  assert.equal(result.pct, 100);
  assert.equal(result.correct, result.scoredTotal);
  questions.forEach((q,n) => {
    assert(Number.isInteger(q.correct_answer_index) && q.correct_answer_index >= 0 && q.correct_answer_index < q.options.length);
    if (scoring.isWriting(q)) migrated[n] = '这不是经过教师评分的句子。';
    const href = scoring.resource(q).href.split('#')[0];
    assert(fs.existsSync(path.join(root, href, 'index.html')), `Missing next-step resource ${href}`);
  });
  const drafted = scoring.summarize(questions, migrated);
  assert.equal(drafted.writingAnswered, 15);
  assert.equal(drafted.correct, result.correct, 'Writing drafts must not change objective marks');
  const empty = scoring.summarize(questions, {});
  assert.equal(empty.wrong, 0);
  assert.equal(empty.unanswered, result.scoredTotal);
  assert.equal(empty.wrongIdx.length, result.scoredTotal);
  written += result.writingTotal;
}
const objective = {type:'reading_comprehension', options:['A','B'], correct_answer_index:0};
const writing = {type:'writing_construction',text:'看图造句',options:['参考答案'],correct_answer_index:0};
for (const invalid of [null, undefined, '0', -1, 2, 1.5]) {
  assert.equal(scoring.summarize([objective], {0:invalid}).unanswered, 1);
}
assert.equal(scoring.summarize([objective,objective], {0:0,1:1}).pct, 50);
assert.equal(scoring.summarize([objective,objective], {0:0}).pct, 50, 'Skips stay in objective denominator');
assert.equal(scoring.summarize([writing], {0:'我的句子'}).pct, null);
assert.equal(scoring.summarize([writing], {0:'   '}).writingAnswered, 0);
assert.equal(written,285);
console.log(`PASS ${index.length} papers: 285 written responses excluded from objective grades, legacy migration, skipped/invalid answers and all practice destinations.`);
