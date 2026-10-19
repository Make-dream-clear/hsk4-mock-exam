#!/usr/bin/env node
const assert = require('node:assert/strict');
const notes = require('../exam-explanations');
const papers = [13, 14, 15].map(n => require(`../data/test-${n}.json`));

for (const paper of papers) {
  assert.equal(paper.questions.filter(q => q.learning_explanation).length, 100);
  assert.equal(paper.questions.filter(q => q.learning_explanation.evidence.source === 'transcript').length, 45);
  assert.equal(paper.questions.filter(q => q.learning_explanation.evidence.source === 'question').length, 40);
  assert.equal(paper.questions.filter(q => q.learning_explanation.evidence.source === 'reference').length, 15);
  for (const q of paper.questions) {
    assert.deepEqual(notes.validate(q), [], `Test ${paper.quiz_id} Q${q.number}`);
    const rendered = notes.render(q);
    assert(rendered.includes('lang="en"') && rendered.includes('lang="zh-CN"'));
    assert(rendered.includes('下次怎么判断'));
  }
}
const paper = papers[0];
const question = structuredClone(paper.questions[0]);
question.learning_explanation.evidence.quote = 'This sentence is not in the recording transcript.';
assert(notes.validate(question).length > 0, 'Invented evidence must fail validation');
assert.equal(notes.render(question), '', 'Invalid evidence must not be presented to learners');
const changedKey = structuredClone(paper.questions[0]);
changedKey.correct_answer_index = 1;
assert(notes.validate(changedKey).some(error => error.includes('Answer changed')));
const untranslated = structuredClone(paper.questions[0]);
delete untranslated.learning_explanation.tip.en;
assert(notes.validate(untranslated).length > 0);
const unsafeText = structuredClone(paper.questions[0]);
unsafeText.learning_explanation.reason.en = '<img src=x onerror="alert(1)">';
assert(!notes.render(unsafeText).includes('<img'));
assert(notes.render(unsafeText).includes('&lt;img'));
assert.equal(notes.render({ ...paper.questions[0], learning_explanation: undefined }), '');
console.log('PASS 300 bilingual explanations: source evidence, answer-key binding, missing translations, safe rendering and legacy fallback.');
