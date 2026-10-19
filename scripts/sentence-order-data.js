const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const order = require('../writing/sentence-order/learning');
const explanations = require('../exam-explanations');
const groups = {
  ba: '把 constructions / 把字句', passive: '被 constructions / 被字句',
  complement: 'Complements / 补语', connectors: 'Connecting clauses / 关联词',
  adverbs: 'Time, adverbs and negation / 时间、副词与否定',
  modifiers: 'Noun phrases / 名词修饰语', comparison: 'Comparisons / 比较',
  clause: 'Subjects, predicates and objects / 主谓宾结构'
};
module.exports = function(root) {
  const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
  const meta = read('sentence-order-notes.json');
  const curated = read('sentence-order-curated.json').map(q => ({...q, sourceAnswer: q.display, answers: [q.display, ...(q.altAnswers || [])]}));
  const items = [...curated];
  read('index.json').forEach((entry, index) => {
    const paper = read(entry.file);
    if (!entry.official && !paper.listening_audio) return;
    for (const q of paper.questions.filter(q => q.type === 'writing_construction' && q.number >= 86 && q.number <= 95 && !q.image)) {
      const sourceAnswer = q.options[q.correct_answer_index];
      if (q.learning_explanation) assert.deepEqual(explanations.validate(q), []);
      items.push({
        id: `test-${index+1}-${q.number}`, fragments: q.text.split(/[:：]/).pop().trim().split(/\s+/),
        sourceAnswer, answers: sourceAnswer.split(/\s*[/／]\s*/).filter(Boolean),
        grammar: `${(entry.title.match(/H\d{5}/)||[])[0] || `Test ${index+1}`} · 完成句子 Q${q.number}`,
        level: 4, sharedNotes: q.learning_explanation
      });
    }
  });
  assert.equal(new Set(items.map(q => q.id)).size, items.length);
  for (const item of items) {
    const annotation = meta[item.id];
    assert(annotation, `Missing sentence-order notes: ${item.id}`);
    assert.equal(annotation.sourceAnswer, item.sourceAnswer, `Review changed source answer: ${item.id}`);
    assert.deepEqual(annotation.sourceFragments, item.fragments, `Review changed tiles: ${item.id}`);
    assert(groups[annotation.group], `Unknown group: ${item.id}`);
    item.group = annotation.group;
    item.groupLabel = groups[item.group];
    const source = annotation.notes || item.sharedNotes;
    assert(source, `Missing explanation: ${item.id}`);
    item.notes = Object.fromEntries(['reason','pitfall','tip'].map(k => [k, source[k]]));
    for (const k of ['reason','pitfall','tip']) for (const lang of ['en','zh']) assert(item.notes[k] && typeof item.notes[k][lang] === 'string' && item.notes[k][lang].trim(), `Missing ${k}.${lang}: ${item.id}`);
    item.answers = [...new Map([...item.answers, ...(annotation.alternatives || [])].map(a => [order.normalize(a), a])).values()];
    for (const answer of item.answers) assert(order.tileOrder(item.fragments, answer), `Answer cannot be assembled: ${item.id} ${answer}`);
    delete item.sharedNotes;
    delete item.answer;
    delete item.altAnswers;
    delete item.display;
  }
  assert.deepEqual(Object.keys(meta).sort(), items.map(q => q.id).sort(), 'Unused sentence-order annotations');
  return items;
};
