const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

// Catch source-data errors before they spread into vocabulary, topic and writing pages.
function validateLearningData(root) {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, 'data', file), 'utf8'));
  const words = read('vocabulary.json');
  assert.equal(words.length, 1000, 'Expected the 1,000 Level 4 additions');
  assert.equal(new Set(words.map(w => w.id)).size, 1000, 'Duplicate vocabulary IDs');
  for (const word of words) {
    assert(Number.isInteger(word.id) && word.id >= 1001 && word.id <= 2000, 'Invalid vocabulary ID');
    for (const key of ['word', 'pinyin', 'pos', 'meaning', 'example_cn', 'example_pinyin', 'example_en']) {
      assert(typeof word[key] === 'string' && word[key].trim(), `Missing ${key} for ${word.id}`);
    }
    // Latin abbreviations used naturally in Chinese are allowed; definition fragments are not.
    assert(!/^[a-z(]/.test(word.example_cn), `Possible definition in Chinese example ${word.id}`);
    assert(!/\b(?:measure word|to launch|to summarize|deliberately|therefore;|eco-friendly)\b/i.test(word.example_cn), `Mixed fields in ${word.id}`);
  }
  const writing = read('hsk4-characters.json').map(x => x.char);
  const readingOnly = read('hsk4-rendu-characters.json').map(x => x.char);
  assert.equal(writing.length, 150);
  assert.equal(readingOnly.length, 291);
  assert.equal(new Set([...writing, ...readingOnly]).size, 441, 'Overlapping or duplicate character sets');
  const paper = read('test-13.json');
  const explanations = require('../exam-explanations');
  for (const meta of read('index.json')) {
    for (const question of read(meta.file).questions) {
      const errors = explanations.validate(question);
      assert.equal(errors.length, 0, `${meta.file} Q${question.number}: ${errors.join('; ')}`);
    }
  }
  const prompts = read('writing-picture-prompts.json');
  assert.equal(new Set(prompts.map(p => p.question)).size, prompts.length, 'Duplicate picture prompts');
  for (const prompt of prompts) {
    const question = paper.questions.find(q => q.number === prompt.question);
    assert(question && question.type === 'writing_construction');
    assert(question.text.includes(prompt.word), 'Picture prompt keyword differs from source');
    assert(question.options[question.correct_answer_index], 'Missing reference answer');
    assert(question.image.startsWith('/test/13/img/'), 'Unexpected image source');
    assert(fs.existsSync(path.join(root, question.image)), 'Missing picture file');
    assert(prompt.alt && prompt.hint, 'Missing accessible description or learning hint');
  }
  return { words: words.length, writingCharacters: writing.length, readingCharacters: 441, picturePrompts: prompts.length };
}

module.exports = validateLearningData;
if (require.main === module) console.log(validateLearningData(path.join(__dirname, '..')));
