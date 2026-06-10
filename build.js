#!/usr/bin/env node
/**
 * SEO Build Script for HSK4 Mock Exam
 *
 * Pre-renders dynamic JSON content into static HTML so search engines
 * can index vocabulary words, test questions, and other content that
 * would otherwise require JavaScript execution.
 *
 * Usage: node build.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');

// --- Helpers ---

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
}

function truncDesc(s, max) {
  max = max || 155;
  if (s.length <= max) return s;
  return s.substring(0, s.lastIndexOf(' ', max - 3)) + '...';
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateFillExercises(exercises, instruction) {
  const items = exercises.map((ex, ei) => {
    const sentenceHtml = escHtml(ex.sentence).replace('___',
      '<input type="text" class="fill-input" placeholder="?" maxlength="10" data-idx="' + ei + '">');
    const hintField = ex.hint
      ? '<div class="fill-hint" style="display:none;">' + escHtml(ex.hint) + '</div>'
      : (ex.context ? '<div class="fill-context" style="display:none;">' + escHtml(ex.context) + '</div>' : '');
    return `
    <div class="fill-item" data-answer="${escHtml(ex.answer)}">
      <div class="fill-sentence chinese">${sentenceHtml}</div>
      <button class="fill-check-btn" onclick="checkFill(this)">Check</button>
      <div class="fill-feedback"></div>
      ${hintField}
    </div>`;
  }).join('\n');

  return `
  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 8px;">Fill in the Blank / \u586B\u7A7A\u7EC3\u4E60</h2>
  <p style="color:var(--stone);font-size:14px;margin-bottom:12px;">${escHtml(instruction)}</p>
  <div class="fill-exercises">${items}</div>`;
}

// Deterministic PRNG (mulberry32) so consecutive builds produce identical
// output — quiz selections only change when the underlying word data does.
function seededRandom(seedStr) {
  let h = 1779033703;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h = (h ^= h >>> 16) >>> 0;
    return h / 4294967296;
  };
}

function generateTopicQuiz(words, seed) {
  const rand = seededRandom(seed || 'topic-quiz');
  // Pick 5 words for a vocabulary matching quiz
  const shuffled = [...words].sort(() => rand() - 0.5);
  const quizWords = shuffled.slice(0, Math.min(5, words.length));

  const quizItems = quizWords.map((w, qi) => {
    const others = words.filter(x => x.id !== w.id).sort(() => rand() - 0.5).slice(0, 2);
    const allOpts = [w, ...others].sort(() => rand() - 0.5);
    const optsHtml = allOpts.map(o => {
      if (o.id === w.id) {
        return '<button class="q-opt" data-correct="1" onclick="tqAnswer(this,true)">' + escHtml(o.meaning) + '</button>';
      }
      return '<button class="q-opt" onclick="tqAnswer(this,false)">' + escHtml(o.meaning) + '</button>';
    }).join('');
    return `
    <div class="tq-item" data-answer="${escHtml(w.meaning)}">
      <div class="tq-word chinese" style="font-size:22px;font-weight:600;margin-bottom:10px;">${escHtml(w.word)} <span style="font-size:14px;color:var(--accent);font-weight:400;">${escHtml(w.pinyin)}</span></div>
      <div class="tq-opts" style="display:flex;gap:8px;flex-wrap:wrap;">${optsHtml}</div>
      <div class="tq-feedback" style="display:none;margin-top:8px;font-size:13px;padding:8px 12px;border-radius:6px;"></div>
    </div>`;
  }).join('\n');

  return `
  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 12px;">Vocabulary Quiz / \u8BCD\u6C47\u7EC3\u4E60</h2>
  <p style="color:var(--stone);font-size:14px;margin-bottom:12px;">Match the Chinese word to its English meaning.</p>
  <div id="topic-quiz">${quizItems}</div>
  <script>
  function tqAnswer(btn, correct) {
    var item = btn.closest('.tq-item');
    if (item.dataset.done) return;
    item.dataset.done = '1';
    item.querySelectorAll('.q-opt').forEach(function(o) {
      o.classList.add('disabled');
      if (o.dataset.correct === '1') o.classList.add('correct');
    });
    var fb = item.querySelector('.tq-feedback');
    fb.style.display = 'block';
    if (correct) {
      if (!btn.classList.contains('correct')) btn.classList.add('correct');
      fb.style.background = 'var(--jade-soft)';
      fb.style.color = 'var(--jade)';
      fb.textContent = '\\u2713 Correct!';
    } else {
      btn.classList.add('wrong');
      fb.style.background = '#ffe0e0';
      fb.style.color = 'var(--accent)';
      fb.textContent = '\\u2717 The answer is: ' + item.dataset.answer;
    }
  }
  </` + `script>`;
}

// ============================================================
// 1. PRE-RENDER VOCABULARY INTO vocabulary/index.html
// ============================================================

function buildVocabulary() {
  console.log('[vocab] Pre-rendering vocabulary...');
  const words = readJSON('vocabulary.json');
  const htmlPath = path.join(ROOT, 'vocabulary', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Word -> task page mapping (shared helper; first task to claim a topic wins)
  const wordTask = buildWordTaskMap();
  const taskChip = w => {
    const t = wordTask[w.id];
    if (!t) return '';
    return `\n      <a class="vocab-task-link" href="/topics/${t.slug}/">\u{1F4DA} ${escHtml(t.task_cn)} \u2192</a>`;
  };

  // Build a static word list that crawlers can index
  // The JS will replace this on load, but crawlers see the full list
  const staticRows = words.map(w => {
    const mastered = '';
    return `<div class="vocab-card" data-id="${w.id}">
  <div class="vocab-collapsed">
    <span class="vocab-word chinese">${escHtml(w.word)}</span>
    <span class="vocab-pinyin">${escHtml(w.pinyin)}</span>
    <span class="pos-badge">${escHtml(w.pos || '')}</span>
    <span class="vocab-meaning">${escHtml(w.meaning || '')}</span>
  </div>
  <div class="vocab-expanded">
    <div class="example-block">
      <div class="example-cn chinese">${escHtml(w.example_cn || '')}</div>
      <div class="example-pinyin">${escHtml(w.example_pinyin || '')}</div>
      <div class="example-en">${escHtml(w.example_en || '')}</div>${taskChip(w)}
    </div>
  </div>
</div>`;
  }).join('\n');

  // Expose the mapping to the page's interactive renderer (compact form).
  const wordTasksJson = JSON.stringify(Object.fromEntries(
    Object.entries(wordTask).map(([id, t]) => [id, [t.slug, t.task_cn]])
  ));
  html = html.replace(/\s*<!-- WORD TASKS MAP -->[\s\S]*?<!-- \/WORD TASKS MAP -->/g, '');
  html = html.replace(/<script>\s*\/\/ === STATE ===/, `<!-- WORD TASKS MAP -->\n<script>window.WORD_TASKS = ${wordTasksJson};</script>\n<!-- /WORD TASKS MAP -->\n<script>\n// === STATE ===`);

  // Replace the #vocab-list container with freshly pre-rendered content.
  // Walk div depth instead of regexing, so this works whether the container
  // currently holds the loading spinner (pristine source) or the cards from
  // a previous build — the old spinner-only regex silently no-opped on
  // rebuilds, which is how the page got stuck at 981 words.
  const listMarker = '<div class="vocab-list" id="vocab-list">';
  const listStart = html.indexOf(listMarker);
  if (listStart !== -1) {
    const divRe = /<div\b|<\/div>/g;
    divRe.lastIndex = listStart + listMarker.length;
    let depth = 1, listEnd = -1, m;
    while ((m = divRe.exec(html)) !== null) {
      depth += m[0] === '</div>' ? -1 : 1;
      if (depth === 0) { listEnd = m.index + '</div>'.length; break; }
    }
    if (listEnd !== -1) {
      html = html.slice(0, listStart)
        + `${listMarker}\n${staticRows}\n</div>`
        + html.slice(listEnd);
    }
  }

  // Move SEO content BEFORE the vocab list so it's near the top of the page
  // We do this by replacing the existing SEO section AND injecting new content before the filter bar
  const newVocabSEO = `<section class="seo-content" style="margin-top:48px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:24px;margin-bottom:16px;">HSK 4 Vocabulary (2026 New Syllabus)</h2>
    <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
      This word list follows the <strong>2025 official HSK syllabus</strong> (published by the Center for Language Education and Cooperation, effective July 2026). The new syllabus organizes HSK 4 around 30 communicative tasks \u2014 from <a href="/topics/describe-a-person/" style="color:var(--accent);">discussing people (\u8C08\u8BBA\u67D0\u4E2A\u4EBA\u7269)</a> and <a href="/topics/emotions/" style="color:var(--accent);">emotions (\u8C08\u8BBA\u60C5\u611F\u8BDD\u9898)</a>, to <a href="/topics/daily-affairs/" style="color:var(--accent);">handling daily affairs (\u4EA4\u6D41\u3001\u5904\u7406\u65E5\u5E38\u4E8B\u52A1)</a>, to <a href="/topics/social-phenomena/" style="color:var(--accent);">discussing social phenomena (\u8C08\u8BBA\u793E\u4F1A\u73B0\u8C61)</a>. Browse vocabulary for <a href="/topics/" style="color:var(--accent);">all 30 task scenarios</a>.
    </p>

    <h3 style="font-family:'Noto Serif SC',serif;font-size:20px;margin-bottom:12px;margin-top:28px;">How HSK 4 Vocabulary Differs from HSK 3</h3>
    <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
      Under the new standard, Levels 1\u20133 cover the first 1,000 words for daily survival \u2014 ordering food, asking directions, describing your family. HSK 4 adds 1,000 new words (numbers 1001\u20132000 in the official list, for a 2,000-word cumulative vocabulary) that shift toward <strong>abstract thinking and opinion expression</strong>. The official syllabus explicitly requires you to handle \u201c\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u201d (a certain level of complexity) in conversations. This means words like \u201c\u5374\u201d (qu\u00E8, however), \u201c\u5C3D\u7BA1\u201d (j\u01D0ngu\u01CEn, despite), \u201c\u7ADF\u7136\u201d (j\u00ECngr\u00E1n, unexpectedly), and \u201c\u65E2\u7136\u201d (j\u00ECr\u00E1n, since) become essential for building the complex sentences the exam tests.
    </p>

    <h3 style="font-family:'Noto Serif SC',serif;font-size:20px;margin-bottom:12px;margin-top:28px;">Key Word Categories Added at HSK 4 (from the Official Grammar Syllabus)</h3>
    <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
      According to the 2025 grammar syllabus, HSK 4 adds these specific categories beyond HSK 3:
    </p>
    <ul style="color:var(--stone);line-height:2;margin-bottom:16px;padding-left:20px;">
      <li><strong>Degree adverbs / \u7A0B\u5EA6\u526F\u8BCD</strong>: \u5341\u5206, \u66F4\u52A0, \u7A0D, \u7A0D\u5FAE, \u5C24\u5176, \u591A\u4E48 \u2014 for expressing nuance and degree</li>
      <li><strong>Scope adverbs / \u8303\u56F4\u526F\u8BCD</strong>: \u5171, \u5168, \u5149, \u4EC5, \u4EC5\u4EC5, \u81F3\u5C11 \u2014 for being precise about quantities</li>
      <li><strong>Tone adverbs / \u8BED\u6C14\u526F\u8BCD</strong>: \u7ADF\u7136, \u7A76\u7ADF, \u6B63\u597D, \u5230\u5E95, \u96BE\u9053, \u5343\u4E07, \u786E\u5B9E, \u53EA\u597D, \u5DEE(\u4E00)\u70B9\u513F \u2014 for expressing surprise, emphasis, attitude</li>
      <li><strong>New conjunctions / \u8FDE\u8BCD</strong>: \u6B64\u5916, \u800C, \u65E2\u7136, \u751A\u81F3, \u4E0D\u8FC7, \u5E76\u4E14, \u4E0D\u5149, \u4E0D\u4EC5, \u53E6\u5916, \u8981\u662F, \u56E0\u6B64, \u7531\u4E8E, \u52A0\u4E0A \u2014 for linking complex sentences</li>
      <li><strong>New measure words / \u91CF\u8BCD</strong>: \u6253, \u888B, \u68F5, \u53F0, \u5E45, \u8138, \u624B, \u76D2, \u5C4B\u5B50, \u684C\u5B50 \u2014 borrowed and specialized classifiers</li>
    </ul>

    <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
      All ${words.length} words below include pinyin, English translations, and example sentences in context. Use the flashcard and quiz modes above to practice active recall. Your progress is saved locally so you can pick up where you left off.
    </p>

    <p style="color:var(--stone);line-height:1.8;">
      Created by <a href="https://mandarinzone.com" style="color:var(--accent);">Mandarin Zone</a>, a Chinese language school in Beijing since 2008.
    </p>
  </section>`;

  // Remove the previously injected SEO section and any marker comments that
  // earlier builds accumulated (one per rebuild at one point — 42 observed).
  // Consume surrounding whitespace too: leaving it behind added one blank
  // line per rebuild.
  html = html.replace(/\s*<!-- STATIC SEO CONTENT -->[\s\S]*?<\/section>\s*(?=<!-- SEARCH & FILTER -->)/, '\n\n  ');
  html = html.replace(/<!-- STATIC SEO CONTENT -->[\s\S]*?<\/section>/, '');
  html = html.replace(/[ \t]*<!-- SEO content moved above word list -->\n?/g, '');

  // Inject SEO content BEFORE the search/filter bar so it's near the top
  html = html.replace(
    /<!-- SEARCH & FILTER -->/,
    `<!-- STATIC SEO CONTENT -->\n  ${newVocabSEO}\n\n  <!-- SEARCH & FILTER -->`
  );

  // Keep hardcoded word counts (meta description, ItemList, stat bar) in sync
  html = html.replace(
    /Master all \d{3,4} HSK 4 vocabulary words/g,
    `Master all ${words.length} HSK 4 vocabulary words`
  );
  html = html.replace(
    /"numberOfItems": \d{3,4}/g,
    `"numberOfItems": ${words.length}`
  );
  html = html.replace(
    /(id="stat-total">)\d{3,4}(<)/,
    `$1${words.length}$2`
  );
  html = html.replace(
    /(id="stat-remaining">)\d{3,4}(<)/,
    `$1${words.length}$2`
  );
  html = html.replace(
    /(id="progress-mastered">0<\/strong> \/ <strong>)\d{3,4}(<\/strong>)/,
    `$1${words.length}$2`
  );

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`[vocab] Pre-rendered ${words.length} words into vocabulary/index.html`);
}

// ============================================================
// 2. GENERATE STATIC TEST PAGES: /test/01/index.html ...
// ============================================================

function buildTestPages() {
  console.log('[tests] Generating static test pages...');
  const index = readJSON('index.json');

  index.forEach((meta, i) => {
    const num = String(i + 1).padStart(2, '0');
    const test = readJSON(meta.file);
    const dir = path.join(ROOT, 'test', num);
    ensureDir(dir);

    const typeLabels = {
      listening_true_false: 'Listening \u00B7 \u542C\u529B\u5224\u65AD',
      listening_choice: 'Listening \u00B7 \u542C\u529B\u9009\u62E9',
      fill_in_blank: 'Reading \u00B7 \u9009\u8BCD\u586B\u7A7A',
      reading_ordering: 'Reading \u00B7 \u8BED\u53E5\u6392\u5E8F',
      reading_comprehension: 'Reading \u00B7 \u9605\u8BFB\u7406\u89E3',
      writing_construction: 'Writing \u00B7 \u770B\u56FE\u9020\u53E5',
      choice: 'Writing \u00B7 \u4E66\u5199',
    };

    // Group questions by section
    const sections = {};
    test.questions.forEach(q => {
      const label = typeLabels[q.type] || 'Question';
      if (!sections[label]) sections[label] = [];
      sections[label].push(q);
    });

    const questionsHtml = Object.entries(sections).map(([section, qs]) => {
      const qsHtml = qs.map(q => {
        const markers = ['A', 'B', 'C', 'D', 'E', 'F'];
        const optionsHtml = q.options.map((opt, oi) =>
          `<div class="static-option"><span class="static-marker">${markers[oi] || oi + 1}</span> <span class="chinese">${escHtml(opt)}</span></div>`
        ).join('\n            ');

        const hasAnswer = typeof q.correct_answer_index === 'number' && q.options[q.correct_answer_index] !== undefined;
        const answerHtml = hasAnswer ? `
            <details class="static-answer">
              <summary>Show answer${q.explanation ? ' & explanation' : ''} / \u67E5\u770B\u7B54\u6848${q.explanation ? '\u4E0E\u89E3\u6790' : ''}</summary>
              <div class="static-answer-body">
                <div class="static-answer-line">\u2713 <strong>${markers[q.correct_answer_index] || q.correct_answer_index + 1}. <span class="chinese">${escHtml(q.options[q.correct_answer_index])}</span></strong></div>
                ${q.explanation ? `<div class="static-explanation">${escHtml(q.explanation)}</div>` : ''}
              </div>
            </details>` : '';

        return `
          <div class="static-question">
            <div class="static-q-num">Question ${q.number}</div>
            ${q.text ? `<div class="static-q-text chinese">${escHtml(q.text)}</div>` : ''}
            <div class="static-options">
            ${optionsHtml}
            </div>${answerHtml}
          </div>`;
      }).join('\n');

      return `
        <div class="static-section">
          <h3 class="static-section-title">${escHtml(section)}</h3>
          ${qsHtml}
        </div>`;
    }).join('\n');

    // Count by type
    const listeningCount = test.questions.filter(q => q.type && q.type.startsWith('listening')).length;
    const readingCount = test.questions.filter(q => q.type && (q.type.startsWith('reading') || q.type === 'fill_in_blank')).length;
    const writingCount = test.questions.filter(q => q.type === 'choice' || q.type === 'writing_construction').length;

    const isComplete = writingCount > 0;
    const coverageLabel = isComplete
      ? `Listening + Reading + Writing`
      : `Listening + Reading only`;
    const coverageBadge = isComplete
      ? `<span style="display:inline-block;background:var(--jade-soft);color:var(--jade);font-size:12px;font-weight:600;padding:3px 10px;border-radius:6px;margin-left:8px;">Complete Mock</span>`
      : `<span style="display:inline-block;background:var(--gold-soft);color:var(--gold);font-size:12px;font-weight:600;padding:3px 10px;border-radius:6px;margin-left:8px;">Listening + Reading</span>`;
    const coverageNote = isComplete
      ? ''
      : `<div style="background:var(--gold-soft);border:1px solid #e8d5a0;border-radius:var(--radius);padding:14px 18px;margin:16px 0;font-size:14px;line-height:1.6;color:var(--gold);">
      <strong>Note:</strong> This test covers listening and reading sections only. The writing section (sentence construction) cannot be auto-scored in our online format. For writing practice, see our <a href="/writing/sentence-order/" style="color:var(--gold);font-weight:600;">sentence ordering exercises</a> and <a href="/writing/paragraph/" style="color:var(--gold);font-weight:600;">paragraph writing practice</a>.
    </div>`;

    // Honest label for tests that ship fewer than the standard 100 questions
    const partialNote = (isComplete && test.questions.length < 100)
      ? `<div style="background:var(--gold-soft);border:1px solid #e8d5a0;border-radius:var(--radius);padding:14px 18px;margin:16px 0;font-size:14px;line-height:1.6;color:var(--gold);">
      <strong>Note:</strong> This is a partial test with ${test.questions.length} questions (the standard HSK 4 paper has 100: 45 listening + 40 reading + 15 writing). It still auto-scores and is great for extra practice — for a full-length simulation, start with <a href="/test/01/" style="color:var(--gold);font-weight:600;">Test 01</a>.
    </div>`
      : '';

    // Standardized HSK 4 mock test title across all 12 tests
    const shortTitle = `HSK 4 Mock Test ${num}`;
    const pageTitle = `${shortTitle} \u2014 ${meta.questions} Free Questions \u00B7 \u6A21\u62DF\u8BD5\u5377 | Mandarin Zone`;
    // CTR-oriented copy: action verb ("Take") up front, "free" prominent,
    // concrete numbers, trust closer ("Mandarin Zone Beijing"). Targets
    // 130-155 chars to fill the SERP snippet without being clipped.
    const totalQ = listeningCount + readingCount + writingCount;
    const pageDesc = truncDesc(isComplete
      ? `Take HSK 4 mock test #${num} free — ${totalQ} questions (${listeningCount} listening + ${readingCount} reading + ${writingCount} writing), auto-scored with full answer keys. 2026 syllabus, by Mandarin Zone.`
      : `Take HSK 4 mock test #${num} free — ${totalQ} questions (${listeningCount} listening + ${readingCount} reading), auto-scored with full answer keys. 2026 syllabus, by Mandarin Zone Beijing.`);

    // Extract sample reading passages for this test (unique content per page)
    const readingQs = test.questions.filter(q => q.text && q.text.length > 50);
    const sampleTopics = readingQs.slice(0, 3).map(q => {
      const text = q.text.substring(0, 60).replace(/\n/g, ' ');
      return text;
    });

    // Count question types for this specific test
    const typeCounts = {};
    test.questions.forEach(q => {
      const t = q.type || 'unknown';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const typeBreakdown = Object.entries(typeCounts)
      .map(([t, c]) => `${c} ${(typeLabels[t] || t).split(' · ')[0].toLowerCase()}`)
      .join(', ');

    const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(pageTitle)}</title>
<meta name="description" content="${escHtml(pageDesc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/test/${num}/">

<meta property="og:title" content="${escHtml(meta.title)} \u2014 Free HSK 4 Practice Test">
<meta property="og:description" content="${escHtml(pageDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/test/${num}/">
<meta property="og:site_name" content="Mandarin Zone">
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="zh_CN">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(meta.title)}">
<meta name="twitter:description" content="${escHtml(pageDesc)}">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Quiz",
  "name": "${escHtml(meta.title)}",
  "description": "${escHtml(pageDesc)}",
  "url": "https://hsk4.mandarinzone.com/test/${num}/",
  "educationalLevel": "Intermediate",
  "inLanguage": ["en", "zh-CN"],
  "isAccessibleForFree": true,
  "author": {
    "@type": "Organization",
    "name": "Mandarin Zone",
    "url": "https://mandarinzone.com"
  },
  "about": {
    "@type": "Thing",
    "name": "HSK 4 Chinese Proficiency Test"
  },
  "hasPart": [
    {
      "@type": "Quiz",
      "name": "Listening Section",
      "description": "${listeningCount} listening comprehension questions with audio"
    },
    {
      "@type": "Quiz",
      "name": "Reading Section",
      "description": "${readingCount} reading comprehension and vocabulary questions"
    },
    {
      "@type": "Quiz",
      "name": "Writing Section",
      "description": "${writingCount} sentence construction questions"
    }
  ]
}
</script>

<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<style>
  .test-hero { text-align: center; padding: 40px 0 32px; }
  .test-hero h1 { font-family: 'Noto Serif SC', serif; font-size: clamp(22px, 4vw, 32px); margin-bottom: 12px; }
  .test-meta { display: flex; justify-content: center; gap: 24px; color: var(--stone); font-size: 14px; margin-bottom: 24px; flex-wrap: wrap; }
  .test-meta-item { display: flex; align-items: center; gap: 6px; }
  .start-btn-wrap { margin: 24px 0 40px; text-align: center; }

  .static-section { margin-bottom: 40px; }
  .static-section-title {
    font-family: 'Noto Serif SC', serif;
    font-size: 20px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--mist);
    margin-bottom: 20px;
    color: var(--ink);
  }
  .static-answer { margin-top: 10px; }
  .static-answer summary { cursor: pointer; font-size: 13px; color: var(--accent); font-weight: 600; }
  .static-answer-body { margin-top: 8px; padding: 10px 14px; background: var(--paper); border-left: 3px solid var(--jade, #38a169); border-radius: 6px; }
  .static-answer-line { font-size: 14px; }
  .static-explanation { margin-top: 6px; font-size: 13px; color: var(--stone); line-height: 1.7; }
  .static-question {
    background: white;
    border: 1px solid var(--mist);
    border-radius: var(--radius);
    padding: 20px 24px;
    margin-bottom: 12px;
  }
  .static-q-num { font-size: 13px; color: var(--stone); font-weight: 500; margin-bottom: 8px; }
  .static-q-text { font-size: 16px; line-height: 1.8; margin-bottom: 14px; white-space: pre-wrap; }
  .static-options { display: flex; flex-direction: column; gap: 6px; }
  .static-option {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 14px;
    border: 1px solid var(--mist);
    border-radius: 8px;
    font-size: 15px;
    line-height: 1.5;
  }
  .static-marker {
    min-width: 24px; height: 24px;
    border-radius: 50%;
    border: 2px solid var(--mist);
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600; color: var(--stone);
  }

  .breadcrumb { font-size: 13px; color: var(--stone); margin-bottom: 8px; }
  .breadcrumb a { color: var(--accent); text-decoration: none; }
  .breadcrumb a:hover { text-decoration: underline; }

  .test-nav { display: flex; justify-content: space-between; margin: 40px 0; flex-wrap: wrap; gap: 12px; }

  @media (max-width: 600px) {
    .static-question { padding: 16px; }
  }
</style>
</head>
<body>

<header>
  <div class="header-inner">
    <a href="/" class="logo">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="logo-mark" loading="eager">
      <div class="logo-text">HSK 4 <span>Mock Exam</span></div>
    </a>
    <nav class="site-nav" aria-label="Primary">
      <a href="/" class="nav-link">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link">Vocabulary</a>
      <a href="/characters/" class="nav-link">Characters</a>
      <a href="/grammar/" class="nav-link">Grammar</a>
      <a href="/sentences/" class="nav-link">Sentences</a>
      <a href="/strategies/" class="nav-link">Strategies</a>
      <a href="/traps/" class="nav-link">Traps</a>
      <a href="/topics/" class="nav-link">Topics</a>
      <a href="/words/" class="nav-link">Words</a>
      <a href="/compare/" class="nav-link">Compare</a>
      <a href="/guide/" class="nav-link">Guide</a>
    </nav>
  </div>
</header>

<main>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/">Mock Exams</a> &rsaquo; Test ${num}
  </nav>

  <div class="test-hero">
    <h1 class="chinese">${escHtml(meta.title)} ${coverageBadge}</h1>
    <div class="test-meta">
      <span class="test-meta-item">${meta.questions} questions</span>
      <span class="test-meta-item">${listeningCount} listening</span>
      <span class="test-meta-item">${readingCount} reading</span>
      ${writingCount > 0 ? `<span class="test-meta-item">${writingCount} writing</span>` : ''}
      <span class="test-meta-item">~50 min</span>
    </div>
    ${coverageNote}
    ${partialNote}
    <p style="color:var(--stone);max-width:560px;margin:0 auto 24px;">
      Take this HSK 4 practice test interactively with instant scoring, or scroll down to review all ${meta.questions} questions.
    </p>
    <div class="start-btn-wrap">
      <a href="/?start=${i}" class="btn btn-primary" style="padding:14px 36px;font-size:16px;">Start Interactive Test</a>
    </div>
  </div>

  <div class="section-title">All Questions / \u5168\u90E8\u9898\u76EE</div>
  ${questionsHtml}

  <div class="test-nav">
    ${i > 0 ? `<a href="/test/${String(i).padStart(2, '0')}/" class="btn btn-ghost">&larr; Test ${String(i).padStart(2, '0')}</a>` : '<span></span>'}
    <a href="/" class="btn btn-secondary">All Tests</a>
    ${i < index.length - 1 ? `<a href="/test/${String(i + 2).padStart(2, '0')}/" class="btn btn-ghost">Test ${String(i + 2).padStart(2, '0')} &rarr;</a>` : '<span></span>'}
  </div>

  <section style="margin-top:40px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin-bottom:14px;">About Test ${num}</h2>
    <p style="color:var(--stone);line-height:1.8;margin-bottom:14px;">
      Test ${num} contains ${meta.questions} questions: ${typeBreakdown}. ${isComplete ? 'This is a complete mock covering all three sections of the HSK 4 exam.' : 'This test covers the listening and reading sections. The writing section (sentence construction from given words) is not included because it requires manual scoring that cannot be automated online.'} You can <a href="/?start=${i}" style="color:var(--accent);">take it interactively</a> with automatic scoring. The pass mark for the real HSK 4 exam is 180/300 (60%).
    </p>
    ${sampleTopics.length > 0 ? `<p style="color:var(--stone);line-height:1.8;margin-bottom:14px;">
      Reading passages in this test cover topics such as: ${sampleTopics.map(t => '\u201c' + escHtml(t) + '\u2026\u201d').join(', ')}. These reflect the HSK 4 syllabus requirement to handle real-world topics with a certain level of complexity.
    </p>` : ''}
    <p style="color:var(--stone);line-height:1.8;">
      Browse all 12 HSK 4 mock tests on the <a href="/" style="color:var(--accent);">free HSK 4 practice test homepage</a>, or study with our <a href="/vocabulary/" style="color:var(--accent);">1000-word HSK 4 vocabulary list</a>, <a href="/grammar/" style="color:var(--accent);">HSK 4 grammar guide</a>, <a href="/sentences/" style="color:var(--accent);">100 essential HSK 4 sentence patterns</a>, <a href="/writing/" style="color:var(--accent);">HSK 4 writing exercises</a>, or compare difficulty levels with our <a href="/compare/hsk4-vs-hsk3/" style="color:var(--accent);">HSK 4 vs HSK 3</a> and <a href="/compare/hsk4-vs-hsk5/" style="color:var(--accent);">HSK 4 vs HSK 5</a> guides.
    </p>
  </section>

  <section style="margin-top:32px;background:var(--gold-soft);border-radius:var(--radius);padding:24px 28px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin-bottom:12px;">Before You Start Test ${num} — HSK 4 Strategies / 应试技巧</h2>
    <p style="color:var(--stone);line-height:1.7;margin-bottom:14px;">
      Read the relevant strategy guide first to gain 15-30 score points on this mock exam:
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:10px;">
      <a href="/strategies/listening-judgment/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:10px 14px;text-decoration:none;color:var(--ink);font-size:13px;">听力判断 (Q1-10) →</a>
      <a href="/strategies/listening-dialog/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:10px 14px;text-decoration:none;color:var(--ink);font-size:13px;">听力短对话 (Q11-25) →</a>
      <a href="/strategies/listening-passage/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:10px 14px;text-decoration:none;color:var(--ink);font-size:13px;">听力长对话 (Q26-45) →</a>
      <a href="/strategies/listening-keywords/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:10px 14px;text-decoration:none;color:var(--ink);font-size:13px;">听力信号词 →</a>
      <a href="/strategies/reading-fill/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:10px 14px;text-decoration:none;color:var(--ink);font-size:13px;">阅读选词填空 (Q46-55) →</a>
      <a href="/strategies/reading-ordering/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:10px 14px;text-decoration:none;color:var(--ink);font-size:13px;">阅读排序 (Q56-65) →</a>
      <a href="/strategies/reading-comprehension/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:10px 14px;text-decoration:none;color:var(--ink);font-size:13px;">阅读理解 (Q66-85) →</a>
      ${isComplete ? '<a href="/strategies/writing-construction/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:10px 14px;text-decoration:none;color:var(--ink);font-size:13px;">书写排词 (Q86-95) →</a><a href="/strategies/picture-templates/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:10px 14px;text-decoration:none;color:var(--ink);font-size:13px;">看图造句 (Q96-100) →</a>' : ''}
    </div>
    <p style="margin-top:14px;color:var(--stone);font-size:13px;">
      Or jump to the <a href="/strategies/" style="color:var(--accent);font-weight:600;">complete HSK 4 strategy hub</a> &middot; <a href="/sentences/" style="color:var(--accent);font-weight:600;">100 essential sentences</a> &middot; <a href="/grammar/measure-words/" style="color:var(--accent);font-weight:600;">HSK 4 measure words (量词)</a> &middot; <a href="/words/" style="color:var(--accent);font-weight:600;">43 confusable pairs</a>.
    </p>
  </section>

  <div class="cta-banner">
    <h3 class="chinese">\u60F3\u8981\u66F4\u7CFB\u7EDF\u5730\u5B66\u4E2D\u6587\uFF1F</h3>
    <p>Mandarin Zone \u2014 Learn Chinese in Beijing & Online since 2008</p>
    <a href="https://mandarinzone.com" target="_blank" rel="noopener" class="btn btn-primary">Visit Mandarin Zone</a>
    <a href="https://www.mandarinzone.com/contact-us/" target="_blank" rel="noopener" class="cta-link">Have questions? Contact us &rarr;</a>
  </div>
</main>

<footer>
  <div class="footer-brand">
    <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="footer-brand-link">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="footer-logo" loading="lazy">
      <div>
        <div class="footer-brand-name">Mandarin Zone</div>
        <div class="footer-tagline">Learn Chinese in Beijing &amp; Online \u00b7 Since 2008</div>
      </div>
    </a>
    <div class="footer-cta">
      <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="btn btn-ghost">Visit Website</a>
      <a href="https://www.mandarinzone.com/contact-us/" target="_blank" rel="noopener" class="btn btn-ghost">Contact Us</a>
    </div>
  </div>
  <p class="footer-links" style="margin-top:4px;"><a href="/">Mock Exams</a> \u00B7 <a href="/vocabulary/">Vocabulary</a> \u00B7 <a href="/grammar/">Grammar</a> \u00B7 <a href="/writing/">Writing</a> \u00B7 <a href="/guide/">Study Guide</a> \u00B7 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
</footer>

</body>
</html>`;

    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml, 'utf8');
    console.log(`[tests] Generated test/${num}/index.html (${meta.questions} questions)`);
  });
}

// ============================================================
// 3. REWRITE HOMEPAGE SEO CONTENT
// ============================================================

function buildHomepage() {
  console.log('[home] Rewriting homepage SEO content...');
  const htmlPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Add links to static test pages in the test grid's noscript fallback
  const index = readJSON('index.json');
  // Check which tests have writing questions
  const testLinks = index.map((meta, i) => {
    const num = String(i + 1).padStart(2, '0');
    const test = readJSON(meta.file);
    const hasWriting = test.questions.some(q => q.type === 'writing_construction');
    const label = hasWriting ? '' : ' (Listening + Reading)';
    return `      <li><a href="/test/${num}/">${escHtml(meta.title)} (${meta.questions} questions)${label}</a></li>`;
  }).join('\n');

  const noscriptBlock = `<noscript>
    <div style="margin:20px 0;">
      <h2 style="font-size:18px;margin-bottom:12px;">Available Tests:</h2>
      <ul style="line-height:2;padding-left:20px;">
${testLinks}
      </ul>
    </div>
  </noscript>`;

  // Remove any previously-injected noscripts that live between the spinner
  // and "Loading tests..." text, then insert exactly one fresh block.
  // (Earlier versions appended on every rebuild, accumulating duplicates.)
  html = html.replace(
    /(<div id="test-grid" class="test-grid">[\s\S]*?<div class="spinner"><\/div>)\s*(?:<noscript>[\s\S]*?<\/noscript>\s*)*/,
    `$1\n    ${noscriptBlock}\n    `
  );

  // Replace the static SEO section with the redesigned content. Keeps the
  // 2026 syllabus claim, the format table, the 30 task topics, the grammar
  // callout, the section-by-section tips, and the 8-week study plan — but
  // reorganized into a single coherent section (toolkit -> format -> syllabus
  // -> tips -> plan) using the home-screen CSS classes defined in
  // index.html, not inline styles.
  const newSEO = `<!-- STATIC SEO CONTENT -->
    <section id="toolkit" aria-labelledby="toolkit-heading">
      <h2 class="section-title" id="toolkit-heading">Complete HSK 4 Toolkit</h2>
      <p class="section-intro">Mock exams alone won't get you to 180/300 — you need to build the underlying language. Here's everything we offer, grouped by what it does for your score.</p>

      <div class="toolkit-group toolkit-group--foundation">
        <h3 class="toolkit-group-title">📚 Foundation — Words, patterns, and topics</h3>
        <p class="toolkit-group-sub">The raw material. Without these, no strategy will save you.</p>
        <div class="toolkit-cards">
          <a href="/vocabulary/" class="toolkit-card">
            <div class="toolkit-card-tag">Vocab</div>
            <h4>1,000 HSK 4 Words</h4>
            <p>Complete word list with pinyin, examples, and topic tags. Aligned with the 2026 syllabus.</p>
          </a>
          <a href="/grammar/" class="toolkit-card">
            <div class="toolkit-card-tag">Grammar</div>
            <h4>14 Grammar Topics</h4>
            <p>把字句, 被字句, 比较句, complements, complex sentences, measure words and more.</p>
          </a>
          <a href="/sentences/" class="toolkit-card">
            <div class="toolkit-card-tag">Sentences</div>
            <h4>100 Essential Sentences</h4>
            <p>High-frequency templates for opinion, suggestion, comparison, and time — ready for the writing section.</p>
          </a>
          <a href="/topics/" class="toolkit-card">
            <div class="toolkit-card-tag">Scenarios</div>
            <h4>30 Topic Scenarios</h4>
            <p>Vocabulary by communicative situation: family, work, health, food, technology…</p>
          </a>
        </div>
      </div>

      <div class="toolkit-group toolkit-group--precision">
        <h3 class="toolkit-group-title">🔍 Precision — The details that win marks</h3>
        <p class="toolkit-group-sub">Hand-picked traps and distinctions HSK loves to test.</p>
        <div class="toolkit-cards">
          <a href="/words/" class="toolkit-card">
            <div class="toolkit-card-tag">Confusables</div>
            <h4>43 Confusable Word Pairs</h4>
            <p>才/就, 被/让/叫, 关于/对于, 从来/一直 and other tested distinctions.</p>
          </a>
          <a href="/grammar/measure-words/" class="toolkit-card">
            <div class="toolkit-card-tag">Measure Words</div>
            <h4>HSK 4 Measure Words</h4>
            <p>8 new MW (打/袋/棵/台/幅/场/顿/趟) plus borrowed measure words and a quiz.</p>
          </a>
          <a href="/writing/sentence-order/" class="toolkit-card">
            <div class="toolkit-card-tag">Writing Drill</div>
            <h4>Sentence Ordering</h4>
            <p>Targeted drills for the trickiest reading question type. Templates + answer keys.</p>
          </a>
        </div>
      </div>

      <div class="toolkit-group toolkit-group--strategy">
        <h3 class="toolkit-group-title">⚡ Strategy — How to actually pass</h3>
        <p class="toolkit-group-sub">Test-day tactics. Worth +15–30 points at the same vocabulary level.</p>
        <div class="toolkit-cards">
          <a href="/strategies/" class="toolkit-card">
            <div class="toolkit-card-tag">Strategy</div>
            <h4>9 Strategy Guides</h4>
            <p>Test-taking tips for all 7 question types + listening signal words + picture templates.</p>
          </a>
          <a href="/guide/" class="toolkit-card">
            <div class="toolkit-card-tag">Guide</div>
            <h4>HSK 4 Study Guide 2026</h4>
            <p>Exam structure, scoring, study timeline, self-assessment checklist.</p>
          </a>
          <a href="/compare/hsk4-vs-hsk3/" class="toolkit-card">
            <div class="toolkit-card-tag">Compare</div>
            <h4>HSK 4 vs HSK 3</h4>
            <p>What changes from HSK 3 to HSK 4: vocabulary, grammar, exam time, study weeks.</p>
          </a>
          <a href="/compare/hsk4-vs-hsk5/" class="toolkit-card">
            <div class="toolkit-card-tag">Compare</div>
            <h4>HSK 4 vs HSK 5</h4>
            <p>After HSK 4: 1,300 new words, advanced grammar, full essay writing.</p>
          </a>
          <a href="/compare/new-vs-old-hsk4/" class="toolkit-card">
            <div class="toolkit-card-tag">2026 Change</div>
            <h4>New vs Old HSK 4</h4>
            <p>What the July 2026 syllabus changes: 2,000 words, 150 handwriting characters, 30 tasks.</p>
          </a>
        </div>
      </div>

      <h2 class="section-title">HSK 4 Exam Format</h2>
      <p class="section-intro">100 questions, 105 minutes total. The pass mark is 180/300 (60%) — but real-world programs and visa applications often look for 240+ (80%). This is the current format, administered through June 2026; from July 2026 the revised HSK 3.0 syllabus takes effect (our mock exams follow the current format).</p>
      <div class="format-table-wrap">
        <table class="format-table">
          <thead>
            <tr>
              <th>Section</th>
              <th>Questions</th>
              <th>Time</th>
              <th>What it tests</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><span class="badge-pill badge-listening">听力 Listening</span></td><td>45</td><td>~30 min</td><td>True/false judgments, multiple choice from audio clips played once</td></tr>
            <tr><td><span class="badge-pill badge-reading">阅读 Reading</span></td><td>40</td><td>40 min</td><td>Vocabulary fill-in, sentence ordering, passage comprehension</td></tr>
            <tr><td><span class="badge-pill badge-writing">书写 Writing</span></td><td>15</td><td>25 min</td><td>Construct sentences from given words</td></tr>
            <tr class="format-table-total"><td>Total</td><td>100</td><td>~105 min</td><td>Pass mark: 180/300 (60%)</td></tr>
          </tbody>
        </table>
      </div>

      <h2 class="section-title">What the 2026 Syllabus Demands</h2>
      <p class="section-intro">The new HSK syllabus (《新版HSK考试大纲》, published November 2025, effective July 2026) raises the bar at Level 4. Unlike HSK 3 which focuses on basic daily needs, HSK 4 requires handling "有一定复杂度" (a certain level of complexity) across 30 communicative tasks, grouped here into five themes:</p>

      <h3 class="subsection-title">30 Communicative Tasks</h3>
      <div class="topics-grid">
        <div class="topics-cluster">
          <h4>👤 Personal &amp; Social</h4>
          <ul>
            <li><a href="/topics/describe-a-person/">谈论某个人物 — Discuss a person</a></li>
            <li><a href="/topics/social-expressions/">日常言语交往 — Daily verbal interactions</a></li>
            <li><a href="/topics/emotions/">谈论情感话题 — Discuss emotions</a></li>
            <li><a href="/topics/hobbies-leisure/">交流业余爱好、休闲度假 — Hobbies &amp; leisure</a></li>
            <li><a href="/topics/family-life/">交流家庭生活情况 — Family life</a></li>
            <li><a href="/topics/housing-community/">交流居住情况、社区情况 — Housing &amp; community</a></li>
          </ul>
        </div>
        <div class="topics-cluster">
          <h4>🏃 Daily Life</h4>
          <ul>
            <li><a href="/topics/daily-affairs/">交流、处理日常事务 — Handle daily affairs</a></li>
            <li><a href="/topics/food-dining/">介绍饮食情况 — Food &amp; dining</a></li>
            <li><a href="/topics/transportation/">谈论交通出行 — Transportation</a></li>
            <li><a href="/topics/shopping/">交流购物体验、商业活动内容 — Shopping experiences</a></li>
            <li><a href="/topics/health-medical/">谈论就医情况、健康生活 — Health &amp; medical</a></li>
            <li><a href="/topics/sports/">谈论体育项目及比赛 — Sports</a></li>
          </ul>
        </div>
        <div class="topics-cluster">
          <h4>🎓 Education &amp; Work</h4>
          <ul>
            <li><a href="/topics/education-learning/">谈论教学、学习情况 — Education &amp; learning</a></li>
            <li><a href="/topics/campus-life/">交流校园生活 — Campus life</a></li>
            <li><a href="/topics/education-issues/">谈论教育现象、观念 — Education phenomena</a></li>
            <li><a href="/topics/work-performance/">谈论工作情况与表现 — Work situations</a></li>
            <li><a href="/topics/career-experience/">介绍职业经历与单位情况 — Career experiences</a></li>
          </ul>
        </div>
        <div class="topics-cluster">
          <h4>🌏 Society &amp; World</h4>
          <ul>
            <li><a href="/topics/nature/">谈论自然情况 — Nature &amp; geography</a></li>
            <li><a href="/topics/environment/">谈论生活中的环保情况 — Environmental protection</a></li>
            <li><a href="/topics/technology/">介绍新技术应用及科技成果 — Technology</a></li>
            <li><a href="/topics/china-provinces/">介绍中国的主要省市、民族 — Chinese provinces &amp; ethnicities</a></li>
            <li><a href="/topics/economy/">谈论经济现象 — Economic phenomena</a></li>
            <li><a href="/topics/social-phenomena/">谈论社会现象 — Social phenomena</a></li>
            <li><a href="/topics/arts-entertainment/">介绍文艺形式、活动、作品 — Arts &amp; entertainment</a></li>
            <li><a href="/topics/international-friendship/">讲述中外友好故事 — China-world friendship</a></li>
          </ul>
        </div>
        <div class="topics-cluster">
          <h4>🏮 Culture &amp; Tradition</h4>
          <ul>
            <li><a href="/topics/proverbs-sayings/">介绍常见俗语、名言 — Proverbs &amp; sayings</a></li>
            <li><a href="/topics/food-culture/">介绍传统饮食文化 — Traditional food culture</a></li>
            <li><a href="/topics/customs-traditions/">介绍风俗传统 — Customs &amp; traditions</a></li>
            <li><a href="/topics/scenic-spots/">介绍名胜古迹 — Scenic spots &amp; historic sites</a></li>
            <li><a href="/topics/historical-figures/">介绍历史人物、历史事件 — Historical figures &amp; events</a></li>
          </ul>
        </div>
      </div>

      <h3 class="subsection-title">New Grammar Patterns at Level 4</h3>
      <div class="grammar-callout">
        <p>The official grammar syllabus adds significant complexity at Level 4. The patterns below are the highest-leverage ones to master before sitting the test:</p>
        <ul class="grammar-points">
          <li><strong>把字句2</strong> — four new structures (tentative, completed, quantified, modified)</li>
          <li><strong>被动句2</strong> — using 叫/让 instead of just 被</li>
          <li><strong>兼语句2</strong> — causative and evaluative sentences</li>
          <li><strong>比较句3</strong> — "A不如B" and "跟…相比"</li>
          <li><strong>双重否定句</strong> — for emphasis</li>
          <li><strong>复句</strong> — concessive (尽管…但是), conditional (不管…都, 无论…都), hypothetical (要是…否则)</li>
        </ul>
        <a href="/grammar/" class="learn-more">Practice each pattern in our grammar guide →</a>
      </div>

      <h2 class="section-title">Section-by-Section Tips</h2>
      <p class="section-intro">Strategy advice from the question types most often missed. Combine these with the strategy guides in the toolkit above.</p>
      <div class="tips-grid">
        <div class="tip-card tip-card--listening">
          <div class="tip-card-section">听力 Listening</div>
          <h3>Listen for meaning, not just words</h3>
          <p>The HSK 4 listening section plays each clip <strong>only once</strong>. The 判断对错 section tests inference — what the speaker really means, not what they literally said. Train yourself to ask "what does this imply?" rather than "what did I hear?"</p>
          <a href="/strategies/listening-judgment/" class="tip-link">Listening strategies →</a>
        </div>
        <div class="tip-card tip-card--reading">
          <div class="tip-card-section">阅读 Reading</div>
          <h3>Learn collocations, not just words</h3>
          <p>Fill-in-the-blank rewards collocations. Knowing 影响 means "influence" isn't enough — you need 对…产生影响. Sentence ordering follows structural templates: time/place → subject → action → result/comment.</p>
          <a href="/vocabulary/" class="tip-link">Vocab with collocations →</a>
        </div>
        <div class="tip-card tip-card--writing">
          <div class="tip-card-section">书写 Writing</div>
          <h3>Memorize sentence templates</h3>
          <p>The writing section asks you to build sentences from given words. Recognising common patterns (S+V+O+Result, Time-Place-Subject-Action) makes this section much faster. Drill the 100 essential sentences.</p>
          <a href="/sentences/" class="tip-link">Essential sentences →</a>
        </div>
      </div>

      <h2 class="section-title">8-Week Study Plan</h2>
      <p class="section-intro">Most learners pass HSK 4 in 8 weeks of focused work, given a solid HSK 3 foundation. Here's the proven sequence — and what to do in each phase.</p>
      <div class="plan-timeline">
        <div class="plan-phase">
          <div class="plan-phase-head">
            <span class="plan-week">Weeks 1–4</span>
            <span class="plan-phase-name">Build &amp; Diagnose</span>
          </div>
          <p>Take one full mock per week under timed conditions. Spend <strong>twice as long</strong> reviewing wrong answers as you spent on the test — that's where learning happens. Build vocabulary on the side using flashcards.</p>
        </div>
        <div class="plan-phase">
          <div class="plan-phase-head">
            <span class="plan-week">Weeks 5–8</span>
            <span class="plan-phase-name">Target weak section</span>
          </div>
          <p>Focus on your weakest section. Listening weak? Replay audio and shadow dialogues. Reading weak? Drill grammar patterns. Writing weak? Memorize sentence templates and ordering patterns.</p>
        </div>
        <div class="plan-phase">
          <div class="plan-phase-head">
            <span class="plan-week">Final 2 weeks</span>
            <span class="plan-phase-name">Build exam stamina</span>
          </div>
          <p>Take 2–3 full tests back-to-back to simulate exam conditions. Aim for 70%+ consistently — that gives you a 10-point cushion above the 60% pass line on test day.</p>
        </div>
      </div>
    </section>`;

  html = html.replace(
    /<!-- (?:Static SEO content for search engines|STATIC SEO CONTENT) -->[\s\S]*?<\/section>/,
    newSEO
  );

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('[home] Homepage SEO content updated');
}

// ============================================================
// 4. UPDATE SITEMAP with test pages
// ============================================================

function buildSitemap(taskSlugs, confusableSlugs, grammarPatternSlugs, characterList, extraPages) {
  console.log('[sitemap] Updating sitemap.xml...');
  const index = readJSON('index.json');
  const today = new Date().toISOString().split('T')[0];

  const existingPages = [
    { loc: '/', priority: '1.0' },
    { loc: '/vocabulary/', priority: '0.9' },
    { loc: '/characters/', priority: '0.9' },
    { loc: '/grammar/', priority: '0.8' },
    { loc: '/topics/', priority: '0.9' },
    { loc: '/guide/', priority: '0.8' },
    { loc: '/sentences/', priority: '0.9' },
    { loc: '/strategies/', priority: '0.9' },
    { loc: '/traps/', priority: '0.9' },
    { loc: '/strategies/listening-judgment/', priority: '0.8' },
    { loc: '/strategies/listening-dialog/', priority: '0.8' },
    { loc: '/strategies/listening-passage/', priority: '0.8' },
    { loc: '/strategies/listening-keywords/', priority: '0.8' },
    { loc: '/strategies/reading-fill/', priority: '0.8' },
    { loc: '/strategies/reading-ordering/', priority: '0.8' },
    { loc: '/strategies/reading-comprehension/', priority: '0.8' },
    { loc: '/strategies/writing-construction/', priority: '0.8' },
    { loc: '/strategies/picture-templates/', priority: '0.8' },
    { loc: '/grammar/ba-sentence/', priority: '0.8' },
    { loc: '/grammar/passive/', priority: '0.8' },
    { loc: '/grammar/comparison/', priority: '0.8' },
    { loc: '/grammar/complement/', priority: '0.8' },
    { loc: '/grammar/complex-sentences/', priority: '0.8' },
    { loc: '/grammar/rhetorical/', priority: '0.8' },
    { loc: '/grammar/adverbs/', priority: '0.8' },
    { loc: '/grammar/function-words/', priority: '0.8' },
    { loc: '/grammar/pivotal-sentences/', priority: '0.8' },
    { loc: '/grammar/fixed-patterns/', priority: '0.8' },
    { loc: '/grammar/measure-words/', priority: '0.8' },
    { loc: '/grammar/patterns/', priority: '0.7' },
    { loc: '/compare/', priority: '0.8' },
    { loc: '/compare/hsk4-vs-hsk3/', priority: '0.8' },
    { loc: '/compare/hsk4-vs-hsk5/', priority: '0.8' },
    { loc: '/compare/new-vs-old-hsk4/', priority: '0.9' },
    { loc: '/writing/', priority: '0.9' },
    { loc: '/writing/sentence-order/', priority: '0.8' },
    { loc: '/writing/paragraph/', priority: '0.8' },
    { loc: '/words/', priority: '0.7' },
  ];

  // Add test pages
  const testPages = index.map((_, i) => ({
    loc: `/test/${String(i + 1).padStart(2, '0')}/`,
    priority: '0.8',
  }));

  // Add task topic pages
  const taskPages = (taskSlugs || []).map(slug => ({
    loc: `/topics/${slug}/`,
    priority: '0.7',
  }));

  // Add confusable word pages
  const confusablePages = (confusableSlugs || []).map(slug => ({
    loc: `/words/${slug}/`,
    priority: '0.7',
  }));

  // Add grammar pattern pages
  const grammarPatternPages = (grammarPatternSlugs || []).map(slug => ({
    loc: `/grammar/patterns/${slug}/`,
    priority: '0.7',
  }));

  // Add character writing pages — top-30 enhanced pages get higher priority
  // than the 120 basic pages to signal Google which pages to crawl deeper.
  const enhancedSet = new Set((characterList && characterList.enhanced) || []);
  const allChars = (characterList && characterList.all) || characterList || [];
  const characterPages = allChars.map(ch => ({
    loc: `/characters/${encodeURIComponent(ch)}/`,
    priority: enhancedSet.has(ch) ? '0.8' : '0.6',
  }));
  // Recognition-character pages: lower priority than the writing set
  const recognitionPages = ((characterList && characterList.recognition) || []).map(ch => ({
    loc: `/characters/${encodeURIComponent(ch)}/`,
    priority: '0.5',
  }));

  const allPages = [...existingPages, ...testPages, ...taskPages, ...confusablePages, ...grammarPatternPages, ...characterPages, ...recognitionPages, ...(extraPages || [])];

  const urls = allPages.map(p => `  <url>
    <loc>https://hsk4.mandarinzone.com${p.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
  console.log(`[sitemap] Updated with ${allPages.length} URLs (added ${testPages.length} test pages)`);
}

// ============================================================
// 5. PRE-RENDER TOPICS PAGE
// ============================================================

function buildTopics() {
  console.log('[topics] Pre-rendering topic vocabulary...');
  const topics = readJSON('topics.json');
  const vocab = readJSON('vocabulary.json');
  const htmlPath = path.join(ROOT, 'topics', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Build a word lookup
  const wordMap = {};
  vocab.forEach(w => { wordMap[w.id] = w; });

  // Generate static HTML for each category and topic
  const categoryColors = [
    'var(--accent)', 'var(--jade)', 'var(--gold)',
    '#6b9bd2', '#9b59b6', '#e67e22', 'var(--ink)'
  ];

  const staticHtml = topics.hierarchy.map((cat, ci) => {
    const color = categoryColors[ci] || 'var(--stone)';
    const topicsHtml = cat.topics.map(topic => {
      const wordIds = topics.topic_words[topic.id] || [];
      const words = wordIds.map(id => wordMap[id]).filter(Boolean);
      if (words.length === 0) return '';

      const wordsHtml = words.map(w =>
        `<span class="static-topic-word"><span class="chinese">${escHtml(w.word)}</span> <span class="pinyin">${escHtml(w.pinyin)}</span> ${escHtml(w.meaning)}</span>`
      ).join('\n          ');

      return `
      <div class="static-topic">
        <h4 class="static-topic-name">${escHtml(topic.name)} <span class="static-topic-en">${escHtml(topic.name_en)}</span> <span class="static-topic-count">${words.length} words</span></h4>
        <div class="static-topic-words">
          ${wordsHtml}
        </div>
      </div>`;
    }).join('\n');

    return `
    <div class="static-category">
      <h3 class="static-cat-name" style="border-left:4px solid ${color};padding-left:12px;">${escHtml(cat.name)} / ${escHtml(cat.name_en)} <span class="static-cat-count">${cat.topics.length} topics</span></h3>
      ${topicsHtml}
    </div>`;
  }).join('\n');

  // CSS for static topic content
  const staticCSS = `
  <style>
  .static-topic-content { margin: 32px 0; }
  .static-category { margin-bottom: 32px; }
  .static-cat-name { font-family: 'Noto Serif SC', serif; font-size: 20px; margin-bottom: 16px; }
  .static-cat-count { font-size: 13px; color: var(--stone); font-weight: 400; }
  .static-topic { margin-bottom: 20px; padding-left: 16px; }
  .static-topic-name { font-size: 16px; font-weight: 600; margin-bottom: 8px; font-family: 'Noto Sans SC', sans-serif; }
  .static-topic-en { font-weight: 400; color: var(--stone); font-size: 14px; }
  .static-topic-count { font-size: 12px; color: var(--stone); font-weight: 400; }
  .static-topic-words { display: flex; flex-wrap: wrap; gap: 6px; }
  .static-topic-word {
    display: inline-block; padding: 4px 10px; border: 1px solid var(--mist);
    border-radius: 6px; font-size: 13px; line-height: 1.5; background: white;
  }
  .static-topic-word .pinyin { color: var(--stone); font-size: 12px; }
  </style>`;

  // Strip every previously-injected noscript block, wherever it sits. The
  // old strip only matched blocks immediately before <div id="categories">,
  // but buildTaskTopicPages later inserts its nav section in between, so
  // each rebuild appended another copy (~115 KB/build; 15 accumulated
  // blocks observed). Match on the static-topic-content marker class so
  // unrelated noscript blocks are left alone, and use a tempered pattern so
  // a match never spans past the close of the noscript it started in.
  html = html.replace(
    /\s*<noscript>(?:(?!<\/noscript>)[\s\S])*?static-topic-content[\s\S]*?<\/noscript>/g,
    ''
  );

  // Insert one fresh noscript before the empty #categories div
  html = html.replace(
    /<div id="categories"><\/div>/,
    `<noscript>${staticCSS}
  <div class="static-topic-content">
    <p style="color:var(--stone);margin-bottom:20px;">Browse HSK 4 vocabulary organized by topic. Enable JavaScript for interactive features including search, flashcards, and quizzes.</p>
    ${staticHtml}
  </div>
  </noscript>
  <div id="categories"></div>`
  );

  // Fix meta description length
  html = html.replace(
    /(<meta name="description" content=")[^"]+"/,
    '$1HSK 4 vocabulary by topic: daily life, education, work, nature, technology, society, culture. Study words by theme."'
  );

  // Fix title: 77 topics is misleading, it's 32 sub-topics across 7 categories
  html = html.replace(
    /HSK 4 Topic Vocabulary — 1000 Words by 77 Topics \| HSK4 话题词汇/g,
    'HSK 4 Topic Vocabulary \u2014 Words by Topic Category | HSK4 \u8BDD\u9898\u8BCD\u6C47'
  );
  html = html.replace(
    /HSK 4 Topic Vocabulary — 1000 Words by 77 Topics/g,
    'HSK 4 Topic Vocabulary \u2014 Words by Topic Category'
  );
  html = html.replace(
    /77 official exam topics/g,
    'official exam topic categories'
  );
  html = html.replace(
    /organized by 77 official exam topics from the HSK 3\.0 syllabus/g,
    'organized by topic categories from the official HSK syllabus'
  );
  html = html.replace(
    /Browse HSK 4 vocabulary organized by 77 official exam topics/g,
    'Browse HSK 4 vocabulary organized by official exam topic categories'
  );
  html = html.replace(
    /by 77 official exam topics from the HSK 3\.0 syllabus/g,
    'by official exam topic categories from the HSK syllabus'
  );
  html = html.replace(
    /77 specific topics/g,
    'specific topic categories'
  );
  html = html.replace(
    /across 77 real-life topics/g,
    'across real-life topic categories'
  );

  fs.writeFileSync(htmlPath, html, 'utf8');
  const totalWords = Object.values(topics.topic_words).reduce((sum, ids) => sum + ids.length, 0);
  console.log(`[topics] Pre-rendered ${topics.hierarchy.length} categories, ${totalWords} word entries into noscript block`);
}

// ============================================================
// 6. NORMALIZE GUIDE PAGE to the official 30-task wording
// ============================================================
// The official syllabus (《新版HSK考试大纲》, Nov 2025) lists tasks 1-30 in a
// single 任务大纲; items 26-30 (proverbs, food culture, customs, scenic spots,
// historical figures) are tasks too, not 话题大纲 entries. An earlier build
// rewrote the guide to "25 tasks + 5 cultural topics" -- these replacements
// undo that and are no-ops once the page is correct.

function fixGuide() {
  console.log('[guide] Normalizing task count to the official 30 tasks...');
  const htmlPath = path.join(ROOT, 'guide', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Section title
  html = html.replace(
    /25 Communicative Tasks \+ 5 Cultural Topics \/ 25个交际任务 \+ 5个文化话题/g,
    '30 Task Scenarios / 30个交际任务'
  );

  // Description paragraph
  html = html.replace(
    /defines 25 communicative tasks and 5 cultural knowledge topics/g,
    'defines exactly 30 communicative tasks'
  );

  // Intro/FAQ text about the new syllabus
  html = html.replace(
    /updated vocabulary \(~1000 words\), 25 communicative tasks and 5 cultural knowledge topics/g,
    'updated vocabulary (1,000 new Level 4 words; 2,000 cumulative), 30 communicative tasks'
  );

  // Info card
  html = html.replace(
    /<div class="info-card-num" style="color:var\(--jade\);font-size:24px;">25\+5<\/div>\s*<div class="info-card-label">Tasks & Topics<\/div>\s*<div class="info-card-detail">25 tasks \+ 5 cultural topics<\/div>/,
    `<div class="info-card-num" style="color:var(--jade);font-size:24px;">30</div>
      <div class="info-card-label">Task Scenarios</div>
      <div class="info-card-detail">Covering 7 topic categories</div>`
  );

  // Replace the misleading "not communicative tasks" note with an accurate one
  html = html.replace(
    /<p style="color:var\(--stone\);font-size:14px;margin:16px 0 8px;font-style:italic;">The following 5 items are cultural knowledge topics \(话题大纲\), not communicative tasks \(任务大纲\)\. They define background knowledge the exam may reference\.<\/p>\s*/,
    `<p style="color:var(--stone);font-size:14px;margin:16px 0 8px;font-style:italic;">Tasks 26-30 are culture-focused: the syllabus emphasizes listening, speaking and reading for them, and two (proverbs; historical figures) have no writing requirement.</p>
    `
  );

  // Restore the category header
  html = html.replace(
    /Cultural Knowledge \/ 文化知识 <span style="font-size:12px;color:var\(--stone\);font-weight:400;margin-left:4px;">\(话题大纲\)<\/span>/g,
    'Culture / 文化'
  );

  // Catch any leftover 25+5 phrasing (e.g. FAQ structured data)
  html = html.replace(
    /25 communicative tasks and 5 cultural knowledge topics/g,
    '30 communicative tasks'
  );

  // Vocabulary link count (data file has the full 1,000-word official list)
  html = html.replace(/Vocabulary \(981 words\)/g, 'Vocabulary (1,000 words)');

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('[guide] Normalized to 30 official task scenarios');
}

// ============================================================
// 7. PRE-RENDER WRITING/SENTENCE-ORDER EXERCISES
// ============================================================

function buildSentenceOrder() {
  console.log('[sentence-order] Pre-rendering exercises...');
  const htmlPath = path.join(ROOT, 'writing', 'sentence-order', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Extract EXERCISES data from the script block
  const match = html.match(/const EXERCISES = \[([\s\S]*?)\];/);
  if (!match) {
    console.log('[sentence-order] Could not find EXERCISES data, skipping');
    return;
  }

  // Parse exercise data manually (it's JS object notation, not JSON)
  const exercises = [];
  const exRegex = /fragments:\s*\[([^\]]+)\],\s*answer:\s*'([^']*)',[\s\S]*?display:\s*'([^']*)',\s*grammar:\s*'([^']*)',\s*explanation:\s*'([^']*)'/g;
  let m;
  while ((m = exRegex.exec(match[1])) !== null) {
    const frags = m[1].match(/'([^']*)'/g).map(s => s.replace(/'/g, ''));
    exercises.push({
      fragments: frags,
      display: m[3],
      grammar: m[4],
      explanation: m[5],
    });
  }

  if (exercises.length === 0) {
    console.log('[sentence-order] No exercises parsed, skipping');
    return;
  }

  // Generate static HTML for exercises
  const exercisesHtml = exercises.map((ex, i) => `
    <div class="static-exercise">
      <div class="static-ex-num">Exercise ${i + 1} <span class="static-ex-grammar">${escHtml(ex.grammar)}</span></div>
      <div class="static-ex-frags">${ex.fragments.map(f => `<span class="static-frag chinese">${escHtml(f)}</span>`).join(' ')}</div>
      <details class="static-ex-answer">
        <summary>Show correct answer</summary>
        <div class="static-ex-correct chinese">${escHtml(ex.display)}</div>
        <div class="static-ex-explain">${escHtml(ex.explanation)}</div>
      </details>
    </div>`).join('\n');

  const noscriptBlock = `<noscript>
  <style>
    .static-exercise { background:white; border:1px solid var(--mist); border-radius:var(--radius); padding:20px; margin-bottom:12px; }
    .static-ex-num { font-size:13px; font-weight:600; color:var(--stone); margin-bottom:10px; }
    .static-ex-grammar { color:var(--accent); margin-left:8px; }
    .static-ex-frags { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
    .static-frag { padding:8px 16px; border:1px solid var(--mist); border-radius:8px; font-size:16px; background:var(--paper); }
    .static-ex-answer { margin-top:8px; }
    .static-ex-answer summary { cursor:pointer; color:var(--accent); font-size:14px; font-weight:600; }
    .static-ex-correct { font-size:18px; margin:10px 0; padding:12px; background:var(--jade-soft); border-radius:8px; }
    .static-ex-explain { font-size:14px; color:var(--stone); line-height:1.7; }
  </style>
  <div style="margin:20px 0;">
    <h3 style="font-size:18px;margin-bottom:16px;">All 10 Exercises (arrange the fragments into correct sentences)</h3>
    ${exercisesHtml}
  </div>
  </noscript>`;

  // Remove all previously-injected noscript blocks (avoid duplicates across rebuilds)
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>\s*/g, '');

  // Insert a single noscript block before the exercise box
  html = html.replace(
    /<div class="exercise-nav">/,
    `${noscriptBlock}\n  <div class="exercise-nav">`
  );

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`[sentence-order] Pre-rendered ${exercises.length} exercises into noscript block`);
}

// ============================================================
// 8. ADD INTERNAL CROSS-LINKS TO GRAMMAR PAGES
// ============================================================

function addGrammarCrossLinks() {
  console.log('[grammar] Adding cross-links between grammar pages...');

  const grammarPages = [
    { dir: 'ba-sentence', name: '\u628A\u5B57\u53E5', nameEn: 'Ba-Sentence', strategy: 'writing-construction' },
    { dir: 'passive', name: '\u88AB\u5B57\u53E5', nameEn: 'Passive', strategy: 'writing-construction' },
    { dir: 'comparison', name: '\u6BD4\u8F83\u53E5', nameEn: 'Comparison', strategy: 'reading-fill' },
    { dir: 'complement', name: '\u8865\u8BED', nameEn: 'Complements', strategy: 'writing-construction' },
    { dir: 'complex-sentences', name: '\u590D\u53E5', nameEn: 'Complex Sentences', strategy: 'reading-ordering' },
    { dir: 'adverbs', name: '\u526F\u8BCD', nameEn: 'Adverbs', strategy: 'reading-fill' },
    { dir: 'function-words', name: '\u865A\u8BCD', nameEn: 'Function Words', strategy: 'reading-fill' },
    { dir: 'pivotal-sentences', name: '\u517C\u8BED\u53E5', nameEn: 'Pivotal Sentences', strategy: 'writing-construction' },
    { dir: 'fixed-patterns', name: '\u56FA\u5B9A\u642D\u914D', nameEn: 'Fixed Patterns', strategy: 'reading-fill' },
    { dir: 'rhetorical', name: '\u4FEE\u8F9E', nameEn: 'Rhetorical', strategy: 'listening-keywords' },
    { dir: 'measure-words', name: '\u91CF\u8BCD', nameEn: 'Measure Words', strategy: 'reading-fill' },
  ];

  grammarPages.forEach(page => {
    const htmlPath = path.join(ROOT, 'grammar', page.dir, 'index.html');
    if (!fs.existsSync(htmlPath)) return;
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Remove old cross-link block (legacy versions) so we can re-inject the up-to-date one
    html = html.replace(/\s*<!-- seo-cross-links -->[\s\S]*?<\/section>/, '');

    // Build links to other grammar pages (excluding self)
    const links = grammarPages
      .filter(p => p.dir !== page.dir)
      .map(p => `<a href="/grammar/${p.dir}/" style="color:var(--accent);text-decoration:none;padding:4px 12px;border:1px solid var(--mist);border-radius:6px;font-size:13px;display:inline-block;margin:3px;">${p.name} ${p.nameEn}</a>`)
      .join('\n      ');

    const crossLinkBlock = `
  <!-- seo-cross-links -->
  <section style="margin-top:32px;padding-top:24px;border-top:1px solid var(--mist);">
    <h3 style="font-size:16px;margin-bottom:12px;color:var(--stone);">Apply this HSK 4 grammar in test conditions</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px;margin-bottom:16px;">
      <a href="/strategies/${page.strategy}/" style="background:var(--accent-soft);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
        <div style="font-size:11px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">\u26A1 Strategy</div>
        <div style="font-size:14px;font-weight:600;">HSK 4 ${page.nameEn} test-taking tips</div>
      </a>
      <a href="/sentences/" style="background:var(--gold-soft);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
        <div style="font-size:11px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">\u{1F4DD} Patterns</div>
        <div style="font-size:14px;font-weight:600;">100 essential HSK 4 sentences</div>
      </a>
      <a href="/" style="background:var(--jade-soft);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
        <div style="font-size:11px;color:var(--jade);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">\u{1F3AF} Practice</div>
        <div style="font-size:14px;font-weight:600;">12 HSK 4 mock exams</div>
      </a>
    </div>
    <h3 style="font-size:16px;margin-bottom:12px;color:var(--stone);">Other HSK 4 Grammar Topics</h3>
    <div style="display:flex;flex-wrap:wrap;gap:4px;">
      ${links}
    </div>
    <p style="margin-top:16px;font-size:14px;color:var(--stone);">
      Review the full <a href="/vocabulary/" style="color:var(--accent);">HSK 4 vocabulary (1000 words)</a>, common <a href="/words/" style="color:var(--accent);">HSK 4 confusable word pairs (43)</a>, and <a href="/writing/sentence-order/" style="color:var(--accent);">sentence ordering exercises</a>. For test-day reading, see <a href="/strategies/" style="color:var(--accent);">all 9 HSK 4 strategy guides</a>.
    </p>
  </section>`;

    // Insert before closing </main>
    html = html.replace(
      /<\/main>/,
      `${crossLinkBlock}\n</main>`
    );

    fs.writeFileSync(htmlPath, html, 'utf8');
  });

  console.log(`[grammar] Added cross-links to ${grammarPages.length} grammar pages`);
}

// ============================================================
// 9. ENRICH WRITING ENTRY PAGE
// ============================================================

function buildWritingGuide() {
  console.log('[writing] Pre-rendering HSK 4 word bank into writing page...');
  const htmlPath = path.join(ROOT, 'writing', 'index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log('[writing] writing/index.html not found, skipping');
    return;
  }
  let html = fs.readFileSync(htmlPath, 'utf8');

  // The 2026 HSK 4 \u5199\u4F5C Part 1 (\u770B\u56FE\u9020\u53E5) asks the candidate to write a
  // sentence around a given word. The 1000-word HSK 4 vocabulary list \u2014 each
  // word paired with a model sentence \u2014 is the cleanest source for that
  // drill. A spread of up to LIMIT words is sampled across the whole list.
  const words = readJSON('vocabulary.json').filter(w => w && w.word && w.example_cn);
  const LIMIT = 400;
  const step = Math.max(1, Math.floor(words.length / LIMIT));
  const bank = [];
  for (let i = 0; i < words.length && bank.length < LIMIT; i += step) {
    const w = words[i];
    bank.push({
      w: w.word,
      py: (w.pinyin || '').trim(),
      m: (w.meaning || '').trim(),
      s: w.example_cn.trim()
    });
  }
  if (bank.length === 0) {
    console.log('[writing] no vocabulary words found, skipping');
    return;
  }

  // 1) JSON data block consumed by the Part 1 trainer JS
  const bankBlock = '<!-- kt-bank:start -->\n  <script id="kt-bank" type="application/json">'
    + JSON.stringify(bank) + '</script>\n  <!-- kt-bank:end -->';
  html = html.replace(/<!-- kt-bank:start -->[\s\S]*?<!-- kt-bank:end -->/, () => bankBlock);

  // 2) Static, crawlable sample (first 18 words) for SEO and no-JS users
  const seo = bank.slice(0, 18).map(item => {
    return '      <div class="kt-seo-item">\n'
      + '        <div class="kt-seo-word"><strong class="chinese">' + escHtml(item.w) + '</strong>'
      + ' <span class="kt-seo-py">' + escHtml(item.py) + '</span> \u2014 ' + escHtml(item.m) + '</div>\n'
      + '        <div class="kt-seo-eg chinese">' + escHtml(item.s) + '</div>\n'
      + '      </div>';
  }).join('\n');
  const seoBlock = '<!-- kt-seo:start -->\n' + seo + '\n      <!-- kt-seo:end -->';
  html = html.replace(/<!-- kt-seo:start -->[\s\S]*?<!-- kt-seo:end -->/, () => seoBlock);

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('[writing] Pre-rendered ' + bank.length + ' HSK 4 words into writing/index.html');
}

// ============================================================
// 10. GENERATE 30 TASK TOPIC PAGES
// ============================================================

// 30 official tasks mapped to topic IDs, descriptions, grammar links.
// Module scope: buildVocabulary also uses this to map words to task pages.
const TASKS = [
  {
    slug: 'describe-a-person', task_cn: '\u8C08\u8BBA\u67D0\u4E2A\u4EBA\u7269', task_en: 'Describe a Person',
    topic_ids: ['personal', 'social'],
    desc: 'Discuss someone\u2019s background, appearance, personality, and influence. The syllabus requires handling \u201c\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u201d (a certain complexity) \u2014 not just \u201che is tall\u201d but describing someone\u2019s career background, character traits, and impact.',
    syllabus_cn: '\u80FD\u542C\u61C2\u4ED6\u4EBA\u5173\u4E8E\u67D0\u4E2A\u719F\u4EBA\u6216\u516C\u4F17\u4EBA\u7269\u4E2A\u4EBA\u4FE1\u606F\u3001\u4E2A\u4EBA\u7279\u5F81\u65B9\u9762\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002\u5982\u5C65\u5386\u3001\u5BB6\u5EAD\u80CC\u666F\u3001\u804C\u4E1A\u80CC\u666F\u3001\u5916\u8C8C\u3001\u88C5\u626E\u3001\u6027\u683C\u3001\u5F71\u54CD\u529B\u7B49\u3002',
    grammar: ['/grammar/ba-sentence/', '/grammar/complement/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'daily-affairs', task_cn: '\u4EA4\u6D41\u3001\u5904\u7406\u65E5\u5E38\u4E8B\u52A1', task_en: 'Handle Daily Affairs',
    topic_ids: ['daily-affairs'],
    desc: 'Handle practical situations: mailing packages, processing documents, requesting help from police or translators. This task tests your ability to explain your situation and ask for assistance in real-world scenarios.',
    syllabus_cn: '\u80FD\u542C\u61C2\u65E5\u5E38\u751F\u6D3B\u4E2D\u6709\u5173\u4E1A\u52A1\u5904\u7406\u3001\u56F0\u96BE\u6C42\u52A9\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BDD\u8BED\u3002\u5982\u529E\u7406\u5FEB\u9012\u6536\u53D1\u3001\u8BC1\u4EF6\u529E\u7406\u3001\u7533\u8BF7\u4F1A\u5458\u3001\u6CD5\u5F8B\u54A8\u8BE2\u3001\u8B66\u52A1\u6C42\u52A9\u7B49\u3002',
    grammar: ['/grammar/ba-sentence/', '/grammar/passive/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'social-expressions', task_cn: '\u65E5\u5E38\u8A00\u8BED\u4EA4\u5F80', task_en: 'Daily Social Expressions',
    topic_ids: ['social', 'etiquette'],
    desc: 'Express politeness, praise, congratulations, encouragement, and apologies with appropriate complexity. At HSK 4, simple \u201c\u8C22\u8C22\u201d is not enough \u2014 you need expressions like \u201c\u8BA9\u60A8\u8D39\u5FC3\u4E86\u201d or \u201c\u592A\u611F\u8C22\u60A8\u7684\u5E2E\u52A9\u4E86\u201d.',
    syllabus_cn: '\u80FD\u542C\u61C2\u65E5\u5E38\u4EA4\u5F80\u4E2D\u5BF9\u65B9\u8868\u8FBE\u5BA2\u6C14\u3001\u8D5E\u7F8E\u3001\u795D\u8D3A\u3001\u9F13\u52B1\u3001\u6B49\u610F\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8A00\u8BED\u3002',
    grammar: ['/grammar/complement/', '/grammar/rhetorical/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'emotions', task_cn: '\u8C08\u8BBA\u60C5\u611F\u8BDD\u9898', task_en: 'Discuss Emotions',
    topic_ids: ['social', 'family'],
    desc: 'Discuss love, friendship, family bonds, and ideals. HSK 4 requires not just naming emotions but sharing experiences and opinions about them \u2014 \u201cWhat does friendship mean to you?\u201d rather than \u201cI am happy.\u201d',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u60C5\u611F\u53CA\u611F\u609F\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002\u5982\u7231\u60C5\u3001\u53CB\u60C5\u3001\u4EB2\u60C5\u3001\u7406\u60F3\u7B49\u3002',
    grammar: ['/grammar/complex-sentences/', '/grammar/adverbs/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'food-dining', task_cn: '\u4ECB\u7ECD\u996E\u98DF\u60C5\u51B5', task_en: 'Food & Dining',
    topic_ids: ['food', 'food-culture'],
    desc: 'Describe food flavors, restaurant experiences, and cooking processes. Goes beyond ordering food (HSK 3) to discussing taste, food culture, and sharing dining experiences.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u98DF\u7269\u996E\u54C1\u3001\u5C31\u9910\u60C5\u51B5\u3001\u83DC\u54C1\u5236\u4F5C\u60C5\u51B5\u7B49\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u6216\u4ECB\u7ECD\u3002\u5982\u996E\u98DF\u5473\u9053\u3001\u79CD\u7C7B\u3001\u7279\u70B9\u3001\u9910\u5385\u73AF\u5883\u3001\u670D\u52A1\u3001\u5236\u4F5C\u8FC7\u7A0B\u7B49\u3002',
    grammar: ['/grammar/complement/', '/grammar/ba-sentence/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'transportation', task_cn: '\u8C08\u8BBA\u4EA4\u901A\u51FA\u884C', task_en: 'Transportation & Travel',
    topic_ids: ['transport'],
    desc: 'Discuss travel experiences, transportation choices, trip planning, and hotel booking. Includes sharing feelings about journeys and understanding driving/traffic situations.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u4EA4\u901A\u51FA\u884C\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002\u5982\u51FA\u884C\u7ECF\u5386\u611F\u53D7\u3001\u4EA4\u901A\u5BA2\u8FD0\u60C5\u51B5\u3001\u884C\u7A0B\u8BA1\u5212\u3001\u9152\u5E97\u9884\u8BA2\u7B49\u3002',
    grammar: ['/grammar/comparison/', '/grammar/complement/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'shopping', task_cn: '\u4EA4\u6D41\u8D2D\u7269\u4F53\u9A8C\u3001\u5546\u4E1A\u6D3B\u52A8\u5185\u5BB9', task_en: 'Shopping Experiences',
    topic_ids: ['shopping'],
    desc: 'Discuss product selection, online shopping, brand choices, spending, payment methods, and sales promotions. HSK 4 goes beyond price negotiation to evaluating shopping experiences.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u5546\u54C1\u9009\u8D2D\u3001\u8D2D\u7269\u4F53\u9A8C\u3001\u5546\u4E1A\u6D3B\u52A8\u7B49\u65B9\u9762\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002\u5982\u7F51\u8D2D\u4E0E\u54C1\u724C\u9009\u62E9\u3001\u652F\u4ED8\u65B9\u5F0F\u3001\u6253\u6298\u4FC3\u9500\u7B49\u3002',
    grammar: ['/grammar/comparison/', '/grammar/adverbs/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'health-medical', task_cn: '\u8C08\u8BBA\u5C31\u533B\u60C5\u51B5\u3001\u5065\u5EB7\u751F\u6D3B', task_en: 'Health & Medical',
    topic_ids: ['health'],
    desc: 'Discuss symptoms, medical visits, health conditions, and healthy lifestyle concepts. At HSK 4 you need to describe illness experiences in detail and discuss health opinions.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u5C31\u533B\u60C5\u51B5\u3001\u5065\u5EB7\u751F\u6D3B\u60C5\u51B5\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u751F\u75C5\u75C7\u72B6\u3001\u53D7\u4F24\u60C5\u51B5\u3001\u5065\u5EB7\u89C2\u5FF5\u548C\u5E38\u8BC6\u7B49\u3002',
    grammar: ['/grammar/ba-sentence/', '/grammar/complement/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'hobbies-leisure', task_cn: '\u4EA4\u6D41\u4E1A\u4F59\u7231\u597D\u3001\u4F11\u95F2\u5EA6\u5047', task_en: 'Hobbies & Leisure',
    topic_ids: ['leisure'],
    desc: 'Discuss leisure activities, reading, internet activities, sports, fitness, travel, and parties. Share feelings and opinions about these activities.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u4F11\u95F2\u6D3B\u52A8\u60C5\u51B5\u53CA\u611F\u53D7\u3001\u770B\u6CD5\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u9605\u8BFB\u3001\u7F51\u7EDC\u6D3B\u52A8\u3001\u8FD0\u52A8\u3001\u5065\u8EAB\u3001\u65C5\u884C\u3001\u805A\u4F1A\u7B49\u3002',
    grammar: ['/grammar/adverbs/', '/grammar/complex-sentences/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'housing-community', task_cn: '\u4EA4\u6D41\u5C45\u4F4F\u60C5\u51B5\u3001\u793E\u533A\u60C5\u51B5', task_en: 'Housing & Community',
    topic_ids: ['community'],
    desc: 'Discuss living conditions, neighborhood relationships, community services, and house renting/buying. Includes understanding rental listings and community notices.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u5C45\u4F4F\u60C5\u51B5\u3001\u793E\u533A\u751F\u6D3B\u3001\u623F\u5C4B\u79DF\u8D41\u4E0E\u4E70\u5356\u7B49\u60C5\u51B5\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u5C0F\u533A\u73AF\u5883\u3001\u90BB\u91CC\u76F8\u5904\u3001\u79DF\u623F\u6761\u4EF6\u7B49\u3002',
    grammar: ['/grammar/comparison/', '/grammar/passive/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'family-life', task_cn: '\u4EA4\u6D41\u5BB6\u5EAD\u751F\u6D3B\u60C5\u51B5', task_en: 'Family Life',
    topic_ids: ['family'],
    desc: 'Discuss home life, family relationships, growing up, habits, and household affairs. Includes topics like parent-child relationships and hometown memories.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u5C45\u5BB6\u751F\u6D3B\u3001\u5BB6\u5EAD\u5173\u7CFB\u3001\u6210\u957F\u8FC7\u7A0B\u3001\u751F\u6D3B\u4E60\u60EF\u3001\u5BB6\u5EAD\u4E8B\u52A1\u7B49\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002',
    grammar: ['/grammar/complex-sentences/', '/grammar/pivotal-sentences/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'education-learning', task_cn: '\u8C08\u8BBA\u6559\u5B66\u3001\u5B66\u4E60\u60C5\u51B5', task_en: 'Education & Learning',
    topic_ids: ['study'],
    desc: 'Discuss courses, teaching activities, study experiences, exams, study plans, degrees, scholarships, and learning methods.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u8BFE\u7A0B\u60C5\u51B5\u3001\u6559\u5B66\u60C5\u51B5\u3001\u5B66\u4E60\u7ECF\u5386\u4E0E\u5FC3\u5F97\u7B49\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u8BFE\u7A0B\u3001\u4E13\u4E1A\u3001\u8003\u8BD5\u3001\u5B66\u4E1A\u89C4\u5212\u3001\u5B66\u4F4D\u5B66\u5386\u3001\u5956\u5B66\u91D1\u3001\u5B66\u4E60\u65B9\u6CD5\u7B49\u3002',
    grammar: ['/grammar/adverbs/', '/grammar/complement/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'campus-life', task_cn: '\u4EA4\u6D41\u6821\u56ED\u751F\u6D3B', task_en: 'Campus Life',
    topic_ids: ['campus', 'study'],
    desc: 'Discuss campus activities, school facilities satisfaction, graduation events, campus environment, tuition, and majors.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u6821\u56ED\u6D3B\u52A8\u3001\u5B66\u6821\u60C5\u51B5\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002\u5982\u98DF\u5802\u3001\u56FE\u4E66\u9986\u3001\u6BD5\u4E1A\u665A\u4F1A\u3001\u6821\u56ED\u73AF\u5883\u3001\u8D39\u7528\u3001\u4E13\u4E1A\u7B49\u3002',
    grammar: ['/grammar/comparison/', '/grammar/adverbs/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'education-issues', task_cn: '\u8C08\u8BBA\u6559\u80B2\u73B0\u8C61\u3001\u89C2\u5FF5', task_en: 'Education Phenomena',
    topic_ids: ['edu-issues'],
    desc: 'Discuss family education, social education concepts, college entrance exam choices, vocational education, and trending education topics.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u5BB6\u5EAD\u6559\u80B2\u3001\u793E\u4F1A\u6559\u80B2\u7B49\u6559\u80B2\u95EE\u9898\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u6559\u80B2\u76EE\u6807\u3001\u6559\u80B2\u65B9\u5F0F\u3001\u5347\u5B66\u62A5\u8003\u3001\u804C\u4E1A\u6559\u80B2\u7B49\u3002',
    grammar: ['/grammar/complex-sentences/', '/grammar/rhetorical/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'work-performance', task_cn: '\u8C08\u8BBA\u5DE5\u4F5C\u60C5\u51B5\u4E0E\u8868\u73B0', task_en: 'Work & Performance',
    topic_ids: ['office', 'workplace-social'],
    desc: 'Discuss office tasks, work performance, workplace relationships, and team activities in a professional setting.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u529E\u516C\u4E8B\u52A1\u3001\u5DE5\u4F5C\u8868\u73B0\u3001\u804C\u573A\u4EA4\u5F80\u60C5\u51B5\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u5DE5\u4F5C\u5B89\u6392\u3001\u5DE5\u4F5C\u6001\u5EA6\u80FD\u529B\u3001\u540C\u4E8B\u76F8\u5904\u3001\u56E2\u5EFA\u6D3B\u52A8\u7B49\u3002',
    grammar: ['/grammar/pivotal-sentences/', '/grammar/passive/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'career-experience', task_cn: '\u4ECB\u7ECD\u804C\u4E1A\u7ECF\u5386\u4E0E\u5355\u4F4D\u60C5\u51B5', task_en: 'Career & Company',
    topic_ids: ['career', 'company'],
    desc: 'Discuss job seeking, work experiences, career changes, recruitment, interviews, work environment, and salary/benefits.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u804C\u4E1A\u4E0E\u5DE5\u4F5C\u7ECF\u5386\u3001\u5355\u4F4D\u60C5\u51B5\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002\u5982\u6C42\u804C\u3001\u6253\u5DE5\u3001\u804C\u4F4D\u53D8\u52A8\u3001\u62DB\u8058\u5E94\u8058\u3001\u8003\u6838\u9762\u8BD5\u3001\u5DE5\u4F5C\u73AF\u5883\u4E0E\u5F85\u9047\u7B49\u3002',
    grammar: ['/grammar/passive/', '/grammar/pivotal-sentences/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'nature', task_cn: '\u8C08\u8BBA\u81EA\u7136\u60C5\u51B5', task_en: 'Nature & Geography',
    topic_ids: ['nature'],
    desc: 'Discuss geography, climate, animals, plants, natural landscapes, and weather phenomena. Includes topics like oceans, forests, stars, and seasons.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u81EA\u7136\u60C5\u51B5\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u5730\u7403\u3001\u6D77\u6D0B\u3001\u68EE\u6797\u3001\u6C14\u5019\u3001\u52A8\u690D\u7269\u3001\u81EA\u7136\u666F\u89C2\u3001\u5929\u6C14\u73B0\u8C61\u7B49\u3002',
    grammar: ['/grammar/complement/', '/grammar/comparison/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'environment', task_cn: '\u8C08\u8BBA\u751F\u6D3B\u4E2D\u7684\u73AF\u4FDD\u60C5\u51B5', task_en: 'Environmental Protection',
    topic_ids: ['environment', 'nature'],
    desc: 'Discuss environmental conditions, pollution, conservation practices, environmental laws, and green living.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u73AF\u5883\u72B6\u51B5\u3001\u73AF\u4FDD\u60C5\u51B5\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002\u5982\u73AF\u5883\u7684\u4E00\u822C\u60C5\u51B5\u3001\u6C61\u67D3\u60C5\u51B5\u3001\u73AF\u4FDD\u505A\u6CD5\u3001\u89C2\u5FF5\u3001\u76F8\u5173\u6CD5\u89C4\u7B49\u3002',
    grammar: ['/grammar/complex-sentences/', '/grammar/passive/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'technology', task_cn: '\u4ECB\u7ECD\u65B0\u6280\u672F\u5E94\u7528\u53CA\u79D1\u6280\u6210\u679C', task_en: 'Technology',
    topic_ids: ['tech', 'science'],
    desc: 'Discuss new technology applications like mobile payment and drones, practical science knowledge, and simple research findings.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u65B0\u6280\u672F\u8FD0\u7528\u3001\u79D1\u666E\u77E5\u8BC6\u3001\u79D1\u6280\u6210\u679C\u7B49\u76F8\u5173\u60C5\u51B5\u7684\u4E00\u822C\u6027\u8BE2\u95EE\u3002\u5982\u626B\u7801\u652F\u4ED8\u3001\u65E0\u4EBA\u673A\u7B49\u65B0\u6280\u672F\u3001\u5B9E\u7528\u79D1\u666E\u77E5\u8BC6\u3001\u7B80\u5355\u7684\u7814\u7A76\u53D1\u73B0\u7B49\u3002',
    grammar: ['/grammar/passive/', '/grammar/complement/'],
    skills: ['listening', 'speaking', 'reading'],
  },
  {
    slug: 'china-provinces', task_cn: '\u4ECB\u7ECD\u4E2D\u56FD\u7684\u4E3B\u8981\u7701\u5E02\u3001\u6C11\u65CF', task_en: 'China Overview',
    topic_ids: ['overview'],
    desc: 'Introduce major Chinese cities like Beijing and Yunnan, and discuss characteristics and distribution of ethnic minorities.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u4E2D\u56FD\u67D0\u4E2A\u4E3B\u8981\u7701\u5E02\u3001\u6C11\u65CF\u7684\u4E00\u822C\u6027\u8BE2\u95EE\u6216\u4ECB\u7ECD\u3002\u5982\u4E2D\u56FD\u9996\u90FD\u3001\u5404\u7701\u4E3B\u8981\u57CE\u5E02\u3001\u5C11\u6570\u6C11\u65CF\u7279\u70B9\u3001\u5206\u5E03\u7B49\u3002',
    grammar: ['/grammar/adverbs/', '/grammar/fixed-patterns/'],
    skills: ['listening', 'speaking', 'reading'],
  },
  {
    slug: 'economy', task_cn: '\u8C08\u8BBA\u7ECF\u6D4E\u73B0\u8C61', task_en: 'Economic Phenomena',
    topic_ids: ['economy'],
    desc: 'Discuss trending products, new business models (online stores, short videos, delivery economy), and economic conditions.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u6D41\u884C\u4EA7\u54C1\u3001\u65B0\u5546\u4E1A\u5F62\u6001\u3001\u7ECF\u6D4E\u72B6\u51B5\u7B49\u7ECF\u6D4E\u73B0\u8C61\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u7F51\u5E97\u3001\u77ED\u89C6\u9891\u3001\u4E0A\u95E8\u7ECF\u6D4E\u7B49\u3002',
    grammar: ['/grammar/complex-sentences/', '/grammar/adverbs/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'social-phenomena', task_cn: '\u8C08\u8BBA\u793E\u4F1A\u73B0\u8C61', task_en: 'Social Phenomena',
    topic_ids: ['social-phenomena'],
    desc: 'Discuss life attitudes (marriage, consumption), internet life and its impact, and trending social phenomena.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u751F\u6D3B\u89C2\u5FF5\u3001\u7F51\u7EDC\u751F\u6D3B\u3001\u6D41\u884C\u4E8B\u7269\u7B49\u793E\u4F1A\u73B0\u8C61\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u5A5A\u604B\u89C2\u3001\u6D88\u8D39\u89C2\u3001\u7F51\u7EDC\u751F\u6D3B\u7684\u65B9\u5F0F\u548C\u5F71\u54CD\u7B49\u3002',
    grammar: ['/grammar/complex-sentences/', '/grammar/rhetorical/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'arts-entertainment', task_cn: '\u4ECB\u7ECD\u6587\u827A\u5F62\u5F0F\u3001\u6D3B\u52A8\u3001\u4F5C\u54C1', task_en: 'Arts & Entertainment',
    topic_ids: ['arts'],
    desc: 'Discuss novels, movies, theater, performances, competitions, and introduce artists and their works.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u67D0\u79CD\u6587\u827A\u5F62\u5F0F\u3001\u6587\u827A\u6D3B\u52A8\u3001\u6587\u827A\u4F5C\u54C1\u521B\u4F5C\u8005\u53CA\u5176\u4F5C\u54C1\u7B49\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u67D0\u90E8\u5C0F\u8BF4\u3001\u7535\u5F71\u3001\u8BDD\u5267\u7684\u5927\u81F4\u5185\u5BB9\u3001\u67D0\u573A\u6587\u827A\u8868\u6F14\u3001\u67D0\u4F4D\u6B4C\u624B\u3001\u4F5C\u5BB6\u7B49\u3002',
    grammar: ['/grammar/complement/', '/grammar/fixed-patterns/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'sports', task_cn: '\u8C08\u8BBA\u4F53\u80B2\u9879\u76EE\u53CA\u6BD4\u8D5B', task_en: 'Sports',
    topic_ids: ['sports'],
    desc: 'Discuss sports like table tennis, volleyball, and badminton; competition results, player performances, and sports stories.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u4E52\u4E53\u7403\u3001\u6392\u7403\u7B49\u9879\u76EE\u60C5\u51B5\u3001\u6BD4\u8D5B\u60C5\u51B5\u3001\u4F53\u80B2\u540D\u4EBA\u53CA\u6545\u4E8B\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002',
    grammar: ['/grammar/comparison/', '/grammar/complement/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'international-friendship', task_cn: '\u8BB2\u8FF0\u4E2D\u5916\u53CB\u597D\u6545\u4E8B', task_en: 'China-World Friendship',
    topic_ids: ['exchange'],
    desc: 'Tell stories of international friendship: sister cities, cross-border friendships, study abroad experiences, and Chinese language competitions.',
    syllabus_cn: '\u80FD\u542C\u61C2\u5BF9\u65B9\u8BB2\u8FF0\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u4E2D\u5916\u53CB\u597D\u5F80\u6765\u7684\u6545\u4E8B\u53CA\u5176\u4EA7\u751F\u7684\u5F71\u54CD\u3002\u5982\u53CB\u597D\u57CE\u5E02\u3001\u53CB\u597D\u5B66\u6821\u3001\u8DE8\u56FD\u53CB\u8C0A\u3001\u7559\u5B66\u7ECF\u5386\u3001\u4E2D\u6587\u6BD4\u8D5B\u7ECF\u5386\u7B49\u3002',
    grammar: ['/grammar/complex-sentences/', '/grammar/fixed-patterns/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'proverbs-sayings', task_cn: '介绍常见俗语、名言', task_en: 'Proverbs & Sayings',
    topic_ids: ['language'],
    desc: 'Understand and roughly explain common Chinese sayings and famous quotes. The syllabus tests this receptively — recognizing what a saying means when you hear it in conversation or meet it in a short reading passage.',
    syllabus_cn: '能听懂日常交谈中别人介绍的某些中文常见俗语、名言；能大致介绍一些中文常见俗语、名言及其主要含义；能看懂介绍、解读某些中文常见俗语、名言的小短文。',
    grammar: ['/grammar/fixed-patterns/', '/grammar/rhetorical/'],
    skills: ['listening', 'speaking', 'reading'],
  },
  {
    slug: 'food-culture', task_cn: '介绍传统饮食文化', task_en: 'Traditional Food Culture',
    topic_ids: ['food-culture'],
    desc: 'Understand introductions to traditional Chinese food culture — table manners, the meaning behind certain dishes, regional flavors, and time-honored shops and brands — and write a short paragraph introducing a food tradition.',
    syllabus_cn: '能听懂朋友、同学、老师等对中国传统饮食观念、中国各地饮食特点、传统店铺、品牌等中国传统饮食文化相关情况的有一定复杂度的介绍。如中国人的餐桌礼仪、某种食物的内涵，各地饮食的风味等。',
    grammar: ['/grammar/comparison/', '/grammar/measure-words/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'customs-traditions', task_cn: '介绍风俗传统', task_en: 'Customs & Traditions',
    topic_ids: ['customs', 'etiquette'],
    desc: 'Understand and introduce Chinese folk traditions: festival customs like Spring Festival and Mid-Autumn, national arts like kung fu and Peking opera, regional traditions, and the etiquette of interacting with friends, teachers and elders.',
    syllabus_cn: '能听懂朋友、同学、老师等对中国传统节日习俗、国粹、各地传统、人际交往礼仪等中国民俗传统相关情况的有一定复杂度的介绍。如春节、中秋节等节日习俗；中国功夫、京剧等国粹；民间喜好与禁忌等。',
    grammar: ['/grammar/fixed-patterns/', '/grammar/function-words/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'scenic-spots', task_cn: '介绍名胜古迹', task_en: 'Scenic Spots & Historic Sites',
    topic_ids: ['landmarks'],
    desc: 'Understand general introductions to famous Chinese sights such as Tian’anmen and the Great Wall, introduce a sight you know, and write a short paragraph about it. A frequent theme in HSK 4 reading passages.',
    syllabus_cn: '能听懂朋友、同学、老师等对中国某个名胜古迹的一般性介绍。如天安门、长城等。能看懂介绍中国某个名胜古迹的一般性短文；能写出一段话简单介绍中国某个名胜古迹。',
    grammar: ['/grammar/comparison/', '/grammar/measure-words/'],
    skills: ['listening', 'speaking', 'reading', 'writing'],
  },
  {
    slug: 'historical-figures', task_cn: '介绍历史人物、历史事件', task_en: 'Historical Figures & Events',
    topic_ids: ['history'],
    desc: 'Understand general introductions to major Chinese historical figures and events, such as Confucius (孔子) and Laozi (老子). Tested through listening and short reading passages — no writing requirement for this task.',
    syllabus_cn: '能听懂朋友、同学、老师等对某位中国历史人物或某个中国历史事件的一般性介绍。如孔子、老子等。能看懂介绍某位中国历史人物或者某个中国历史事件的一般性短文。',
    grammar: ['/grammar/complex-sentences/', '/grammar/function-words/'],
    skills: ['listening', 'speaking', 'reading'],
  },
];

// Word id -> primary task page, derived from topics.json topic_words and
// TASKS topic_ids. Used by buildVocabulary (per-word task chips) and
// buildCharacterPages (character -> task reverse lookup).
function buildWordTaskMap() {
  const topicsData = readJSON('topics.json');
  const topicToTask = {};
  TASKS.forEach(t => (t.topic_ids || []).forEach(tid => {
    if (!topicToTask[tid]) topicToTask[tid] = t;
  }));
  const wordTask = {};
  Object.entries(topicsData.topic_words).forEach(([tid, ids]) => {
    const task = topicToTask[tid];
    if (!task) return;
    ids.forEach(id => { if (!wordTask[id]) wordTask[id] = task; });
  });
  return wordTask;
}

function buildTaskTopicPages() {
  console.log('[task-topics] Generating 30 task topic pages...');
  const topics = readJSON('topics.json');
  const vocab = readJSON('vocabulary.json');
  const dialogues = fs.existsSync(path.join(DATA, 'task-dialogues.json'))
    ? readJSON('task-dialogues.json')
    : {};
  const wordMap = {};
  vocab.forEach(w => { wordMap[w.id] = w; });

  const tasks = TASKS;

  // Skip thin pages (< 10 words). Previously economy / education-issues /
  // international-friendship were skipped; their topics have since been
  // enriched in topics.json, so all 30 official tasks now generate.
  const skipSlugs = new Set();

  tasks.forEach(task => {
    if (skipSlugs.has(task.slug)) return;
    const dir = path.join(ROOT, 'topics', task.slug);
    ensureDir(dir);

    // Gather words for this task
    const wordIds = new Set();
    task.topic_ids.forEach(tid => {
      (topics.topic_words[tid] || []).forEach(id => wordIds.add(id));
    });
    const words = [...wordIds].map(id => wordMap[id]).filter(Boolean);

    // Build word list HTML
    const wordListHtml = words.map(w =>
      `<tr>
        <td class="chinese" style="font-size:18px;font-weight:600;">${escHtml(w.word)}</td>
        <td style="color:var(--accent);">${escHtml(w.pinyin)}</td>
        <td>${escHtml(w.meaning)}</td>
        <td class="chinese" style="font-size:13px;color:var(--stone);">${escHtml(w.example_cn || '')}</td>
      </tr>`
    ).join('\n      ');

    // Scenario dialogue (情景对话) — authored per task in data/task-dialogues.json
    const dlg = dialogues[task.slug];
    const dialogueHtml = dlg ? `
  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 8px;">Scenario Dialogue / \u60C5\u666F\u5BF9\u8BDD</h2>
  <p style="color:var(--stone);font-size:14px;margin-bottom:14px;">${escHtml(dlg.scene_en)} Read it aloud twice: once for meaning, once for fluency \u2014 the syllabus tests this task across listening and speaking.</p>
  <div style="background:white;border:1px solid var(--mist);border-radius:var(--radius);padding:20px 24px;margin-bottom:24px;">
    ${dlg.lines.map(l => `
    <div style="display:flex;gap:12px;margin-bottom:14px;">
      <div style="flex:0 0 26px;height:26px;border-radius:50%;background:${l.s === 'A' ? 'var(--accent-soft)' : 'var(--jade-soft)'};color:${l.s === 'A' ? 'var(--accent)' : 'var(--jade)'};font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;">${l.s}</div>
      <div>
        <div class="chinese" style="font-size:16px;font-weight:600;line-height:1.7;">${escHtml(l.cn)}</div>
        <div style="font-size:12px;color:var(--accent);margin-top:1px;">${escHtml(l.py)}</div>
        <div style="font-size:13px;color:var(--stone);margin-top:2px;line-height:1.5;">${escHtml(l.en)}</div>
      </div>
    </div>`).join('')}
  </div>` : '';

    // Grammar links
    const grammarLinksHtml = task.grammar.map(g => {
      const name = g.replace('/grammar/', '').replace('/', '');
      return `<a href="${g}" class="btn btn-ghost" style="font-size:13px;">${name}</a>`;
    }).join(' ');

    // Find real HSK 4 questions matching this topic (search test JSONs)
    // Build a keyword set from topic words (top 8 high-frequency-content words)
    const topicKeywords = words
      .filter(w => w.word && w.word.length >= 2)
      .slice(0, 12)
      .map(w => w.word);
    const matchingQuestions = [];
    if (topicKeywords.length > 0) {
      for (let ti = 0; ti < 12 && matchingQuestions.length < 3; ti++) {
        try {
          const tjson = readJSON(`test-${String(ti+1).padStart(2,'0')}.json`);
          for (const q of tjson.questions) {
            const text = (q.text || '') + ' ' + (q.options || []).join(' ');
            const matchCount = topicKeywords.filter(kw => text.includes(kw)).length;
            if (matchCount >= 2 && text.length >= 80 && text.length < 300 &&
                (q.type === 'reading_comprehension' || q.type === 'listening_choice')) {
              matchingQuestions.push({
                test: ti + 1,
                num: q.number,
                text: q.text || '',
                options: q.options || [],
                answer: q.correct_answer_index,
                type: q.type,
              });
              if (matchingQuestions.length >= 3) break;
            }
          }
        } catch (e) { /* skip */ }
      }
    }
    const realQuestionHtml = matchingQuestions.length > 0
      ? `<h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 12px;">Real HSK 4 Questions on ${escHtml(task.task_en)} / 真题示例</h2>
  <p style="color:var(--stone);margin-bottom:16px;font-size:14px;">Below are 1-${matchingQuestions.length} actual HSK 4 ${escHtml(task.task_en).toLowerCase()} questions from our 12 mock exams. Each was solved using the vocabulary above:</p>
  ${matchingQuestions.map(mq => `
  <div style="background:white;border:1px solid var(--mist);border-radius:var(--radius);padding:18px 22px;margin:14px 0;">
    <div style="font-size:11px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">From <a href="/test/${String(mq.test).padStart(2,'0')}/" style="color:var(--accent);">HSK 4 Mock Test ${String(mq.test).padStart(2,'0')}</a> · Q${mq.num} · ${mq.type === 'listening_choice' ? '听力 Listening' : '阅读 Reading'}</div>
    <div style="font-family:'Noto Sans SC',sans-serif;font-size:15px;line-height:1.6;margin-bottom:10px;">${escHtml(mq.text).replace(/\n/g, '<br>')}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      ${mq.options.map((o, oi) => `<span style="font-size:13px;padding:4px 10px;border-radius:6px;background:${oi === mq.answer ? 'var(--correct-soft)' : 'var(--paper)'};color:${oi === mq.answer ? 'var(--correct)' : 'var(--stone)'};font-weight:${oi === mq.answer ? '600' : '400'};">${escHtml(o)}${oi === mq.answer ? ' ✓' : ''}</span>`).join('')}
    </div>
  </div>
`).join('')}`
      : '';

    // Topic-specific "Why HSK 4 candidates struggle" — generated from desc + words
    const topWordsForExample = words.slice(0, 4).map(w => `<strong>${escHtml(w.word)}</strong> (${escHtml(w.pinyin)}, ${escHtml(w.meaning.split(';')[0])})`).join(', ');
    const challengeHtml = `<h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 12px;">Why HSK 4 Candidates Struggle with ${escHtml(task.task_en)}</h2>
  <p style="color:var(--stone);line-height:1.8;margin-bottom:14px;">${escHtml(task.desc)}</p>
  <p style="color:var(--stone);line-height:1.8;margin-bottom:14px;">The biggest challenge for HSK 4 candidates on the <strong>${escHtml(task.task_en).toLowerCase()}</strong> topic isn't memorizing the ${words.length} core words — it's understanding how they combine in extended contexts. HSK 4 ${escHtml(task.task_en).toLowerCase()} questions typically require you to understand cause and effect, opinion shifts, or comparative judgements, not just basic vocabulary recognition.</p>
  ${words.length >= 4 ? `<p style="color:var(--stone);line-height:1.8;margin-bottom:14px;">Key vocabulary to anchor your understanding: ${topWordsForExample}. These words frequently appear in HSK 4 listening dialogues (听力) and reading passages (阅读), often with grammar patterns like ${task.grammar.map(g => `<a href="${g}" style="color:var(--accent);">${g.replace('/grammar/','').replace('/','')}</a>`).join(' and ')}.</p>` : ''}`;

    // Topic-specific FAQ (3 unique Q&A per topic, generated from task.task_en)
    const topicFaqs = [
      {
        q: `How many HSK 4 words cover ${task.task_en.toLowerCase()}?`,
        a: `The HSK 4 official syllabus has ${words.length} core words specifically for the ${task.task_en.toLowerCase()} task scenario. These come from ${task.topic_ids.length} sub-topic categories: ${task.topic_ids.join(', ')}. Mastering these ${words.length} words gives you 70-80% comprehension on ${task.task_en.toLowerCase()}-themed questions in HSK 4.`,
      },
      {
        q: `Which HSK 4 grammar points are most relevant to ${task.task_en.toLowerCase()}?`,
        a: `${task.grammar.length === 0 ? 'General HSK 4 patterns' : task.grammar.map(g => g.replace('/grammar/','').replace('/','')).join(' and ')} appear most frequently in ${task.task_en.toLowerCase()} contexts. The HSK 4 syllabus expects you to ${task.skills.includes('writing') ? 'not only understand but also produce' : 'understand'} these patterns when they involve ${task.task_en.toLowerCase()} vocabulary.`,
      },
      {
        q: `What's the difference between HSK 3 and HSK 4 expectations on ${task.task_en.toLowerCase()}?`,
        a: `HSK 3 expects simple statements about ${task.task_en.toLowerCase()} (e.g., basic facts and short descriptions). HSK 4 raises the bar to "有一定复杂度" — handling extended contexts with opinions, comparisons, and reasoning. You'll need to express feelings (感受) and views (看法) about ${task.task_en.toLowerCase()}, not just describe them.`,
      },
    ];
    const faqHtml = `<h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 12px;">${escHtml(task.task_en)} FAQ / 常见问题</h2>
  ${topicFaqs.map((f, i) => `<details style="background:var(--paper);border-radius:8px;padding:14px 18px;margin:8px 0;">
    <summary style="font-weight:600;cursor:pointer;color:var(--ink);">${escHtml(f.q)}</summary>
    <p style="margin:12px 0 0;color:var(--stone);line-height:1.7;font-size:14px;">${escHtml(f.a)}</p>
  </details>`).join('\n  ')}`;

    // Generate FAQPage schema for the 3 topic FAQs (extra structured data signal)
    const faqJsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': topicFaqs.map(f => ({
        '@type': 'Question',
        'name': f.q,
        'acceptedAnswer': { '@type': 'Answer', 'text': f.a },
      })),
    }, null, 2);


    // Front-load the keyword; brand suffix may truncate in SERPs, which is fine
    let pageTitle = `HSK 4 ${task.task_en} Vocabulary \u2014 ${task.task_cn} | Mandarin Zone`;
    if (pageTitle.length > 78) {
      pageTitle = `HSK 4 ${task.task_en} \u2014 ${task.task_cn} | Mandarin Zone`;
    }
    const pageDesc = truncDesc(`${words.length} HSK 4 words for "${task.task_en}" (${task.task_cn}). Vocabulary with pinyin, meanings, examples from the official syllabus.`);

    const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(pageTitle)}</title>
<meta name="description" content="${escHtml(pageDesc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/topics/${task.slug}/">

<meta property="og:title" content="HSK 4 ${escHtml(task.task_en)} Vocabulary \u2014 ${escHtml(task.task_cn)}">
<meta property="og:description" content="${escHtml(pageDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/topics/${task.slug}/">
<meta property="og:site_name" content="Mandarin Zone">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "HSK 4 ${escHtml(task.task_en)} Vocabulary (${escHtml(task.task_cn)})",
  "description": "${escHtml(pageDesc)}",
  "url": "https://hsk4.mandarinzone.com/topics/${task.slug}/",
  "author": { "@type": "Organization", "name": "Mandarin Zone", "url": "https://mandarinzone.com" },
  "inLanguage": ["en", "zh-CN"],
  "educationalLevel": "Intermediate"
}
</script>
<script type="application/ld+json">
${faqJsonLd}
</script>

<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<style>
  .task-badge { display:inline-block; background:var(--accent-soft); color:var(--accent); font-size:12px; font-weight:600; padding:4px 12px; border-radius:6px; margin-bottom:16px; text-transform:uppercase; letter-spacing:0.5px; }
  .syllabus-box { background:var(--paper); border:1px solid var(--mist); border-radius:var(--radius); padding:20px 24px; margin:20px 0; }
  .syllabus-box h3 { font-size:14px; color:var(--stone); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
  .syllabus-box p { font-family:'Noto Sans SC',sans-serif; font-size:15px; line-height:1.8; color:var(--ink); }
  .word-table { width:100%; border-collapse:collapse; margin:20px 0; font-size:14px; }
  .word-table th { padding:10px 12px; text-align:left; border-bottom:2px solid var(--mist); font-size:13px; text-transform:uppercase; letter-spacing:0.5px; color:var(--stone); }
  .word-table td { padding:8px 12px; border-bottom:1px solid var(--mist); vertical-align:top; }
  .word-table tr:hover td { background:white; }
  .skills-row { display:flex; gap:8px; margin:16px 0; flex-wrap:wrap; }
  .skill-tag { padding:6px 14px; border-radius:6px; font-size:13px; font-weight:600; }
  .skill-tag.listening { background:var(--gold-soft); color:var(--gold); }
  .skill-tag.reading { background:var(--jade-soft); color:var(--jade); }
  .skill-tag.writing { background:var(--accent-soft); color:var(--accent); }
  .skill-tag.speaking { background:#e8e4ff; color:#5b4fc4; }
  .breadcrumb { font-size:13px; color:var(--stone); margin-bottom:8px; }
  .breadcrumb a { color:var(--accent); text-decoration:none; }
  .breadcrumb a:hover { text-decoration:underline; }
  .task-nav { display:flex; justify-content:space-between; margin:40px 0; flex-wrap:wrap; gap:12px; }
  @media (max-width:600px) { .word-table { font-size:13px; } .word-table th,.word-table td { padding:6px 8px; } }
</style>
</head>
<body>

<header>
  <div class="header-inner">
    <a href="/" class="logo">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="logo-mark" loading="eager">
      <div class="logo-text">HSK 4 <span>Mock Exam</span></div>
    </a>
    <nav class="site-nav" aria-label="Primary">
      <a href="/" class="nav-link">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link">Vocabulary</a>
      <a href="/characters/" class="nav-link">Characters</a>
      <a href="/grammar/" class="nav-link">Grammar</a>
      <a href="/sentences/" class="nav-link">Sentences</a>
      <a href="/strategies/" class="nav-link">Strategies</a>
      <a href="/traps/" class="nav-link">Traps</a>
      <a href="/topics/" class="nav-link" style="opacity:1;">Topics</a>
      <a href="/words/" class="nav-link">Words</a>
      <a href="/compare/" class="nav-link">Compare</a>
      <a href="/guide/" class="nav-link">Guide</a>
    </nav>
  </div>
</header>

<main>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/topics/">Topics</a> &rsaquo; ${escHtml(task.task_en)}
  </nav>

  <div class="hero">
    <div class="task-badge">Official Syllabus Task</div>
    <h1 class="chinese">HSK 4 ${escHtml(task.task_cn)} \u2014 <span class="accent">${escHtml(task.task_en)}</span></h1>
    <p>${escHtml(task.desc)}</p>
    <div class="stats-row">
      <div class="stat"><div class="stat-num">${words.length}</div><div class="stat-label">Words</div></div>
      <div class="stat"><div class="stat-num">${task.skills.length}</div><div class="stat-label">Skills Tested</div></div>
    </div>
  </div>

  <div class="skills-row">
    ${task.skills.map(s => `<span class="skill-tag ${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`).join('\n    ')}
  </div>

  <div class="syllabus-box">
    <h3>Official Syllabus Requirement / \u5927\u7EB2\u8981\u6C42</h3>
    <p>${escHtml(task.syllabus_cn)}</p>
  </div>

  ${dialogueHtml}

  ${challengeHtml}

  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 12px;">Related Grammar Patterns / \u76F8\u5173\u8BED\u6CD5</h2>
  <p style="color:var(--stone);margin-bottom:12px;">These grammar points are commonly tested in ${escHtml(task.task_en).toLowerCase()} contexts:</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;">
    ${grammarLinksHtml}
  </div>

  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 12px;">Core Vocabulary / \u6838\u5FC3\u8BCD\u6C47 (${words.length} words)</h2>
  <table class="word-table">
    <thead>
      <tr><th>Word</th><th>Pinyin</th><th>Meaning</th><th>Example</th></tr>
    </thead>
    <tbody>
      ${wordListHtml}
    </tbody>
  </table>

  ${words.length >= 8 ? generateTopicQuiz(words, task.slug) : ''}

  <div style="text-align:center;margin:32px 0;">
    <a href="/vocabulary/" class="btn btn-primary">Study All HSK 4 Vocabulary</a>
    <a href="/" class="btn btn-secondary" style="margin-left:8px;">Take a Mock Exam</a>
    <a href="/words/" class="btn btn-ghost" style="margin-left:8px;">Confusable Words</a>
  </div>

  ${realQuestionHtml}

  ${faqHtml}

  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 12px;">Practice This HSK 4 Topic</h2>
  <p style="color:var(--stone);margin-bottom:12px;font-size:14px;">Test your knowledge of ${escHtml(task.task_en).toLowerCase()} vocabulary in context:</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
    <a href="/test/01/" class="btn btn-ghost" style="font-size:13px;">Mock Test 01</a>
    <a href="/test/03/" class="btn btn-ghost" style="font-size:13px;">Mock Test 03</a>
    <a href="/test/06/" class="btn btn-ghost" style="font-size:13px;">Mock Test 06</a>
    <a href="/writing/sentence-order/" class="btn btn-ghost" style="font-size:13px;">Sentence Ordering</a>
  </div>

  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 12px;">Apply This HSK 4 Vocabulary on Test Day</h2>
  <p style="color:var(--stone);margin-bottom:12px;font-size:14px;">${escHtml(task.task_en)} vocabulary appears in HSK 4 listening dialogues, reading passages, and the writing section. These resources turn the words you learned above into test points:</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px;margin:16px 0;">
    <a href="/strategies/listening-dialog/" style="background:var(--accent-soft);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
      <div style="font-size:11px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">⚡ Strategy</div>
      <div style="font-size:14px;font-weight:600;">HSK 4 listening dialog tactics</div>
    </a>
    <a href="/strategies/reading-comprehension/" style="background:var(--accent-soft);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
      <div style="font-size:11px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">⚡ Strategy</div>
      <div style="font-size:14px;font-weight:600;">HSK 4 reading comprehension</div>
    </a>
    <a href="/sentences/" style="background:var(--gold-soft);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
      <div style="font-size:11px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">\u{1F4DD} Patterns</div>
      <div style="font-size:14px;font-weight:600;">100 essential HSK 4 sentences</div>
    </a>
    <a href="/words/" style="background:var(--jade-soft);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
      <div style="font-size:11px;color:var(--jade);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">\u{1F50D} Confusables</div>
      <div style="font-size:14px;font-weight:600;">43 HSK 4 confusable pairs</div>
    </a>
  </div>

  <div class="task-nav">
    ${tasks.indexOf(task) > 0 ? `<a href="/topics/${tasks[tasks.indexOf(task)-1].slug}/" class="btn btn-ghost">&larr; ${escHtml(tasks[tasks.indexOf(task)-1].task_en)}</a>` : '<span></span>'}
    <a href="/topics/" class="btn btn-secondary">All Topics</a>
    ${tasks.indexOf(task) < tasks.length - 1 ? `<a href="/topics/${tasks[tasks.indexOf(task)+1].slug}/" class="btn btn-ghost">${escHtml(tasks[tasks.indexOf(task)+1].task_en)} &rarr;</a>` : '<span></span>'}
  </div>
</main>

<footer>
  <div class="footer-brand">
    <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="footer-brand-link">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="footer-logo" loading="lazy">
      <div>
        <div class="footer-brand-name">Mandarin Zone</div>
        <div class="footer-tagline">Learn Chinese in Beijing &amp; Online \u00b7 Since 2008</div>
      </div>
    </a>
    <div class="footer-cta">
      <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="btn btn-ghost">Visit Website</a>
      <a href="https://www.mandarinzone.com/contact-us/" target="_blank" rel="noopener" class="btn btn-ghost">Contact Us</a>
    </div>
  </div>
  <p class="footer-links" style="margin-top:4px;"><a href="/">Mock Exams</a> \u00B7 <a href="/vocabulary/">Vocabulary</a> \u00B7 <a href="/grammar/">Grammar</a> \u00B7 <a href="/topics/">Topics</a> \u00B7 <a href="/writing/">Writing</a> \u00B7 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
</footer>

</body>
</html>`;

    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml, 'utf8');
  });

  // Add to sitemap
  const generated = tasks.filter(t => !skipSlugs.has(t.slug));

  // Link every task page from the /topics/ hub so they aren't sitemap-only
  // orphans. Re-emitted on each build (old block stripped first).
  const hubPath = path.join(ROOT, 'topics', 'index.html');
  let hubHtml = fs.readFileSync(hubPath, 'utf8');
  const taskNavCards = generated.map(t =>
    `      <a class="task-nav-card" href="/topics/${t.slug}/"><span class="chinese">${escHtml(t.task_cn)}</span><span class="task-nav-en">${escHtml(t.task_en)}</span></a>`
  ).join('\n');
  const taskNavBlock = `<!-- TASK PAGES NAV -->
  <section class="task-pages-nav" aria-label="Vocabulary by task">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 6px;">Vocabulary by Task Scenario <span class="chinese" style="color:var(--accent);">${generated.length}个任务</span></h2>
    <p style="color:var(--stone);margin-bottom:16px;font-size:14px;">The official 2026 syllabus defines ${generated.length} communicative tasks. Each page below collects the HSK 4 words for one task, with examples and related grammar.</p>
    <style>
      .task-nav-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:10px; margin-bottom:32px; }
      .task-nav-card { display:flex; flex-direction:column; gap:2px; background:white; border:1px solid var(--mist); border-radius:8px; padding:12px 14px; text-decoration:none; color:var(--ink); font-size:14px; transition:all .15s; }
      .task-nav-card:hover { border-color:var(--accent); transform:translateY(-1px); }
      .task-nav-en { font-size:12px; color:var(--stone); }
    </style>
    <div class="task-nav-grid">
${taskNavCards}
    </div>
  </section>
  <!-- /TASK PAGES NAV -->
`;
  hubHtml = hubHtml.replace(/<!-- TASK PAGES NAV -->[\s\S]*?<!-- \/TASK PAGES NAV -->\n?/g, '');
  if (hubHtml.includes('<div id="categories"')) {
    hubHtml = hubHtml.replace(/(\s*)(<div id="categories")/, `\n  ${taskNavBlock}$1$2`);
  } else {
    hubHtml = hubHtml.replace('</main>', `${taskNavBlock}\n</main>`);
  }
  fs.writeFileSync(hubPath, hubHtml, 'utf8');
  console.log(`[task-topics] Injected ${generated.length}-task nav into topics/index.html`);

  console.log(`[task-topics] Generated ${generated.length} task topic pages (skipped ${skipSlugs.size} thin pages)`);
  return generated.map(t => t.slug);
}

// ============================================================
// 11. GENERATE CONFUSABLE WORD PAIR PAGES
// ============================================================

function buildConfusablePages() {
  console.log('[confusables] Generating confusable word pair pages...');
  const pairs = readJSON('confusables.json');

  // "Related confusable pairs" — rank by shared characters (same phonetic/
  // semantic family, e.g. 竟然/居然 vs 既然/竟然), then same category.
  const pairWords = p => [p.wordA, p.wordB, p.wordC].filter(Boolean);
  function relatedPairsFor(pair) {
    const chars = new Set(pairWords(pair).join('').split(''));
    return pairs
      .filter(p => p.slug !== pair.slug)
      .map(p => {
        const shared = new Set(pairWords(p).join('').split('').filter(c => chars.has(c))).size;
        const sameCat = p.category && p.category === pair.category ? 1 : 0;
        return { p, score: shared * 10 + sameCat };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.p.slug.localeCompare(b.p.slug))
      .slice(0, 4)
      .map(x => x.p);
  }

  function relatedSectionHtml(pair) {
    const rel = relatedPairsFor(pair);
    if (rel.length === 0) return '';
    const cards = rel.map(p => `
      <a href="/words/${p.slug}/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
        <div class="chinese" style="font-size:16px;font-weight:700;">${escHtml(pairWords(p).join(' vs '))}</div>
        <div style="font-size:12px;color:var(--stone);margin-top:4px;">${escHtml((p.subtitle || '').split(' — ')[0])}</div>
        <div style="font-size:11px;color:var(--accent);margin-top:6px;">${escHtml(p.category || '')}</div>
      </a>`).join('');
    return `<!-- RELATED CONFUSABLES -->
  <section style="margin-top:32px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin-bottom:12px;">Related Confusable Words / 相关易混词</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px;">${cards}
    </div>
  </section>
  <!-- /RELATED CONFUSABLES -->`;
  }

  pairs.forEach((pair, pi) => {
    const dir = path.join(ROOT, 'words', pair.slug);
    ensureDir(dir);

    // Pairs flagged customHtml have hand-enriched pages (extra patterns,
    // curated real-question selections, longer FAQ). The generator template
    // can't represent them, so only inject the related-pairs block (between
    // markers, idempotently) and leave the rest of the page untouched.
    if (pair.customHtml) {
      const customPath = path.join(dir, 'index.html');
      if (fs.existsSync(customPath)) {
        let customHtml = fs.readFileSync(customPath, 'utf8');
        customHtml = customHtml.replace(/\s*<!-- RELATED CONFUSABLES -->[\s\S]*?<!-- \/RELATED CONFUSABLES -->/g, '');
        customHtml = customHtml.replace(/<\/main>/, `\n  ${relatedSectionHtml(pair)}\n</main>`);
        fs.writeFileSync(customPath, customHtml, 'utf8');
      }
      console.log(`[confusables] ${pair.slug}: customHtml — injected related block only`);
      return;
    }

    // Find real HSK 4 mock exam questions where these confusable words appear
    const matchingQs = [];
    const wordsToFind = [pair.wordA, pair.wordB];
    for (let ti = 0; ti < 12 && matchingQs.length < 2; ti++) {
      try {
        const tjson = readJSON(`test-${String(ti+1).padStart(2,'0')}.json`);
        for (const q of tjson.questions) {
          const text = (q.text || '') + ' ' + (q.options || []).join(' ');
          if (wordsToFind.some(w => text.includes(w)) && text.length >= 60 && text.length < 250) {
            matchingQs.push({ test: ti+1, num: q.number, text: q.text || '', options: q.options || [], answer: q.correct_answer_index });
            if (matchingQs.length >= 2) break;
          }
        }
      } catch (e) { /* skip */ }
    }
    const realQHtml = matchingQs.length > 0
      ? `\n  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 12px;">Real HSK 4 Test Questions Using ${escHtml(pair.wordA)} or ${escHtml(pair.wordB)} / 真题示例</h2>
  <p style="color:var(--stone);margin-bottom:14px;font-size:14px;">${matchingQs.length} actual HSK 4 questions from our mock exams that test the ${escHtml(pair.wordA)} vs ${escHtml(pair.wordB)} distinction:</p>
  ${matchingQs.map(mq => `<div style="background:white;border:1px solid var(--mist);border-radius:8px;padding:14px 18px;margin:10px 0;">
    <div style="font-size:11px;color:var(--accent);font-weight:700;text-transform:uppercase;margin-bottom:8px;">From <a href="/test/${String(mq.test).padStart(2,'0')}/" style="color:var(--accent);">HSK 4 Mock Test ${String(mq.test).padStart(2,'0')}</a> · Q${mq.num}</div>
    <div style="font-family:'Noto Sans SC',sans-serif;font-size:14px;line-height:1.6;margin-bottom:8px;">${escHtml(mq.text).replace(/\n/g, '<br>')}</div>
    ${mq.options.length > 0 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">${mq.options.map((o, oi) => `<span style="font-size:12px;padding:3px 9px;border-radius:5px;background:${oi === mq.answer ? 'var(--correct-soft)' : 'var(--paper)'};color:${oi === mq.answer ? 'var(--correct)' : 'var(--stone)'};">${escHtml(o)}${oi === mq.answer ? ' ✓' : ''}</span>`).join('')}</div>` : ''}
  </div>`).join('')}`
      : '';

    // Pair-specific FAQ (3 unique Q&A per pair)
    const pairFaqs = [
      {
        q: `Are ${pair.wordA} and ${pair.wordB} interchangeable in HSK 4?`,
        a: `No. Although ${pair.wordA} (${pair.pinyinA}) and ${pair.wordB} (${pair.pinyinB}) translate similarly into English, HSK 4 fill-in-the-blank and listening questions test exactly the distinction between them. ${pair.tip ? pair.tip.split('.')[0] + '.' : ''}`,
      },
      {
        q: `How is ${pair.wordA} vs ${pair.wordB} tested in HSK 4?`,
        a: `Most often in HSK 4 阅读 (reading) Part 1 选词填空 (Q46-55), where you choose the correct word for a blank in a sentence. Also appears in 听力 (listening) where the speaker uses one but the printed answer paraphrases with the other. Master both ${pair.wordA} and ${pair.wordB} collocations to lock in these points.`,
      },
      {
        q: `What's the quickest way to remember ${pair.wordA} vs ${pair.wordB}?`,
        a: `${pair.tip || `Memorize one example sentence for each: "${pair.exA?.cn || ''}" for ${pair.wordA}, "${pair.exB?.cn || ''}" for ${pair.wordB}. Recall the example when stuck.`} Practice 3-5 fill-in-blank questions in our HSK 4 mock exams to lock the distinction.`,
      },
    ];
    const pairFaqHtml = `\n  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 12px;">${escHtml(pair.wordA)} vs ${escHtml(pair.wordB)} FAQ</h2>
  ${pairFaqs.map(f => `<details style="background:var(--paper);border-radius:8px;padding:12px 16px;margin:6px 0;">
    <summary style="font-weight:600;cursor:pointer;color:var(--ink);">${escHtml(f.q)}</summary>
    <p style="margin:10px 0 0;color:var(--stone);line-height:1.7;font-size:14px;">${escHtml(f.a)}</p>
  </details>`).join('\n  ')}`;

    const pairFaqJsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': pairFaqs.map(f => ({
        '@type': 'Question',
        'name': f.q,
        'acceptedAnswer': { '@type': 'Answer', 'text': f.a },
      })),
    }, null, 2);

    const rowsHtml = pair.rows.map(r => {
      if (r.length === 3) {
        return `<tr><td class="label-cell">${escHtml(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`;
      } else {
        return `<tr><td class="label-cell">${escHtml(r[0])}</td><td colspan="2">${r[1]}</td></tr>`;
      }
    }).join('\n        ');

    const quizHtml = pair.quiz.map((q, qi) => {
      // Randomize option order so correct isn't always first
      const correctFirst = (pi + qi) % 2 === 0; // alternates based on pair+question index
      const opt1 = correctFirst
        ? `<button class="q-opt chinese" data-correct="1" onclick="answer(this,true)">${escHtml(q.correct)}</button>`
        : `<button class="q-opt chinese" onclick="answer(this,false)">${escHtml(q.wrong)}</button>`;
      const opt2 = correctFirst
        ? `<button class="q-opt chinese" onclick="answer(this,false)">${escHtml(q.wrong)}</button>`
        : `<button class="q-opt chinese" data-correct="1" onclick="answer(this,true)">${escHtml(q.correct)}</button>`;
      return `
        <div class="q-item">
          <div class="q-stem chinese">${escHtml(q.stem).replace('___', '<span class="blank"></span>')}</div>
          <div class="q-opts">
            ${opt1}
            ${opt2}
          </div>
          <div class="q-explain">${escHtml(q.explain)}</div>
        </div>`;
    }).join('\n');

    // Nav links
    const prevPair = pi > 0 ? pairs[pi - 1] : null;
    const nextPair = pi < pairs.length - 1 ? pairs[pi + 1] : null;

    const pageTitle = `${pair.wordA} vs ${pair.wordB} \u2014 HSK 4 Confusable Words | ${pair.wordA}\u548C${pair.wordB}\u7684\u533A\u522B`;
    // CTR-oriented copy: action verb "Master" up front, named pain point
    // ("real mock exams", "common mistakes to avoid"), concrete payoff
    // ("interactive quiz"). Subtitle length varies so truncDesc clips the
    // long-tail cases without losing the headline.
    const pageDesc = truncDesc(`Master ${pair.wordA} vs ${pair.wordB} on HSK 4 — ${pair.subtitle}. Side-by-side examples from real mock exams, common mistakes to avoid, and an interactive quiz.`);

    const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(pageTitle)}</title>
<meta name="description" content="${escHtml(pageDesc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/words/${pair.slug}/">

<meta property="og:title" content="${escHtml(pair.wordA)} vs ${escHtml(pair.wordB)} \u2014 HSK 4 Confusable Words">
<meta property="og:description" content="${escHtml(pageDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/words/${pair.slug}/">
<meta property="og:site_name" content="Mandarin Zone">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${escHtml(pair.wordA)} vs ${escHtml(pair.wordB)} \u2014 HSK 4 Confusable Words",
  "description": "${escHtml(pageDesc)}",
  "url": "https://hsk4.mandarinzone.com/words/${pair.slug}/",
  "author": { "@type": "Organization", "name": "Mandarin Zone", "url": "https://mandarinzone.com" },
  "inLanguage": ["en", "zh-CN"],
  "educationalLevel": "Intermediate"
}
</script>
<script type="application/ld+json">
${pairFaqJsonLd}
</script>

<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<style>
  .cmp-table { width:100%; border-collapse:collapse; margin:20px 0; font-size:14px; }
  .cmp-table th { padding:10px 14px; text-align:left; font-weight:600; border-bottom:2px solid var(--mist); font-size:16px; }
  .cmp-table th:first-child { color:var(--accent); }
  .cmp-table th:last-child { color:var(--jade); }
  .cmp-table td { padding:8px 14px; border-bottom:1px solid var(--mist); vertical-align:top; line-height:1.5; }
  .label-cell { font-weight:600; font-size:13px; text-transform:uppercase; letter-spacing:0.3px; color:var(--stone); width:100px; }
  .ex-block { background:var(--paper); border:1px solid var(--mist); border-radius:8px; padding:14px 18px; margin:8px 0; }
  .ex-cn { font-family:'Noto Sans SC',sans-serif; font-size:15px; }
  .ex-pinyin { font-size:13px; color:var(--stone); font-style:italic; }
  .ex-en { font-size:13px; color:var(--stone); }
  .ex-highlight { color:var(--accent); font-weight:600; }
  .tip-box { background:var(--gold-soft); border:1px solid #e8d5a0; border-radius:8px; padding:14px 18px; margin:20px 0; font-size:14px; line-height:1.6; }
  .tip-box strong { color:var(--gold); }
  .q-item { background:white; border:1px solid var(--mist); border-radius:8px; padding:16px; margin-bottom:10px; }
  .q-stem { font-size:15px; font-family:'Noto Sans SC',sans-serif; margin-bottom:10px; line-height:1.5; }
  .q-stem .blank { display:inline-block; min-width:50px; border-bottom:2px solid var(--accent); margin:0 4px; text-align:center; }
  .q-opts { display:flex; gap:8px; flex-wrap:wrap; }
  .q-opt { padding:8px 18px; border:1px solid var(--mist); border-radius:8px; background:white; font-size:15px; font-family:'Noto Sans SC','DM Sans',sans-serif; cursor:pointer; transition:all 0.15s; }
  .q-opt:hover { border-color:var(--accent); background:var(--accent-soft); }
  .q-opt.correct { background:var(--jade-soft); border-color:var(--jade); color:var(--jade); font-weight:600; }
  .q-opt.wrong { background:#ffe0e0; border-color:var(--accent); color:var(--accent); }
  .q-opt.disabled { pointer-events:none; opacity:0.7; }
  .q-opt.disabled.correct { opacity:1; }
  .q-explain { display:none; margin-top:10px; font-size:13px; color:var(--stone); line-height:1.6; padding:10px 14px; background:var(--paper); border-radius:6px; }
  .breadcrumb { font-size:13px; color:var(--stone); margin-bottom:8px; }
  .breadcrumb a { color:var(--accent); text-decoration:none; }
  .fill-item { background:white; border:1px solid var(--mist); border-radius:8px; padding:16px; margin-bottom:10px; }
  .fill-sentence { font-size:17px; line-height:1.8; margin-bottom:10px; }
  .fill-input { width:60px; border:none; border-bottom:2px solid var(--accent); background:transparent; font-size:17px; font-family:'Noto Sans SC',sans-serif; text-align:center; outline:none; padding:2px 4px; }
  .fill-input:focus { border-bottom-color:var(--jade); }
  .fill-input.correct { border-bottom-color:var(--jade); color:var(--jade); font-weight:600; }
  .fill-input.wrong { border-bottom-color:var(--accent); color:var(--accent); }
  .fill-check-btn { padding:6px 16px; border:1px solid var(--mist); border-radius:6px; background:white; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s; }
  .fill-check-btn:hover { border-color:var(--accent); background:var(--accent-soft); }
  .fill-check-btn.done { pointer-events:none; opacity:0.5; }
  .fill-feedback { margin-top:8px; font-size:13px; line-height:1.5; display:none; padding:8px 12px; border-radius:6px; }
  .fill-feedback.show { display:block; }
  .fill-feedback.pass { background:var(--jade-soft); color:var(--jade); }
  .fill-feedback.fail { background:#ffe0e0; color:var(--accent); }
  .pair-nav { display:flex; justify-content:space-between; margin:40px 0; flex-wrap:wrap; gap:12px; }
  @media (max-width:600px) { .cmp-table th,.cmp-table td { padding:6px 8px; font-size:13px; } .q-opts { flex-direction:column; } .fill-input { width:50px; } }
</style>
</head>
<body>

<header>
  <div class="header-inner">
    <a href="/" class="logo"><img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="logo-mark" loading="eager"><div class="logo-text">HSK 4 <span>Mock Exam</span></div></a>
    <nav class="site-nav" aria-label="Primary">
      <a href="/" class="nav-link">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link">Vocabulary</a>
      <a href="/characters/" class="nav-link">Characters</a>
      <a href="/grammar/" class="nav-link">Grammar</a>
      <a href="/sentences/" class="nav-link">Sentences</a>
      <a href="/strategies/" class="nav-link">Strategies</a>
      <a href="/traps/" class="nav-link">Traps</a>
      <a href="/topics/" class="nav-link">Topics</a>
      <a href="/words/" class="nav-link" style="opacity:1;">Words</a>
      <a href="/compare/" class="nav-link">Compare</a>
      <a href="/guide/" class="nav-link">Guide</a>
    </nav>
  </div>
</header>

<main>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/words/">Confusable Words</a> &rsaquo; ${escHtml(pair.wordA)} vs ${escHtml(pair.wordB)}
  </nav>

  <div class="hero">
    <div class="hero-badge">${escHtml(pair.category)}</div>
    <h1 class="chinese">HSK 4 <span class="accent">${escHtml(pair.wordA)}</span> vs <span style="color:var(--jade);">${escHtml(pair.wordB)}</span></h1>
    <p>${escHtml(pair.subtitle)}</p>
  </div>

  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:24px 0 8px;">Comparison / \u5BF9\u6BD4</h2>
  <table class="cmp-table">
    <tr><th class="chinese">${escHtml(pair.wordA)} ${escHtml(pair.pinyinA)}</th><th></th><th class="chinese">${escHtml(pair.wordB)} ${escHtml(pair.pinyinB)}</th></tr>
    ${rowsHtml}
  </table>

  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 8px;">Examples / \u4F8B\u53E5</h2>
  <div class="ex-block">
    <div class="ex-cn chinese"><span class="ex-highlight">${escHtml(pair.wordA)}</span>: ${escHtml(pair.exA.cn)}</div>
    <div class="ex-pinyin">${escHtml(pair.exA.py)}</div>
    <div class="ex-en">${escHtml(pair.exA.en)}</div>
  </div>
  <div class="ex-block">
    <div class="ex-cn chinese"><span style="color:var(--jade);font-weight:600;">${escHtml(pair.wordB)}</span>: ${escHtml(pair.exB.cn)}</div>
    <div class="ex-pinyin">${escHtml(pair.exB.py)}</div>
    <div class="ex-en">${escHtml(pair.exB.en)}</div>
  </div>

  <div class="tip-box">
    <strong>Quick rule:</strong> ${escHtml(pair.tip)}
  </div>

  ${pair.exercises && pair.exercises.length > 0 ? generateFillExercises(pair.exercises, 'Type the correct word to complete each sentence. Press Enter or click Check.') : ''}

  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 8px;">Quick Quiz / \u5C0F\u6D4B\u9A8C</h2>
  <div id="quiz-area">
    ${quizHtml}
  </div>

${realQHtml}

${pairFaqHtml}

  <div class="pair-nav">
    ${prevPair ? `<a href="/words/${prevPair.slug}/" class="btn btn-ghost">&larr; ${escHtml(prevPair.wordA)} vs ${escHtml(prevPair.wordB)}</a>` : '<span></span>'}
    <a href="/words/" class="btn btn-secondary">All Confusable Words</a>
    ${nextPair ? `<a href="/words/${nextPair.slug}/" class="btn btn-ghost">${escHtml(nextPair.wordA)} vs ${escHtml(nextPair.wordB)} &rarr;</a>` : '<span></span>'}
  </div>

  ${relatedSectionHtml(pair)}

  <section style="margin-top:32px;padding-top:24px;border-top:1px solid var(--mist);">
    <h3 style="font-size:16px;margin-bottom:12px;color:var(--stone);">Use this HSK 4 distinction in real test conditions</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px;">
      <a href="/strategies/reading-fill/" style="background:var(--accent-soft);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
        <div style="font-size:11px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">\u26A1 Strategy</div>
        <div style="font-size:14px;font-weight:600;">HSK 4 \u9009\u8BCD\u586B\u7A7A (Q46-55) tips</div>
      </a>
      <a href="/sentences/" style="background:var(--gold-soft);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
        <div style="font-size:11px;color:var(--gold);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">\u{1F4DD} Patterns</div>
        <div style="font-size:14px;font-weight:600;">100 essential HSK 4 sentences</div>
      </a>
      <a href="/grammar/" style="background:var(--jade-soft);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
        <div style="font-size:11px;color:var(--jade);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">\u{1F527} Grammar</div>
        <div style="font-size:14px;font-weight:600;">HSK 4 grammar guide (14 topics)</div>
      </a>
      <a href="/" style="background:var(--paper);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
        <div style="font-size:11px;color:var(--stone);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">\u{1F3AF} Practice</div>
        <div style="font-size:14px;font-weight:600;">12 HSK 4 mock exams</div>
      </a>
    </div>
  </section>
</main>

<footer>
  <div class="footer-brand">
    <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="footer-brand-link">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="footer-logo" loading="lazy">
      <div>
        <div class="footer-brand-name">Mandarin Zone</div>
        <div class="footer-tagline">Learn Chinese in Beijing &amp; Online \u00b7 Since 2008</div>
      </div>
    </a>
    <div class="footer-cta">
      <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="btn btn-ghost">Visit Website</a>
      <a href="https://www.mandarinzone.com/contact-us/" target="_blank" rel="noopener" class="btn btn-ghost">Contact Us</a>
    </div>
  </div>
  <p class="footer-links" style="margin-top:4px;"><a href="/">Mock Exams</a> \u00B7 <a href="/vocabulary/">Vocabulary</a> \u00B7 <a href="/grammar/">Grammar</a> \u00B7 <a href="/sentences/">Sentences</a> \u00B7 <a href="/strategies/">Strategies</a> \u00B7 <a href="/words/">Confusable Words</a> \u00B7 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
</footer>

<script>
function answer(btn, correct) {
  const item = btn.closest('.q-item');
  if (item.dataset.answered === 'true') return;
  item.dataset.answered = 'true';
  item.querySelectorAll('.q-opt').forEach(o => {
    o.classList.add('disabled');
    if (o.dataset.correct === '1') o.classList.add('correct');
  });
  if (!correct) btn.classList.add('wrong');
  item.querySelector('.q-explain').style.display = 'block';
}
function checkFill(btn) {
  var item = btn.closest('.fill-item');
  var input = item.querySelector('.fill-input');
  var fb = item.querySelector('.fill-feedback');
  var ctx = item.querySelector('.fill-context');
  var ans = item.dataset.answer;
  var val = input.value.trim();
  if (!val) { input.focus(); return; }
  btn.classList.add('done');
  input.disabled = true;
  fb.classList.add('show');
  if (val === ans) {
    input.classList.add('correct');
    fb.classList.add('pass');
    fb.textContent = '\\u2713 Correct! ' + (ctx ? ctx.textContent : '');
  } else {
    input.classList.add('wrong');
    fb.classList.add('fail');
    fb.innerHTML = '\\u2717 Answer: <strong>' + ans + '</strong>. ' + (ctx ? ctx.textContent : '');
  }
}
document.querySelectorAll('.fill-input').forEach(function(inp) {
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var btn = this.closest('.fill-item').querySelector('.fill-check-btn');
      if (!btn.classList.contains('done')) checkFill(btn);
    }
  });
});
</script>

</body>
</html>`;

    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml, 'utf8');
  });

  console.log(`[confusables] Generated ${pairs.length} confusable word pair pages under /words/`);
  return pairs.map(p => p.slug);
}

// ============================================================
// 12. GENERATE GRAMMAR PATTERN PAGES
// ============================================================

function buildGrammarPatternPages() {
  console.log('[grammar-patterns] Generating grammar pattern pages...');
  const patterns = readJSON('grammar-patterns.json');

  patterns.forEach((pat, pi) => {
    const dir = path.join(ROOT, 'grammar', 'patterns', pat.slug);
    ensureDir(dir);

    // Patterns flagged customHtml have hand-enriched pages. Skip regeneration
    // to preserve the edits (same mechanism as confusables).
    if (pat.customHtml) {
      console.log(`[grammar-patterns] Skipping ${pat.slug} (customHtml)`);
      return;
    }

    // Find real HSK 4 questions using this pattern
    const patMatchQs = [];
    const patternKey = pat.pattern_cn.split('…')[0].trim() || pat.pattern_cn.split('/')[0].trim();
    for (let ti = 0; ti < 12 && patMatchQs.length < 2; ti++) {
      try {
        const tjson = readJSON(`test-${String(ti+1).padStart(2,'0')}.json`);
        for (const q of tjson.questions) {
          const text = (q.text || '') + ' ' + (q.options || []).join(' ');
          if (patternKey && text.includes(patternKey) && text.length >= 60 && text.length < 250) {
            patMatchQs.push({ test: ti+1, num: q.number, text: q.text || '', options: q.options || [], answer: q.correct_answer_index });
            if (patMatchQs.length >= 2) break;
          }
        }
      } catch (e) { /* skip */ }
    }
    const patRealQHtml = patMatchQs.length > 0
      ? `\n  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 12px;">HSK 4 Mock Test Questions Using ${escHtml(pat.pattern_cn)} / 真题示例</h2>
  <p style="color:var(--stone);margin-bottom:14px;font-size:14px;">${patMatchQs.length} real HSK 4 questions from our mock exams that test this pattern:</p>
  ${patMatchQs.map(mq => `<div style="background:white;border:1px solid var(--mist);border-radius:8px;padding:14px 18px;margin:10px 0;">
    <div style="font-size:11px;color:var(--accent);font-weight:700;text-transform:uppercase;margin-bottom:8px;">From <a href="/test/${String(mq.test).padStart(2,'0')}/" style="color:var(--accent);">HSK 4 Mock Test ${String(mq.test).padStart(2,'0')}</a> · Q${mq.num}</div>
    <div style="font-family:'Noto Sans SC',sans-serif;font-size:14px;line-height:1.6;margin-bottom:8px;">${escHtml(mq.text).replace(/\n/g, '<br>')}</div>
    ${mq.options.length > 0 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">${mq.options.map((o, oi) => `<span style="font-size:12px;padding:3px 9px;border-radius:5px;background:${oi === mq.answer ? 'var(--correct-soft)' : 'var(--paper)'};color:${oi === mq.answer ? 'var(--correct)' : 'var(--stone)'};">${escHtml(o)}${oi === mq.answer ? ' ✓' : ''}</span>`).join('')}</div>` : ''}
  </div>`).join('')}`
      : '';

    // Pattern-specific FAQ
    const patFaqs = [
      {
        q: `When is ${pat.pattern_cn} tested in HSK 4?`,
        a: `${pat.pattern_cn} (${pat.pattern_en}) appears in HSK 4 reading comprehension (Q66-85) when texts use complex sentences, in 阅读排序 (Q56-65) where this pattern's connectors signal sentence order, and in listening 段落 (Q26-45) where the speaker uses it to express ${pat.summary ? pat.summary.split('.')[0].toLowerCase() : 'logical relationships'}.`,
      },
      {
        q: `What's the most common mistake with ${pat.pattern_cn}?`,
        a: `${pat.compare_note ? pat.compare_note : `The most common HSK 4 mistake with ${pat.pattern_cn} is using it in contexts where another similar pattern would be more natural — read each example sentence carefully and notice the trigger words (time, condition, contrast).`}`,
      },
      {
        q: `Is ${pat.pattern_cn} required at HSK 4 or higher?`,
        a: `${pat.hsk_level || `${pat.pattern_cn} is part of the official HSK 4 syllabus and is tested explicitly in 阅读 (reading) and 听力 (listening). At HSK 5 the pattern continues to appear but in more nuanced contexts.`}`,
      },
    ];
    const patFaqHtml = `\n  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 12px;">${escHtml(pat.pattern_cn)} FAQ</h2>
  ${patFaqs.map(f => `<details style="background:var(--paper);border-radius:8px;padding:12px 16px;margin:6px 0;">
    <summary style="font-weight:600;cursor:pointer;color:var(--ink);">${escHtml(f.q)}</summary>
    <p style="margin:10px 0 0;color:var(--stone);line-height:1.7;font-size:14px;">${escHtml(f.a)}</p>
  </details>`).join('\n  ')}`;

    const patFaqJsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': patFaqs.map(f => ({
        '@type': 'Question',
        'name': f.q,
        'acceptedAnswer': { '@type': 'Answer', 'text': f.a },
      })),
    }, null, 2);

    const examplesHtml = pat.examples.map(ex => `
      <div class="ex-card">
        <div class="ex-cn chinese">${escHtml(ex.cn)}</div>
        <div class="ex-py">${escHtml(ex.py)}</div>
        <div class="ex-en">${escHtml(ex.en)}</div>
        ${ex.note ? `<div class="ex-note">${escHtml(ex.note)}</div>` : ''}
      </div>`).join('\n');

    const wrongHtml = pat.wrong_examples.map(we => `
      <div class="wrong-card">
        <div class="wrong-line"><span class="wrong-mark">\u2717</span> <span class="chinese">${escHtml(we.wrong)}</span></div>
        <div class="right-line"><span class="right-mark">\u2713</span> <span class="chinese">${escHtml(we.right)}</span></div>
        <div class="wrong-explain">${escHtml(we.explain)}</div>
      </div>`).join('\n');

    const quizHtml = pat.quiz.map((q, qi) => {
      const correctFirst = (pi + qi) % 2 === 0;
      const opt1 = correctFirst
        ? `<button class="q-opt" data-correct="1" onclick="answer(this,true)">${escHtml(q.correct)}</button>`
        : `<button class="q-opt" onclick="answer(this,false)">${escHtml(q.wrong)}</button>`;
      const opt2 = correctFirst
        ? `<button class="q-opt" onclick="answer(this,false)">${escHtml(q.wrong)}</button>`
        : `<button class="q-opt" data-correct="1" onclick="answer(this,true)">${escHtml(q.correct)}</button>`;
      return `
      <div class="q-item">
        <div class="q-stem chinese">${escHtml(q.stem)}</div>
        <div class="q-opts">${opt1} ${opt2}</div>
        <div class="q-explain">${escHtml(q.explain)}</div>
      </div>`;
    }).join('\n');

    const prevPat = pi > 0 ? patterns[pi - 1] : null;
    const nextPat = pi < patterns.length - 1 ? patterns[pi + 1] : null;

    const pageTitle = truncDesc(`${pat.pattern_cn} \u2014 HSK 4 Grammar | ${pat.pattern_en}`, 65);
    const pageDesc = truncDesc(`${pat.pattern_cn} (${pat.pattern_en}): ${pat.summary} Examples, common errors, and quiz.`);

    const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(pageTitle)}</title>
<meta name="description" content="${escHtml(pageDesc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/grammar/patterns/${pat.slug}/">

<meta property="og:title" content="${escHtml(pat.pattern_cn)} \u2014 HSK 4 Grammar">
<meta property="og:description" content="${escHtml(pageDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/grammar/patterns/${pat.slug}/">
<meta property="og:site_name" content="Mandarin Zone">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${escHtml(pat.pattern_cn)} \u2014 HSK 4 Grammar Pattern",
  "description": "${escHtml(pageDesc)}",
  "url": "https://hsk4.mandarinzone.com/grammar/patterns/${pat.slug}/",
  "author": { "@type": "Organization", "name": "Mandarin Zone", "url": "https://mandarinzone.com" },
  "inLanguage": ["en", "zh-CN"],
  "educationalLevel": "Intermediate"
}
</script>
<script type="application/ld+json">
${patFaqJsonLd}
</script>

<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<style>
  .pattern-box { background:var(--ink); color:var(--paper); border-radius:var(--radius); padding:24px 28px; margin:20px 0; text-align:center; }
  .pattern-formula { font-family:'Noto Sans SC',sans-serif; font-size:22px; font-weight:600; letter-spacing:1px; }
  .pattern-type { display:inline-block; background:var(--accent-soft); color:var(--accent); font-size:12px; font-weight:600; padding:4px 12px; border-radius:6px; margin-bottom:16px; text-transform:uppercase; letter-spacing:0.5px; }
  .ex-card { background:var(--paper); border:1px solid var(--mist); border-radius:8px; padding:16px 20px; margin:10px 0; }
  .ex-cn { font-family:'Noto Sans SC',sans-serif; font-size:17px; margin-bottom:4px; }
  .ex-py { font-size:13px; color:var(--stone); font-style:italic; }
  .ex-en { font-size:14px; color:var(--stone); margin-top:4px; }
  .ex-note { font-size:12px; color:var(--accent); margin-top:6px; padding-top:6px; border-top:1px solid var(--mist); }
  .wrong-card { background:#fff8f7; border:1px solid var(--accent-soft); border-radius:8px; padding:16px 20px; margin:10px 0; }
  .wrong-line { font-family:'Noto Sans SC',sans-serif; font-size:15px; margin-bottom:6px; }
  .wrong-mark { color:var(--accent); font-weight:700; font-size:16px; }
  .right-line { font-family:'Noto Sans SC',sans-serif; font-size:15px; margin-bottom:6px; }
  .right-mark { color:var(--jade); font-weight:700; font-size:16px; }
  .wrong-explain { font-size:13px; color:var(--stone); line-height:1.6; margin-top:8px; padding-top:8px; border-top:1px solid var(--accent-soft); }
  .compare-box { background:var(--gold-soft); border:1px solid #e8d5a0; border-radius:8px; padding:14px 18px; margin:20px 0; font-size:14px; line-height:1.6; }
  .compare-box strong { color:var(--gold); }
  .q-item { background:white; border:1px solid var(--mist); border-radius:8px; padding:16px; margin-bottom:10px; }
  .q-stem { font-size:16px; font-family:'Noto Sans SC',sans-serif; margin-bottom:12px; line-height:1.5; }
  .q-opts { display:flex; gap:8px; flex-wrap:wrap; }
  .q-opt { padding:10px 20px; border:1px solid var(--mist); border-radius:8px; background:white; font-size:14px; cursor:pointer; transition:all 0.15s; font-family:'DM Sans',sans-serif; }
  .q-opt:hover { border-color:var(--accent); background:var(--accent-soft); }
  .q-opt.correct { background:var(--jade-soft); border-color:var(--jade); color:var(--jade); font-weight:600; }
  .q-opt.wrong { background:#ffe0e0; border-color:var(--accent); color:var(--accent); }
  .q-opt.disabled { pointer-events:none; opacity:0.7; }
  .q-opt.disabled.correct { opacity:1; }
  .q-explain { display:none; margin-top:10px; font-size:13px; color:var(--stone); line-height:1.6; padding:10px 14px; background:var(--paper); border-radius:6px; }
  .breadcrumb { font-size:13px; color:var(--stone); margin-bottom:8px; }
  .breadcrumb a { color:var(--accent); text-decoration:none; }
  .fill-item { background:white; border:1px solid var(--mist); border-radius:8px; padding:16px; margin-bottom:10px; }
  .fill-sentence { font-size:17px; line-height:1.8; margin-bottom:10px; }
  .fill-input { width:80px; border:none; border-bottom:2px solid var(--accent); background:transparent; font-size:17px; font-family:'Noto Sans SC',sans-serif; text-align:center; outline:none; padding:2px 4px; }
  .fill-input:focus { border-bottom-color:var(--jade); }
  .fill-input.correct { border-bottom-color:var(--jade); color:var(--jade); font-weight:600; }
  .fill-input.wrong { border-bottom-color:var(--accent); color:var(--accent); }
  .fill-check-btn { padding:6px 16px; border:1px solid var(--mist); border-radius:6px; background:white; font-size:13px; font-weight:600; cursor:pointer; }
  .fill-check-btn:hover { border-color:var(--accent); background:var(--accent-soft); }
  .fill-check-btn.done { pointer-events:none; opacity:0.5; }
  .fill-feedback { margin-top:8px; font-size:13px; display:none; padding:8px 12px; border-radius:6px; }
  .fill-feedback.show { display:block; }
  .fill-feedback.pass { background:var(--jade-soft); color:var(--jade); }
  .fill-feedback.fail { background:#ffe0e0; color:var(--accent); }
  .pat-nav { display:flex; justify-content:space-between; margin:40px 0; flex-wrap:wrap; gap:12px; }
  @media (max-width:600px) { .pattern-formula { font-size:18px; } .q-opts { flex-direction:column; } .fill-input { width:60px; } }
</style>
</head>
<body>

<header>
  <div class="header-inner">
    <a href="/" class="logo"><img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="logo-mark" loading="eager"><div class="logo-text">HSK 4 <span>Mock Exam</span></div></a>
    <nav class="site-nav" aria-label="Primary">
      <a href="/" class="nav-link">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link">Vocabulary</a>
      <a href="/characters/" class="nav-link">Characters</a>
      <a href="/grammar/" class="nav-link" style="opacity:1;">Grammar</a>
      <a href="/sentences/" class="nav-link">Sentences</a>
      <a href="/strategies/" class="nav-link">Strategies</a>
      <a href="/traps/" class="nav-link">Traps</a>
      <a href="/topics/" class="nav-link">Topics</a>
      <a href="/words/" class="nav-link">Words</a>
      <a href="/compare/" class="nav-link">Compare</a>
      <a href="/guide/" class="nav-link">Guide</a>
    </nav>
  </div>
</header>

<main>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/grammar/">Grammar</a> &rsaquo; ${escHtml(pat.pattern_cn)}
  </nav>

  <div class="hero">
    <div class="pattern-type">${escHtml(pat.type_cn)} \u00B7 ${escHtml(pat.hsk_level)}</div>
    <h1 class="chinese" style="font-family:'Noto Serif SC',serif;">HSK 4 Pattern: ${escHtml(pat.pattern_cn)}</h1>
    <p>${escHtml(pat.summary)}</p>
  </div>

  <div class="pattern-box">
    <div class="pattern-formula">${escHtml(pat.structure)}</div>
  </div>

  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:28px 0 8px;">Examples / \u4F8B\u53E5</h2>
  ${examplesHtml}

  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 8px;">Common Errors / \u5E38\u89C1\u9519\u8BEF</h2>
  ${wrongHtml}

  ${pat.compare_with ? `
  <div class="compare-box">
    <strong>Easily confused:</strong> ${escHtml(pat.compare_note)}
    <a href="${pat.compare_with}" style="color:var(--gold);font-weight:600;margin-left:4px;">See comparison \u2192</a>
  </div>` : ''}

  ${pat.exercises && pat.exercises.length > 0 ? generateFillExercises(pat.exercises, 'Complete each sentence using this pattern. Type the missing word(s) and press Enter.') : ''}

  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 8px;">Quick Quiz / \u5C0F\u6D4B\u9A8C</h2>
  ${quizHtml}

  <div style="text-align:center;margin:32px 0;">
    <a href="/grammar/" class="btn btn-primary">All Grammar Topics</a>
    <a href="/" class="btn btn-secondary" style="margin-left:8px;">Take a Mock Exam</a>
    <a href="/writing/sentence-order/" class="btn btn-ghost" style="margin-left:8px;">Sentence Ordering</a>
  </div>

${patRealQHtml}

${patFaqHtml}

  <div class="pat-nav">
    ${prevPat ? `<a href="/grammar/patterns/${prevPat.slug}/" class="btn btn-ghost">&larr; ${escHtml(prevPat.pattern_cn)}</a>` : '<span></span>'}
    <a href="/grammar/" class="btn btn-secondary">Grammar Hub</a>
    ${nextPat ? `<a href="/grammar/patterns/${nextPat.slug}/" class="btn btn-ghost">${escHtml(nextPat.pattern_cn)} &rarr;</a>` : '<span></span>'}
  </div>
</main>

<footer>
  <div class="footer-brand">
    <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="footer-brand-link">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="footer-logo" loading="lazy">
      <div>
        <div class="footer-brand-name">Mandarin Zone</div>
        <div class="footer-tagline">Learn Chinese in Beijing &amp; Online \u00b7 Since 2008</div>
      </div>
    </a>
    <div class="footer-cta">
      <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="btn btn-ghost">Visit Website</a>
      <a href="https://www.mandarinzone.com/contact-us/" target="_blank" rel="noopener" class="btn btn-ghost">Contact Us</a>
    </div>
  </div>
  <p class="footer-links" style="margin-top:4px;"><a href="/">Mock Exams</a> \u00B7 <a href="/vocabulary/">Vocabulary</a> \u00B7 <a href="/grammar/">Grammar</a> \u00B7 <a href="/words/">Confusable Words</a> \u00B7 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
</footer>

<script>
function answer(btn, correct) {
  const item = btn.closest('.q-item');
  if (item.dataset.answered === 'true') return;
  item.dataset.answered = 'true';
  item.querySelectorAll('.q-opt').forEach(o => {
    o.classList.add('disabled');
    if (o.dataset.correct === '1') o.classList.add('correct');
  });
  if (!correct) btn.classList.add('wrong');
  item.querySelector('.q-explain').style.display = 'block';
}
function checkFill(btn) {
  var item = btn.closest('.fill-item');
  var input = item.querySelector('.fill-input');
  var fb = item.querySelector('.fill-feedback');
  var hint = item.querySelector('.fill-hint');
  var ans = item.dataset.answer;
  var val = input.value.trim();
  if (!val) { input.focus(); return; }
  btn.classList.add('done');
  input.disabled = true;
  fb.classList.add('show');
  // Check if answer matches (handle multi-part answers like "不管...都")
  var correct = val === ans || val === ans.replace('...','') || ans.indexOf(val) === 0;
  if (correct) {
    input.classList.add('correct');
    fb.classList.add('pass');
    fb.textContent = '\\u2713 Correct! ' + (hint ? hint.textContent : '');
  } else {
    input.classList.add('wrong');
    fb.classList.add('fail');
    fb.innerHTML = '\\u2717 Answer: <strong>' + ans + '</strong>. ' + (hint ? hint.textContent : '');
  }
}
document.querySelectorAll('.fill-input').forEach(function(inp) {
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      var btn = this.closest('.fill-item').querySelector('.fill-check-btn');
      if (!btn.classList.contains('done')) checkFill(btn);
    }
  });
});
</script>

</body>
</html>`;

    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml, 'utf8');
  });

  console.log(`[grammar-patterns] Generated ${patterns.length} grammar pattern pages`);
  return patterns.map(p => p.slug);
}

// ============================================================
// 8b. GRAMMAR PATTERNS HUB: /grammar/patterns/index.html
// ============================================================
// The eight pattern pages used to live under a directory with no index,
// so breadcrumbs and hand-typed URLs hit a 404. This hub lists them all.

function buildGrammarPatternsHub() {
  console.log('[grammar-patterns] Generating patterns hub page...');
  const patterns = readJSON('grammar-patterns.json');

  const cards = patterns.map(pat => `
    <a class="pattern-card" href="/grammar/patterns/${pat.slug}/">
      <div class="pattern-card-type">${escHtml(pat.type_cn || '')}</div>
      <div class="pattern-card-cn chinese">${escHtml(pat.pattern_cn)}</div>
      <div class="pattern-card-en">${escHtml(pat.pattern_en || '')}</div>
      <p class="pattern-card-summary">${escHtml((pat.summary || '').split('.')[0])}.</p>
    </a>`).join('\n');

  const itemListJsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': 'HSK 4 Sentence Patterns — 复句与固定格式',
    'description': 'All HSK 4 complex-sentence patterns from the official grammar syllabus, each with examples, common errors, and a quiz.',
    'url': 'https://hsk4.mandarinzone.com/grammar/patterns/',
    'inLanguage': ['en', 'zh-CN'],
    'isAccessibleForFree': true,
    'hasPart': patterns.map(pat => ({
      '@type': 'Article',
      'name': `${pat.pattern_cn} (${pat.pattern_en || ''})`,
      'url': `https://hsk4.mandarinzone.com/grammar/patterns/${pat.slug}/`,
    })),
  }, null, 2);

  const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>HSK 4 Sentence Patterns — ${patterns.length} 复句句型 Explained | Mandarin Zone</title>
<meta name="description" content="All ${patterns.length} HSK 4 complex-sentence patterns (尽管…但是, 不管…都, 即使…也, 连…都/也 and more) with examples, common errors, and quizzes. From the official syllabus.">
<link rel="canonical" href="https://hsk4.mandarinzone.com/grammar/patterns/">

<meta property="og:title" content="HSK 4 Sentence Patterns — Complex Patterns with Exercises">
<meta property="og:description" content="All ${patterns.length} HSK 4 complex-sentence patterns with examples, common errors, and quizzes.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://hsk4.mandarinzone.com/grammar/patterns/">
<meta property="og:site_name" content="Mandarin Zone">

<script type="application/ld+json">
${itemListJsonLd}
</script>

<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<style>
  .hero { text-align:center; padding:40px 0 24px; }
  .hero h1 { font-family:'Noto Serif SC',serif; font-size:clamp(24px,4vw,34px); margin-bottom:10px; }
  .hero p { color:var(--stone); max-width:640px; margin:0 auto; line-height:1.7; }
  .breadcrumb { font-size:13px; color:var(--stone); margin-bottom:8px; }
  .breadcrumb a { color:var(--accent); text-decoration:none; }
  .pattern-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; margin:28px 0 40px; }
  .pattern-card { display:block; background:white; border:1px solid var(--mist); border-radius:var(--radius); padding:18px 20px; text-decoration:none; color:var(--ink); transition:all .15s; }
  .pattern-card:hover { border-color:var(--accent); transform:translateY(-2px); box-shadow:0 6px 18px rgba(0,0,0,.06); }
  .pattern-card-type { font-size:11px; color:var(--accent); font-weight:700; text-transform:uppercase; margin-bottom:6px; }
  .pattern-card-cn { font-family:'Noto Serif SC',serif; font-size:20px; margin-bottom:2px; }
  .pattern-card-en { font-size:13px; color:var(--stone); margin-bottom:8px; }
  .pattern-card-summary { font-size:13px; color:var(--stone); line-height:1.6; margin:0; }
</style>
</head>
<body>

<header>
  <div class="header-inner">
    <a href="/" class="logo"><img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="logo-mark" loading="eager"><div class="logo-text">HSK 4 <span>Mock Exam</span></div></a>
    <nav class="site-nav" aria-label="Primary">
      <a href="/" class="nav-link">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link">Vocabulary</a>
      <a href="/characters/" class="nav-link">Characters</a>
      <a href="/grammar/" class="nav-link" style="opacity:1;">Grammar</a>
      <a href="/sentences/" class="nav-link">Sentences</a>
      <a href="/strategies/" class="nav-link">Strategies</a>
      <a href="/traps/" class="nav-link">Traps</a>
      <a href="/topics/" class="nav-link">Topics</a>
      <a href="/words/" class="nav-link">Words</a>
      <a href="/compare/" class="nav-link">Compare</a>
      <a href="/guide/" class="nav-link">Guide</a>
    </nav>
  </div>
</header>

<main>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/grammar/">Grammar</a> &rsaquo; Sentence Patterns
  </nav>

  <div class="hero">
    <h1>HSK 4 Sentence Patterns <span class="chinese" style="color:var(--accent);">复句句型</span></h1>
    <p>The complex-sentence patterns the official HSK 4 grammar syllabus adds at this level — concessive, conditional, hypothetical and emphatic structures. Each page has examples, common errors, fill-in exercises and a quiz.</p>
  </div>

  <div class="pattern-grid">
${cards}
  </div>

  <p style="color:var(--stone);line-height:1.8;margin-bottom:40px;">
    Looking for broader grammar coverage? Browse the <a href="/grammar/" style="color:var(--accent);">full HSK 4 grammar guide</a> (把字句, 被动句, 比较句, complements, measure words and more), drill <a href="/writing/sentence-order/" style="color:var(--accent);">sentence ordering</a>, or test yourself with the <a href="/" style="color:var(--accent);">12 free mock exams</a>.
  </p>
</main>

<footer>
  <div class="footer-brand">
    <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="footer-brand-link">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="footer-logo" loading="lazy">
      <div>
        <div class="footer-brand-name">Mandarin Zone</div>
        <div class="footer-tagline">Learn Chinese in Beijing &amp; Online · Since 2008</div>
      </div>
    </a>
    <div class="footer-cta">
      <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="btn btn-ghost">Visit Website</a>
      <a href="https://www.mandarinzone.com/contact-us/" target="_blank" rel="noopener" class="btn btn-ghost">Contact Us</a>
    </div>
  </div>
  <p class="footer-links" style="margin-top:4px;"><a href="/">Mock Exams</a> · <a href="/vocabulary/">Vocabulary</a> · <a href="/grammar/">Grammar</a> · <a href="/writing/">Writing</a> · <a href="/guide/">Study Guide</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
</footer>

</body>
</html>`;

  const hubDir = path.join(ROOT, 'grammar', 'patterns');
  ensureDir(hubDir);
  fs.writeFileSync(path.join(hubDir, 'index.html'), pageHtml, 'utf8');
  console.log('[grammar-patterns] Generated grammar/patterns/index.html hub');
}

// ============================================================
// 13. ADD MOCK EXAM LINKS TO HUB PAGES
// ============================================================

function addTestLinksToHubs() {
  console.log('[hub-links] Adding mock exam links to hub pages...');
  const hubPages = [
    'vocabulary/index.html',
    'grammar/index.html',
    'topics/index.html',
    'words/index.html',
    'writing/index.html',
    'guide/index.html',
  ];

  const testLinkBlock = `\n  <!-- hub-test-link -->
  <div style="background:white;border:1px solid var(--mist);border-radius:var(--radius);padding:16px 20px;margin:24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
    <span style="font-size:14px;color:var(--stone);">Practice what you learned with our free mock exams</span>
    <a href="/" class="btn btn-primary" style="font-size:13px;padding:8px 18px;">Take a Mock Exam \u2192</a>
  </div>`;

  let count = 0;
  hubPages.forEach(page => {
    const htmlPath = path.join(ROOT, page);
    if (!fs.existsSync(htmlPath)) return;
    let html = fs.readFileSync(htmlPath, 'utf8');
    if (html.includes('hub-test-link')) return;
    // Insert before </main>
    html = html.replace(/<\/main>/, `${testLinkBlock}\n</main>`);
    fs.writeFileSync(htmlPath, html, 'utf8');
    count++;
  });
  console.log(`[hub-links] Added mock exam links to ${count} hub pages`);
}

// ============================================================
// 14. CHARACTER WRITING PRACTICE (/characters/ + /characters/{字}/)
// ============================================================

function buildCharacterPages() {
  console.log('[characters] Generating HSK 4 character writing pages...');
  const chars = readJSON('hsk4-characters.json');
  // Recognition-only characters (认读字): the official syllabus lists 441
  // characters to recognize; the 150 above must also be handwritten. The
  // remaining 291 get recognition pages (reading-focused, stroke animation
  // still available, no handwriting requirement).
  const renduChars = fs.existsSync(path.join(DATA, 'hsk4-rendu-characters.json'))
    ? readJSON('hsk4-rendu-characters.json').map(c => ({ ...c, tier: 'recognition' }))
    : [];
  const vocab = readJSON('vocabulary.json');

  // Reverse index: each hanzi -> words from vocabulary.json that contain it
  const charToWords = {};
  vocab.forEach(w => {
    if (!w.word) return;
    const seen = new Set();
    for (const ch of w.word) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      if (!charToWords[ch]) charToWords[ch] = [];
      charToWords[ch].push(w);
    }
  });

  const charsDir = path.join(ROOT, 'characters');
  ensureDir(charsDir);

  // Reverse lookup: character -> task pages, via the words containing it.
  const wordTaskMap = buildWordTaskMap();
  const charTaskLinksHtml = (c) => {
    const hits = {};
    (charToWords[c.char] || []).forEach(w => {
      const t = wordTaskMap[w.id];
      if (!t) return;
      if (!hits[t.slug]) hits[t.slug] = { task: t, words: [] };
      hits[t.slug].words.push(w.word);
    });
    const ranked = Object.values(hits)
      .sort((a, b) => b.words.length - a.words.length || a.task.slug.localeCompare(b.task.slug))
      .slice(0, 4);
    if (ranked.length === 0) return '';
    const chips = ranked.map(({ task, words }) => `
    <a href="/topics/${task.slug}/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
      <div class="chinese" style="font-size:14px;font-weight:600;">\u{1F4DA} ${escHtml(task.task_cn)}</div>
      <div style="font-size:12px;color:var(--stone);margin-top:3px;">${escHtml(task.task_en)} \u00B7 <span class="chinese">${escHtml(words.slice(0, 3).join('\u3001'))}</span></div>
    </a>`).join('');
    return `<section>
    <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 8px;">Tasks Featuring ${escHtml(c.char)} / \u76F8\u5173\u4EFB\u52A1</h2>
    <p style="color:var(--stone);font-size:14px;margin-bottom:12px;">Words containing <span class="chinese">${escHtml(c.char)}</span> appear in these official HSK 4 task scenarios \u2014 study the character in context:</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(230px, 1fr));gap:12px;">${chips}
    </div>
  </section>`;
  };

  // Shared header/footer renderer (avoids duplicating nav across pages)
  const renderNav = (active) => `
<header>
  <div class="header-inner">
    <a href="/" class="logo">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="logo-mark" loading="eager">
      <div class="logo-text">HSK 4 <span>Mock Exam</span></div>
    </a>
    <nav class="site-nav" aria-label="Primary">
      <a href="/" class="nav-link${active==='home'?' is-active':''}">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link${active==='vocab'?' is-active':''}">Vocabulary</a>
      <a href="/characters/" class="nav-link${active==='characters'?' is-active':''}">Characters</a>
      <a href="/grammar/" class="nav-link${active==='grammar'?' is-active':''}">Grammar</a>
      <a href="/sentences/" class="nav-link${active==='sentences'?' is-active':''}">Sentences</a>
      <a href="/topics/" class="nav-link${active==='topics'?' is-active':''}">Topics</a>
      <a href="/writing/" class="nav-link${active==='writing'?' is-active':''}">Writing</a>
      <a href="/words/" class="nav-link${active==='words'?' is-active':''}">Words</a>
      <a href="/guide/" class="nav-link${active==='guide'?' is-active':''}">Guide</a>
    </nav>
  </div>
</header>`;

  const renderFooter = () => `
<footer>
  <div class="footer-brand">
    <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="footer-brand-link">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="footer-logo" loading="lazy">
      <div>
        <div class="footer-brand-name">Mandarin Zone</div>
        <div class="footer-tagline">Learn Chinese in Beijing &amp; Online · Since 2008</div>
      </div>
    </a>
    <div class="footer-cta">
      <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="btn btn-ghost">Visit Website</a>
      <a href="https://www.mandarinzone.com/contact-us/" target="_blank" rel="noopener" class="btn btn-ghost">Contact Us</a>
    </div>
  </div>
  <p class="footer-links" style="margin-top:4px;"><a href="/">Mock Exams</a> · <a href="/vocabulary/">Vocabulary</a> · <a href="/characters/">Characters</a> · <a href="/grammar/">Grammar</a> · <a href="/writing/">Writing</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
</footer>`;

  // ---- Hub page: /characters/index.html ----
  const gridHtml = chars.map((c, i) => `
    <a class="char-card" href="/characters/${encodeURIComponent(c.char)}/" data-char="${escHtml(c.char)}" data-pinyin="${escHtml(c.pinyin)}" data-idx="${i}">
      <span class="char-glyph chinese">${escHtml(c.char)}</span>
      <span class="char-pinyin">${escHtml(c.pinyin)}</span>
    </a>`).join('');

  const hubTitle = `HSK 4 Characters \u2014 150 \u4E66\u5199\u5B57 + 441 \u8BA4\u8BFB\u5B57 Stroke Order | Mandarin Zone`;
  const hubDesc = `Learn to write all ${chars.length} HSK 4 required characters with animated stroke order and interactive handwriting practice. Free, by Mandarin Zone Beijing.`;

  const hubHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(hubTitle)}</title>
<meta name="description" content="${escHtml(hubDesc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/characters/">
<meta property="og:title" content="${escHtml(hubTitle)}">
<meta property="og:description" content="${escHtml(hubDesc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://hsk4.mandarinzone.com/characters/">
<meta property="og:site_name" content="Mandarin Zone">
<meta property="og:image" content="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png">
<meta property="og:image:alt" content="Mandarin Zone — HSK 4 character writing practice">
<meta name="twitter:card" content="summary">
<meta name="twitter:image" content="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "HSK 4 Required Characters",
  "description": "${escHtml(hubDesc)}",
  "url": "https://hsk4.mandarinzone.com/characters/",
  "inLanguage": ["en", "zh-CN"],
  "isAccessibleForFree": true,
  "about": { "@type": "Thing", "name": "HSK 4 Chinese characters writing" },
  "numberOfItems": ${chars.length}
}
</script>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
</head>
<body>
${renderNav('characters')}
<main>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; Characters
  </nav>

  <section style="margin:24px 0 8px;">
    <h1 style="font-family:'Noto Serif SC',serif;font-size:clamp(24px,4vw,34px);margin-bottom:8px;">HSK 4 Required Characters / HSK 4 必写汉字</h1>
    <p style="color:var(--stone);line-height:1.7;max-width:680px;">
      All <strong>${chars.length} characters</strong> the HSK 4 syllabus expects you to be able to handwrite. Tap any character to see its stroke order animation and try the interactive handwriting practice — your strokes are checked one by one.
    </p>
  </section>

  <div class="char-toolbar" role="search">
    <input type="search" id="char-search" placeholder="Search by character or pinyin (e.g. ai, 爱)" aria-label="Search characters">
    <select id="char-sort" aria-label="Sort characters">
      <option value="default">Default order</option>
      <option value="pinyin">Sort: Pinyin A→Z</option>
    </select>
    <span id="char-count" style="color:var(--stone);font-size:var(--fs-sm);">${chars.length} characters</span>
  </div>

  <div class="char-grid" id="char-grid">${gridHtml}
  </div>
  <div class="char-empty" id="char-empty" style="display:none;">No characters match your search.</div>

  ${renduChars.length ? `<section style="margin-top:48px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin-bottom:8px;">Recognition Characters / 认读字 (${renduChars.length})</h2>
    <p style="color:var(--stone);line-height:1.7;margin-bottom:16px;max-width:680px;">
      Beyond the ${chars.length} writing characters above, the official syllabus lists ${renduChars.length} more characters you must <strong>recognize when reading</strong> — handwriting them is not required. Tap any character for its meaning, pinyin, stroke order, and the HSK 4 words that use it.
    </p>
    <div class="char-grid">
      ${renduChars.map(rc => `<a class="char-card" href="/characters/${encodeURIComponent(rc.char)}/" data-char="${escHtml(rc.char)}" data-pinyin="${escHtml(rc.pinyin)}">
      <span class="char-glyph chinese">${escHtml(rc.char)}</span>
      <span class="char-pinyin">${escHtml(rc.pinyin)}</span>
    </a>`).join('\n    ')}
    </div>
  </section>` : ''}

  <section style="margin-top:48px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin-bottom:12px;">How to Practice HSK 4 Character Writing</h2>
    <p style="color:var(--stone);line-height:1.8;margin-bottom:12px;">
      The HSK 4 writing section (书写) tests your ability to physically write Chinese characters from memory. Unlike multiple-choice questions, there is no shortcut — only spaced, deliberate practice builds the muscle memory you need on test day. Each character page on this site offers two modes:
    </p>
    <ul style="color:var(--stone);line-height:1.9;padding-left:20px;margin-bottom:12px;">
      <li><strong>Animate</strong> — Watch the correct stroke order play out one stroke at a time. The order matters: incorrect stroke order is the #1 reason characters look "wrong" even when all the strokes are present.</li>
      <li><strong>Practice</strong> — Trace the character with your mouse or finger. Each stroke is checked; mistakes are highlighted and you can retry. Aim to complete each character three times in a row without mistakes before moving on.</li>
    </ul>
    <p style="color:var(--stone);line-height:1.8;">
      Combine this with our <a href="/vocabulary/" style="color:var(--accent);">HSK 4 vocabulary list</a> and <a href="/writing/" style="color:var(--accent);">writing practice exercises</a> for a full study routine.
    </p>
  </section>

  <section style="margin-top:40px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin-bottom:12px;">FAQ</h2>
    <details style="background:white;border:1px solid var(--mist);border-radius:var(--radius-sm);padding:14px 18px;margin-bottom:8px;">
      <summary style="cursor:pointer;font-weight:600;">How many characters does HSK 4 require you to write?</summary>
      <p style="color:var(--stone);line-height:1.7;margin-top:10px;">The official HSK 4 syllabus (《HSK考试大纲》) lists exactly <strong>${chars.length} handwriting characters (书写字)</strong> you must be able to write, plus 441 reading-recognition characters (认读字) you only need to recognize. This page covers the complete official handwriting list — verified character-by-character against the syllabus.</p>
    </details>
    <details style="background:white;border:1px solid var(--mist);border-radius:var(--radius-sm);padding:14px 18px;margin-bottom:8px;">
      <summary style="cursor:pointer;font-weight:600;">Does the HSK 4 exam still test handwriting?</summary>
      <p style="color:var(--stone);line-height:1.7;margin-top:10px;">The paper-based HSK 4 includes a writing section (书写) where you compose sentences using given vocabulary. Even if you take the computer-based version, the ability to handwrite characters fluently is essential for everyday use of Chinese.</p>
    </details>
    <details style="background:white;border:1px solid var(--mist);border-radius:var(--radius-sm);padding:14px 18px;">
      <summary style="cursor:pointer;font-weight:600;">Why does stroke order matter?</summary>
      <p style="color:var(--stone);line-height:1.7;margin-top:10px;">Correct stroke order produces balanced, recognizable characters and makes handwriting much faster. It also helps you correctly identify and write characters you have only seen briefly — a major advantage during the timed writing section.</p>
    </details>
  </section>
</main>
${renderFooter()}
<script>
(function(){
  var input = document.getElementById('char-search');
  var sortSel = document.getElementById('char-sort');
  var grid = document.getElementById('char-grid');
  var empty = document.getElementById('char-empty');
  var count = document.getElementById('char-count');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.char-card'));

  function norm(s){ return (s||'').toString().toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,''); }

  function applyFilter(){
    var q = norm(input.value.trim());
    var visible = 0;
    cards.forEach(function(card){
      var ch = card.dataset.char;
      var py = norm(card.dataset.pinyin);
      var match = !q || ch.indexOf(q) !== -1 || py.indexOf(q) !== -1;
      card.classList.toggle('is-hidden', !match);
      if (match) visible++;
    });
    count.textContent = visible + ' / ' + cards.length + ' characters';
    empty.style.display = visible === 0 ? 'block' : 'none';
  }

  function applySort(){
    var mode = sortSel.value;
    var ordered = cards.slice();
    if (mode === 'pinyin') {
      ordered.sort(function(a,b){
        return norm(a.dataset.pinyin).localeCompare(norm(b.dataset.pinyin));
      });
    } else {
      ordered.sort(function(a,b){ return (+a.dataset.idx) - (+b.dataset.idx); });
    }
    var frag = document.createDocumentFragment();
    ordered.forEach(function(c){ frag.appendChild(c); });
    grid.appendChild(frag);
  }

  input.addEventListener('input', applyFilter);
  sortSel.addEventListener('change', function(){ applySort(); applyFilter(); });
})();
</script>
</body>
</html>`;

  fs.writeFileSync(path.join(charsDir, 'index.html'), hubHtml, 'utf8');

  // ---- v2 enhanced template support ----
  // Compute density rank: chars sorted by HSK 4 vocab appearance frequency.
  // Used both to pick the top 30 (which get the enhanced template) and to
  // surface a "rank #N by HSK 4 vocab density" stat in the Quick Answer.
  const charListIndex = new Map(chars.map((c, idx) => [c.char, idx]));
  const densityRank = chars
    .map(c => ({ char: c.char, hits: (charToWords[c.char] || []).length }))
    .sort((a, b) => b.hits - a.hits || charListIndex.get(a.char) - charListIndex.get(b.char));
  const charToRank = new Map(densityRank.map((r, idx) => [r.char, idx + 1]));
  const TOP_N = 30;
  const top30Set = new Set(densityRank.slice(0, TOP_N).map(r => r.char));

  // Load Make Me a Hanzi structured data subset
  const mmah = fs.existsSync(path.join(DATA, 'character-data.json'))
    ? readJSON('character-data.json')
    : {};

  // Same-radical cross-reference within all 150
  const radicalToChars = {};
  chars.forEach(c => {
    const e = mmah[c.char];
    if (!e || !e.radical) return;
    if (!radicalToChars[e.radical]) radicalToChars[e.radical] = [];
    radicalToChars[e.radical].push(c);
  });

  // IDS operator descriptions for decomposition
  const IDS_DESC = {
    '⿰': { label: 'Left + Right', positions: ['left', 'right'] },
    '⿱': { label: 'Top + Bottom', positions: ['top', 'bottom'] },
    '⿲': { label: 'Left + Middle + Right', positions: ['left', 'middle', 'right'] },
    '⿳': { label: 'Top + Middle + Bottom', positions: ['top', 'middle', 'bottom'] },
    '⿴': { label: 'Outer surrounds Inner', positions: ['outer', 'inner'] },
    '⿵': { label: 'Outer (open below) + Inner', positions: ['outer', 'inner'] },
    '⿶': { label: 'Outer (open above) + Inner', positions: ['outer', 'inner'] },
    '⿷': { label: 'Outer (open right) + Inner', positions: ['outer', 'inner'] },
    '⿸': { label: 'Upper-left envelops Inner', positions: ['outer', 'inner'] },
    '⿹': { label: 'Upper-right envelops Inner', positions: ['outer', 'inner'] },
    '⿺': { label: 'Lower-left envelops Inner', positions: ['outer', 'inner'] },
    '⿻': { label: 'Overlap', positions: ['back', 'front'] },
  };
  function parseDecomp(ids) {
    if (!ids || ids === '？') return null;
    const op = ids[0];
    if (!IDS_DESC[op]) return null;
    const comps = [];
    for (let k = 1; k < ids.length; k++) {
      const ch = ids[k];
      if (IDS_DESC[ch] || ch === '？') continue;
      comps.push(ch);
    }
    return { op, label: IDS_DESC[op].label, comps };
  }

  function splitMeanings(def) {
    if (!def) return [];
    return def.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  }

  function etymologySentence(c, e) {
    if (!e || !e.etymology) return '';
    const ety = e.etymology;
    if (ety.type === 'pictophonetic' && ety.semantic && ety.phonetic) {
      const hint = ety.hint ? ` (${escHtml(ety.hint)})` : '';
      return `<span class="chinese">${escHtml(c.char)}</span> is a phono-semantic compound. The semantic component <strong class="chinese">${escHtml(ety.semantic)}</strong>${hint} carries the meaning, while the phonetic component <strong class="chinese">${escHtml(ety.phonetic)}</strong> originally indicated the sound.`;
    }
    if (ety.type === 'ideographic') {
      const hint = ety.hint ? ` ${escHtml(ety.hint)}.` : '';
      return `<span class="chinese">${escHtml(c.char)}</span> is an ideographic compound — its meaning is suggested by the combination of its parts rather than by sound.${hint}`;
    }
    if (ety.type === 'pictographic') {
      const hint = ety.hint ? ` It originally depicted ${escHtml(ety.hint)}.` : '';
      return `<span class="chinese">${escHtml(c.char)}</span> is a pictograph — a stylized image of the thing it names.${hint}`;
    }
    return '';
  }

  function renderEnhancedDetail(c, i, prev, next, wordsHtml, wordsForChar) {
    const e = mmah[c.char] || {};
    const strokes = e.matches ? e.matches.length : null;
    const radical = e.radical || null;
    const radDef = radical && mmah[radical] ? (mmah[radical].definition || '').split(/[;,]/)[0].trim() : '';
    const meanings = splitMeanings(e.definition).slice(0, 6);
    const pinyinList = (e.pinyin && e.pinyin.length) ? e.pinyin : [c.pinyin];
    const decomp = parseDecomp(e.decomposition);
    const ety = etymologySentence(c, e);

    const sameRadicalOthers = radical
      ? (radicalToChars[radical] || []).filter(x => x.char !== c.char)
      : [];

    // Quick Answer block. The first segment ("X (pinyin) means Y") reads as
    // one clause and shouldn't be comma-joined to the rest.
    const head = `<strong class="chinese">${escHtml(c.char)}</strong> (${pinyinList.map(escHtml).join(' / ')}) means <em>${escHtml(e.definition || c.meaning)}</em>`;
    const tail = [];
    if (strokes) tail.push(`is written in <strong>${strokes} strokes</strong>`);
    if (radical) tail.push(`with the radical <strong class="chinese">${escHtml(radical)}</strong>${radDef ? ` (${escHtml(radDef)})` : ''}`);
    tail.push(`and is one of the 150 HSK 4 required writing characters (rank #${charToRank.get(c.char)} by appearance in HSK 4 vocabulary)`);
    const quickAnswer = `${head}. It ${tail.join(', ')}.`;

    // Pinyin & meanings section
    const meaningsHtml = meanings.length > 1
      ? `<ul style="margin:6px 0 0 20px;color:var(--ink);line-height:1.7;">${meanings.map(m => `<li>${escHtml(m)}</li>`).join('')}</ul>`
      : `<p style="color:var(--ink);">${escHtml(meanings[0] || c.meaning)}</p>`;

    const pinyinHtml = pinyinList.length > 1
      ? `<p style="color:var(--stone);">This character has <strong>${pinyinList.length} readings</strong>: ${pinyinList.map(p => `<span class="vw-pinyin" style="font-size:var(--fs-md);margin-right:8px;">${escHtml(p)}</span>`).join('')}. The reading depends on which word the character appears in.</p>`
      : `<p style="color:var(--stone);">Pronounced <span class="vw-pinyin" style="font-size:var(--fs-md);">${escHtml(pinyinList[0])}</span>.</p>`;

    // Decomposition
    let decompHtml = '';
    if (decomp && decomp.comps.length > 0) {
      const compCards = decomp.comps.map((ch, idx) => {
        const compEntry = mmah[ch];
        const compDef = compEntry ? (compEntry.definition || '').split(/[;,]/)[0].trim() : '';
        const inOurSet = chars.some(x => x.char === ch);
        const inner = `
          <span class="char-glyph chinese" style="font-size:32px;">${escHtml(ch)}</span>
          <span class="char-pinyin" style="color:var(--stone);font-size:var(--fs-xs);">${IDS_DESC[decomp.op].positions[idx] || 'part'}</span>
          ${compDef ? `<span style="font-size:var(--fs-xs);color:var(--stone);text-align:center;">${escHtml(compDef)}</span>` : ''}`;
        return inOurSet
          ? `<a class="char-card" href="/characters/${encodeURIComponent(ch)}/" style="min-width:90px;">${inner}</a>`
          : `<div class="char-card" style="min-width:90px;cursor:default;">${inner}</div>`;
      }).join('');
      decompHtml = `
  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 8px;">Decomposition</h2>
  <p style="color:var(--stone);line-height:1.7;margin-bottom:12px;">
    <span class="chinese" style="font-weight:600;">${escHtml(c.char)}</span> breaks down into ${decomp.comps.length} component${decomp.comps.length > 1 ? 's' : ''} arranged as <strong>${escHtml(decomp.label)}</strong>. Recognizing the components makes the character easier to remember and write.
  </p>
  <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:center;margin:8px 0;">
    <span class="chinese" style="font-size:48px;font-weight:700;">${escHtml(c.char)}</span>
    <span style="font-size:24px;color:var(--stone);">=</span>
    ${compCards}
  </div>`;
    }

    // Radical info
    let radicalHtml = '';
    if (radical) {
      const sameRadHtml = sameRadicalOthers.length > 0
        ? `<p style="color:var(--stone);line-height:1.7;margin-top:8px;">Other HSK 4 characters that share this radical: ${sameRadicalOthers.map(x =>
            `<a href="/characters/${encodeURIComponent(x.char)}/" class="chinese" style="color:var(--accent);font-weight:600;margin:0 4px;">${escHtml(x.char)}</a>`
          ).join('')}.</p>`
        : '';
      radicalHtml = `
  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 8px;">Radical</h2>
  <p style="color:var(--stone);line-height:1.7;">
    The radical of <span class="chinese" style="font-weight:600;">${escHtml(c.char)}</span> is <strong class="chinese" style="font-size:24px;color:var(--accent);">${escHtml(radical)}</strong>${radDef ? ` — meaning <em>${escHtml(radDef)}</em>` : ''}. Radicals are the indexing components used in Chinese dictionaries; they often hint at a character's broad meaning category.
  </p>${sameRadHtml}`;
    }

    // Etymology
    const etymologyHtml = ety
      ? `
  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 8px;">How the character is built</h2>
  <p style="color:var(--stone);line-height:1.7;">${ety}</p>`
      : '';

    // FAQ block (FAQPage schema). f.a is raw text — escaped at HTML render
    // site below; passed unescaped to JSON-LD where plain text is expected.
    const faqs = [
      {
        q: `What does ${c.char} mean in Chinese?`,
        a: `${c.char} (${pinyinList.join(' / ')}) means ${e.definition || c.meaning}. It is one of the 150 characters required for the HSK 4 writing section.`
      },
      {
        q: `How many strokes does ${c.char} have?`,
        a: strokes ? `${c.char} is written in ${strokes} strokes. Use the practice tool above to see the correct stroke order and trace it yourself.` : `Use the practice tool above to see the stroke order and stroke count for ${c.char}.`
      },
      {
        q: `What is the radical of ${c.char}?`,
        a: radical ? `The radical of ${c.char} is ${radical}${radDef ? ` (${radDef})` : ''}. ${sameRadicalOthers.length > 0 ? `Other HSK 4 characters with the same radical include ${sameRadicalOthers.slice(0, 5).map(x => x.char).join(', ')}.` : ''}` : `See the practice tool above for structural details about ${c.char}.`
      },
      {
        q: `What is the pinyin for ${c.char}?`,
        a: pinyinList.length > 1
          ? `${c.char} has ${pinyinList.length} readings: ${pinyinList.join(', ')}. Which reading applies depends on the word the character appears in.`
          : `${c.char} is pronounced ${pinyinList[0]}.`
      },
      {
        q: `What HSK 4 words use ${c.char}?`,
        a: wordsForChar.length > 0
          ? `In our HSK 4 vocabulary, ${c.char} appears in ${wordsForChar.length} word${wordsForChar.length > 1 ? 's' : ''}, including ${wordsForChar.slice(0, 4).map(w => `${w.word} (${w.pinyin || ''})`).join(', ')}. See the full list above.`
          : `${c.char} is required for HSK 4 handwriting but does not appear as a headword in our HSK 4 vocabulary list.`
      }
    ];
    const faqHtml = `
  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 8px;">FAQ</h2>
  ${faqs.map(f => `<details style="background:white;border:1px solid var(--mist);border-radius:var(--radius-sm);padding:14px 18px;margin-bottom:8px;">
    <summary style="cursor:pointer;font-weight:600;">${escHtml(f.q)}</summary>
    <p style="color:var(--stone);line-height:1.7;margin-top:10px;">${escHtml(f.a)}</p>
  </details>`).join('')}`;
    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a }
      }))
    };

    const detailTitle = `${c.char} (${pinyinList.join('/')}) Stroke Order, Radical & Practice \u2014 HSK 4 \u6C49\u5B57 | Mandarin Zone`;
    const detailDesc = truncDesc(`Learn the HSK 4 character ${c.char} (${pinyinList.join('/')}, ${meanings.slice(0, 2).join(', ') || c.meaning}): ${strokes ? strokes + ' strokes, ' : ''}${radical ? 'radical ' + radical + ', ' : ''}decomposition, common words and animated practice. Free, by Mandarin Zone.`);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(detailTitle)}</title>
<meta name="description" content="${escHtml(detailDesc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/characters/${encodeURIComponent(c.char)}/">
<meta property="og:title" content="${escHtml(detailTitle)}">
<meta property="og:description" content="${escHtml(detailDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/characters/${encodeURIComponent(c.char)}/">
<meta property="og:site_name" content="Mandarin Zone">
<meta property="og:image" content="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png">
<meta property="og:image:alt" content="Mandarin Zone — HSK 4 character writing practice">
<meta name="twitter:card" content="summary">
<meta name="twitter:image" content="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LearningResource",
  "name": "How to write ${escHtml(c.char)}",
  "description": "${escHtml(detailDesc)}",
  "url": "https://hsk4.mandarinzone.com/characters/${encodeURIComponent(c.char)}/",
  "inLanguage": ["en", "zh-CN"],
  "isAccessibleForFree": true,
  "learningResourceType": "Interactive practice",
  "educationalLevel": "Intermediate",
  "about": { "@type": "Thing", "name": "Chinese character ${escHtml(c.char)} (${escHtml(pinyinList.join('/'))})" }
}
</script>
<script type="application/ld+json">
${JSON.stringify(faqJsonLd, null, 2)}
</script>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7/dist/hanzi-writer.min.js" defer></script>
</head>
<body>
${renderNav('characters')}
<main>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/characters/">Characters</a> &rsaquo; <span class="chinese">${escHtml(c.char)}</span>
  </nav>

  <h1 style="font-family:'Noto Serif SC',serif;font-size:clamp(22px,4vw,30px);margin:16px 0 12px;line-height:1.3;">
    How to write <span class="chinese">${escHtml(c.char)}</span> (${pinyinList.map(escHtml).join(' / ')}) — Stroke Order, Radical &amp; Practice
  </h1>

  <section class="char-header" aria-label="Character overview">
    <span class="char-hero-glyph chinese" aria-hidden="true">${escHtml(c.char)}</span>
    <div class="char-meta">
      <span class="char-pinyin-big">${pinyinList.map(escHtml).join(' / ')}</span>
      <span class="char-meaning">${escHtml(e.definition || c.meaning)}</span>
      <span class="char-stats">
        ${strokes ? `<strong>${strokes} strokes</strong> · ` : ''}${radical ? `Radical <span class="chinese" style="color:var(--accent);font-weight:600;">${escHtml(radical)}</span>${radDef ? ` (${escHtml(radDef)})` : ''} · ` : ''}HSK 4 required writing character
      </span>
    </div>
  </section>

  <aside style="background:var(--gold-soft);border-left:4px solid var(--gold);border-radius:var(--radius-sm);padding:14px 18px;margin:16px 0;">
    <strong style="display:block;margin-bottom:4px;color:var(--gold);">Quick Answer</strong>
    <p style="color:var(--ink);line-height:1.7;margin:0;">${quickAnswer}</p>
  </aside>

  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:24px 0 8px;">Pronunciation & meaning</h2>
  ${pinyinHtml}
  ${meaningsHtml}

  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 8px;">Stroke Order & Practice</h2>
  <p style="color:var(--stone);font-size:var(--fs-sm);margin-bottom:8px;">
    Click <strong>Animate</strong> to see the correct stroke order, then <strong>Practice</strong> to trace it yourself.
  </p>
  <div class="writer-stage">
    <div id="writer-target" class="writer-target" role="application" aria-label="Interactive stroke-order practice for ${escHtml(c.char)} — use the buttons below to animate or trace the character"></div>
    <div class="writer-controls">
      <button id="btn-animate" class="btn btn-primary" type="button">▶ Animate</button>
      <button id="btn-quiz" class="btn btn-secondary" type="button">✎ Practice</button>
      <button id="btn-reset" class="btn btn-ghost" type="button">↺ Reset</button>
    </div>
    <div id="writer-status" class="writer-status" aria-live="polite"></div>
  </div>

  ${decompHtml}

  ${radicalHtml}

  ${etymologyHtml}

  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 8px;">HSK 4 Words Containing ${escHtml(c.char)}</h2>
  <div class="char-vocab-list">
    ${wordsHtml}
  </div>

  ${charTaskLinksHtml(c)}

  ${faqHtml}

  <div class="char-pager">
    <a href="/characters/${encodeURIComponent(prev.char)}/" class="btn btn-ghost">&larr; <span class="chinese">${escHtml(prev.char)}</span> ${escHtml(prev.pinyin)}</a>
    <a href="/characters/" class="btn btn-secondary">All Characters</a>
    <a href="/characters/${encodeURIComponent(next.char)}/" class="btn btn-ghost"><span class="chinese">${escHtml(next.char)}</span> ${escHtml(next.pinyin)} &rarr;</a>
  </div>
</main>
${renderFooter()}
<script>
window.addEventListener('load', function(){
  if (typeof HanziWriter === 'undefined') {
    document.getElementById('writer-status').textContent = 'Stroke data could not load — please refresh.';
    return;
  }
  var status = document.getElementById('writer-status');
  var writer = HanziWriter.create('writer-target', ${JSON.stringify(c.char)}, {
    width: 360, height: 360, padding: 8,
    showOutline: true, showCharacter: false,
    strokeAnimationSpeed: 1, delayBetweenStrokes: 180,
    strokeColor: '#1a1a2e', outlineColor: '#c9c4be', highlightColor: '#c23b22'
  });
  function setStatus(msg, cls){
    status.className = 'writer-status' + (cls ? ' ' + cls : '');
    status.textContent = msg || '';
  }
  document.getElementById('btn-animate').addEventListener('click', function(){
    setStatus('Watching stroke order…');
    writer.animateCharacter({ onComplete: function(){ setStatus('Stroke order complete. Try Practice ↓'); } });
  });
  document.getElementById('btn-quiz').addEventListener('click', function(){
    setStatus('Practice mode — trace each stroke.');
    var mistakes = 0;
    writer.quiz({
      showHintAfterMisses: 2,
      onMistake: function(s){
        mistakes++;
        setStatus('Stroke ' + (s.strokeNum + 1) + ' — try again (mistakes: ' + mistakes + ')', 'is-mistake');
      },
      onCorrectStroke: function(s){
        var done = s.strokeNum + 1;
        var total = done + (s.strokesRemaining || 0);
        setStatus('Stroke ' + done + ' / ' + total + ' ✓');
      },
      onComplete: function(s){
        setStatus('Done! ' + s.totalMistakes + ' mistakes total.', 'is-success');
      }
    });
  });
  document.getElementById('btn-reset').addEventListener('click', function(){
    writer.cancelQuiz();
    writer.hideCharacter();
    writer.showOutline();
    setStatus('');
  });
});
</script>
</body>
</html>`;
  }

  // ---- Per-character detail pages (150 writing + 291 recognition) ----
  const pageChars = [...chars, ...renduChars];
  pageChars.forEach((c, pi) => {
    const isRecognition = c.tier === 'recognition';
    const ownList = isRecognition ? renduChars : chars;
    const i = isRecognition ? pi - chars.length : pi;
    const prev = ownList[(i - 1 + ownList.length) % ownList.length];
    const next = ownList[(i + 1) % ownList.length];
    const wordsForChar = (charToWords[c.char] || []).slice(0, 8);

    const wordsHtml = wordsForChar.length === 0
      ? `<p style="color:var(--stone);font-size:var(--fs-sm);">No HSK 4 words containing this character are listed in our vocabulary.</p>`
      : wordsForChar.map(w => {
          const highlighted = escHtml(w.word).split('').map(ch =>
            ch === c.char ? `<span class="hl">${ch}</span>` : ch
          ).join('');
          return `<div class="char-vocab-item">
        <div class="vw-row">
          <span class="vw-word chinese">${highlighted}</span>
          <span class="vw-pinyin">${escHtml(w.pinyin || '')}</span>
          <span class="vw-meaning">${escHtml(w.meaning || '')}</span>
        </div>
        ${w.example_cn ? `<div class="vw-example">
          <div class="ex-cn chinese">${escHtml(w.example_cn)}</div>
          <div>${escHtml(w.example_pinyin || '')}</div>
          <div>${escHtml(w.example_en || '')}</div>
        </div>` : ''}
      </div>`;
        }).join('\n');

    // Route top-30 high-density chars to enhanced template (writing tier only)
    if (!isRecognition && top30Set.has(c.char)) {
      const enhancedHtml = renderEnhancedDetail(c, i, prev, next, wordsHtml, wordsForChar);
      const charDir = path.join(charsDir, c.char);
      ensureDir(charDir);
      fs.writeFileSync(path.join(charDir, 'index.html'), enhancedHtml, 'utf8');
      return;
    }

    const detailTitle = isRecognition
      ? `${c.char} (${c.pinyin}) Meaning, Pinyin & Stroke Order \u2014 HSK 4 \u8BA4\u8BFB\u5B57 | Mandarin Zone`
      : `${c.char} (${c.pinyin}) Stroke Order & Writing Practice \u2014 HSK 4 \u6C49\u5B57 | Mandarin Zone`;
    const detailDesc = truncDesc(isRecognition
      ? `${c.char} (${c.pinyin}) means "${c.meaning}" — an HSK 4 recognition character (认读字). See its meaning, pinyin, stroke order animation, and the HSK 4 words that use it. By Mandarin Zone.`
      : `Learn how to write the HSK 4 character ${c.char} (${c.pinyin}, ${c.meaning}) with animated stroke order and interactive handwriting practice. Free practice tool by Mandarin Zone.`);

    const detailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(detailTitle)}</title>
<meta name="description" content="${escHtml(detailDesc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/characters/${encodeURIComponent(c.char)}/">
<meta property="og:title" content="${escHtml(detailTitle)}">
<meta property="og:description" content="${escHtml(detailDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/characters/${encodeURIComponent(c.char)}/">
<meta property="og:site_name" content="Mandarin Zone">
<meta property="og:image" content="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png">
<meta property="og:image:alt" content="Mandarin Zone — HSK 4 character writing practice">
<meta name="twitter:card" content="summary">
<meta name="twitter:image" content="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LearningResource",
  "name": "How to write ${escHtml(c.char)}",
  "description": "${escHtml(detailDesc)}",
  "url": "https://hsk4.mandarinzone.com/characters/${encodeURIComponent(c.char)}/",
  "inLanguage": ["en", "zh-CN"],
  "isAccessibleForFree": true,
  "learningResourceType": "Interactive practice",
  "educationalLevel": "Intermediate",
  "about": { "@type": "Thing", "name": "Chinese character ${escHtml(c.char)} (${escHtml(c.pinyin)})" }
}
</script>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7/dist/hanzi-writer.min.js" defer></script>
</head>
<body>
${renderNav('characters')}
<main>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/characters/">Characters</a> &rsaquo; <span class="chinese">${escHtml(c.char)}</span>
  </nav>

  <h1 style="font-family:'Noto Serif SC',serif;font-size:clamp(22px,4vw,30px);margin:16px 0 12px;line-height:1.3;">
    ${isRecognition
      ? `<span class="chinese">${escHtml(c.char)}</span> (${escHtml(c.pinyin)}) — HSK 4 Recognition Character: Meaning &amp; Stroke Order`
      : `How to write <span class="chinese">${escHtml(c.char)}</span> (${escHtml(c.pinyin)}) — HSK 4 Stroke Order &amp; Practice`}
  </h1>

  <section class="char-header" aria-label="Character overview">
    <span class="char-hero-glyph chinese" aria-hidden="true">${escHtml(c.char)}</span>
    <div class="char-meta">
      <span class="char-pinyin-big">${escHtml(c.pinyin)}</span>
      <span class="char-meaning">${escHtml(c.meaning)}</span>
      <span class="char-stats">${isRecognition
        ? `HSK 4 recognition character (认读字) · ${i + 1} of ${renduChars.length}`
        : `HSK 4 required writing character · ${i + 1} of ${chars.length}`}</span>
    </div>
  </section>

  ${isRecognition ? `<div style="background:var(--jade-soft);border-radius:8px;padding:12px 16px;margin:12px 0;font-size:14px;line-height:1.6;">
    \u{1F441} <strong>Recognition only:</strong> the official HSK 4 syllabus asks you to <em>recognize</em> ${escHtml(c.char)} when reading — handwriting it is not required (that applies to the <a href="/characters/" style="color:var(--jade);font-weight:600;">150 writing characters</a>). The stroke animation below is optional but helps memory.
  </div>` : ''}

  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:24px 0 8px;">Stroke Order & Practice</h2>
  <p style="color:var(--stone);font-size:var(--fs-sm);margin-bottom:8px;">
    Click <strong>Animate</strong> to see the correct stroke order, then <strong>Practice</strong> to trace it yourself.
  </p>
  <div class="writer-stage">
    <div id="writer-target" class="writer-target" role="application" aria-label="Interactive stroke-order practice for ${escHtml(c.char)} — use the buttons below to animate or trace the character"></div>
    <div class="writer-controls">
      <button id="btn-animate" class="btn btn-primary" type="button">▶ Animate</button>
      <button id="btn-quiz" class="btn btn-secondary" type="button">✎ Practice</button>
      <button id="btn-reset" class="btn btn-ghost" type="button">↺ Reset</button>
    </div>
    <div id="writer-status" class="writer-status" aria-live="polite"></div>
  </div>

  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 8px;">HSK 4 Words Containing ${escHtml(c.char)}</h2>
  <div class="char-vocab-list">
    ${wordsHtml}
  </div>

  ${charTaskLinksHtml(c)}

  <div class="char-pager">
    <a href="/characters/${encodeURIComponent(prev.char)}/" class="btn btn-ghost">&larr; <span class="chinese">${escHtml(prev.char)}</span> ${escHtml(prev.pinyin)}</a>
    <a href="/characters/" class="btn btn-secondary">All Characters</a>
    <a href="/characters/${encodeURIComponent(next.char)}/" class="btn btn-ghost"><span class="chinese">${escHtml(next.char)}</span> ${escHtml(next.pinyin)} &rarr;</a>
  </div>

  <section style="margin-top:40px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin-bottom:12px;">About the character ${escHtml(c.char)}</h2>
    <p style="color:var(--stone);line-height:1.8;">
      <span class="chinese" style="font-weight:600;">${escHtml(c.char)}</span> (<span style="color:var(--accent);">${escHtml(c.pinyin)}</span>) means <em>${escHtml(c.meaning)}</em>. It is one of the ${chars.length} characters HSK 4 expects you to write from memory. Practice the stroke order until it feels automatic — most learners need 5–10 successful traces before a character "sticks".
    </p>
  </section>
</main>
${renderFooter()}
<script>
window.addEventListener('load', function(){
  if (typeof HanziWriter === 'undefined') {
    document.getElementById('writer-status').textContent = 'Stroke data could not load — please refresh.';
    return;
  }
  var status = document.getElementById('writer-status');
  var writer = HanziWriter.create('writer-target', ${JSON.stringify(c.char)}, {
    width: 360, height: 360, padding: 8,
    showOutline: true, showCharacter: false,
    strokeAnimationSpeed: 1, delayBetweenStrokes: 180,
    strokeColor: '#1a1a2e', outlineColor: '#c9c4be', highlightColor: '#c23b22'
  });
  function setStatus(msg, cls){
    status.className = 'writer-status' + (cls ? ' ' + cls : '');
    status.textContent = msg || '';
  }
  document.getElementById('btn-animate').addEventListener('click', function(){
    setStatus('Watching stroke order…');
    writer.animateCharacter({ onComplete: function(){ setStatus('Stroke order complete. Try Practice ↓'); } });
  });
  document.getElementById('btn-quiz').addEventListener('click', function(){
    setStatus('Practice mode — trace each stroke.');
    var mistakes = 0;
    writer.quiz({
      showHintAfterMisses: 2,
      onMistake: function(s){
        mistakes++;
        setStatus('Stroke ' + (s.strokeNum + 1) + ' — try again (mistakes: ' + mistakes + ')', 'is-mistake');
      },
      onCorrectStroke: function(s){
        var done = s.strokeNum + 1;
        var total = done + (s.strokesRemaining || 0);
        setStatus('Stroke ' + done + ' / ' + total + ' ✓');
      },
      onComplete: function(s){
        setStatus('Done! ' + s.totalMistakes + ' mistakes total.', 'is-success');
      }
    });
  });
  document.getElementById('btn-reset').addEventListener('click', function(){
    writer.cancelQuiz();
    writer.hideCharacter();
    writer.showOutline();
    setStatus('');
  });
});
</script>
</body>
</html>`;

    const charDir = path.join(charsDir, c.char);
    ensureDir(charDir);
    fs.writeFileSync(path.join(charDir, 'index.html'), detailHtml, 'utf8');
  });

  const enhancedCount = top30Set.size;
  const simpleCount = chars.length - enhancedCount;
  console.log(`[characters] Generated hub + ${enhancedCount} enhanced (top-30) + ${simpleCount} basic + ${renduChars.length} recognition per-character pages`);
  return {
    all: chars.map(c => c.char),
    enhanced: Array.from(top30Set),
    recognition: renduChars.map(c => c.char),
  };
}

// ============================================================
// RUN ALL
// ============================================================

console.log('=== HSK4 SEO Build ===\n');
// ============================================================
// 14. SENTENCES & TRAPS DRILL-DOWN PAGES
// ============================================================
// Hub pages stay the canonical "all in one place" view; these category
// pages add depth per cluster (recall practice, per-category quiz,
// cross-links) and give each category its own indexable URL.

const DRILL_HEADER = (active) => `<header>
  <div class="header-inner">
    <a href="/" class="logo">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="logo-mark" loading="eager">
      <div class="logo-text">HSK 4 <span>Mock Exam</span></div>
    </a>
    <nav class="site-nav" aria-label="Primary">
      <a href="/" class="nav-link">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link${active==='vocabulary'?' is-active':''}">Vocabulary</a>
      <a href="/characters/" class="nav-link">Characters</a>
      <a href="/grammar/" class="nav-link">Grammar</a>
      <a href="/sentences/" class="nav-link${active==='sentences'?' is-active':''}">Sentences</a>
      <a href="/strategies/" class="nav-link">Strategies</a>
      <a href="/traps/" class="nav-link${active==='traps'?' is-active':''}">Traps</a>
      <a href="/topics/" class="nav-link">Topics</a>
      <a href="/words/" class="nav-link">Words</a>
      <a href="/compare/" class="nav-link">Compare</a>
      <a href="/guide/" class="nav-link">Guide</a>
    </nav>
  </div>
</header>`;

const DRILL_FOOTER = `<footer>
  <div class="footer-brand">
    <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener" class="footer-brand-link">
      <img src="https://www.mandarinzone.com/wp-content/uploads/2015/01/logo.png" alt="Mandarin Zone" class="footer-logo" loading="lazy">
      <div>
        <div class="footer-brand-name">Mandarin Zone</div>
        <div class="footer-tagline">Learn Chinese in Beijing &amp; Online · Since 2008</div>
      </div>
    </a>
    <div class="footer-cta">
      <a href="https://www.mandarinzone.com/" target="_blank" rel="noopener">Study Chinese with our teachers →</a>
    </div>
  </div>
  <p class="footer-links" style="margin-top:4px;"><a href="/">Mock Exams</a> · <a href="/vocabulary/">Vocabulary</a> · <a href="/grammar/">Grammar</a> · <a href="/sentences/">Sentences</a> · <a href="/strategies/">Strategies</a> · <a href="/words/">Confusable Words</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
</footer>`;

const MOCK_CTA = `
  <section style="margin-top:40px;background:var(--accent-soft);border-radius:var(--radius);padding:24px 28px;text-align:center;">
    <h3 class="chinese" style="font-family:'Noto Serif SC',serif;font-size:20px;margin-bottom:8px;">用模拟考试检验掌握情况</h3>
    <p style="color:var(--stone);font-size:14px;margin-bottom:16px;">Apply what you just reviewed under real test conditions — 12 free HSK 4 mock exams, instant scoring.</p>
    <a href="/" class="btn btn-primary">Start a mock exam →</a>
  </section>`;

// --- Connector lexicon: detect which grammar patterns appear in a sentence
// set, and link each to its deep-dive page. Data-driven so the chips stay
// accurate if sentences change.
const SENTENCE_PATTERN_LINKS = [
  { label: '因为…所以 (because…so)', re: /因为|所以/, href: '/grammar/complex-sentences/' },
  { label: '由于 / 因此 (due to / therefore)', re: /由于|因此/, href: '/words/yinwei-youyu/' },
  { label: '于是 (thereupon)', re: /于是/, href: '/words/yushi-yinci/' },
  { label: '虽然…但是 (although)', re: /虽然|但是/, href: '/grammar/complex-sentences/' },
  { label: '尽管 (even though)', re: /尽管/, href: '/grammar/patterns/jinguan-danshi/' },
  { label: '即使…也 (even if)', re: /即使/, href: '/grammar/patterns/jishi-ye/' },
  { label: '不过 / 然而 (however)', re: /不过|然而/, href: '/grammar/function-words/' },
  { label: '却 (yet)', re: /却/, href: '/grammar/adverbs/' },
  { label: '越来越 (more and more)', re: /越来越|越…越/, href: '/grammar/complement/' },
  { label: '比 comparison', re: /比/, href: '/grammar/comparison/' },
  { label: '不如 (not as good as)', re: /不如/, href: '/grammar/comparison/' },
  { label: '跟…相比 (compared with)', re: /相比/, href: '/grammar/comparison/' },
  { label: '已经 / 曾经 (already / once)', re: /已经|曾经/, href: '/words/yijing-cengjing/' },
  { label: '才 / 就 (timing)', re: /[才就]/, href: '/words/cai-jiu/' },
  { label: '不仅…而且 (not only…but also)', re: /不仅|而且/, href: '/grammar/complex-sentences/' },
  { label: '只要 / 只有 (conditions)', re: /只要|只有/, href: '/grammar/patterns/zhiyou-cai/' },
  { label: '无论 / 不管 (no matter)', re: /无论|不管/, href: '/grammar/patterns/buguan-dou/' },
  { label: '要是 (if)', re: /要是|如果/, href: '/grammar/patterns/yaoshi-fouze/' },
  { label: '首先…其次 (first…second)', re: /首先|其次/, href: '/grammar/complex-sentences/' },
  { label: '总之 (in summary)', re: /总之|总的来说/, href: '/strategies/writing-construction/' },
  { label: '随着 (along with)', re: /随着/, href: '/grammar/function-words/' },
];

// Per-category related links (cross-cluster, max 3) + writing tie-in.
const SENTENCE_CAT_RELATED = {
  'express-opinion':     [['/words/tingshuo-juede-renwei/', '听说 vs 觉得 vs 认为 — opinion verbs'], ['/strategies/writing-construction/', 'Writing Q86-95 strategy']],
  'make-suggestions':    [['/grammar/fixed-patterns/', '固定格式 — fixed patterns'], ['/topics/social-expressions/', '日常言语交往 task words']],
  'cause-effect':        [['/grammar/complex-sentences/', '复句 — complex sentences'], ['/words/yinwei-youyu/', '因为 vs 由于'], ['/words/yushi-yinci/', '于是 vs 因此']],
  'contrast-concession': [['/grammar/patterns/jinguan-danshi/', '尽管…但是 pattern'], ['/words/jishi-jinguan/', '即使 vs 尽管'], ['/traps/connectors/', 'Connector traps']],
  'describe-change':     [['/grammar/complement/', '补语 — complements'], ['/topics/social-phenomena/', '社会现象 task words']],
  'comparison':          [['/grammar/comparison/', '比较句 — comparison grammar'], ['/words/bijiao-bi/', '比较 vs 比'], ['/traps/comparison/', 'Comparison traps']],
  'describe-people':     [['/topics/describe-a-person/', '谈论某个人物 — task words'], ['/grammar/pivotal-sentences/', '兼语句 (praise/criticism)']],
  'time-expressions':    [['/words/cai-jiu/', '才 vs 就'], ['/words/yihou-zhihou/', '以后 vs 之后'], ['/traps/time-adverbs/', 'Time adverb traps']],
  'express-feelings':    [['/topics/emotions/', '谈论情感话题 — task words'], ['/grammar/complement/', '死了/坏了 degree complements']],
  'summary-conclusion':  [['/strategies/writing-construction/', 'Writing strategy'], ['/writing/paragraph/', 'Paragraph writing practice']],
};

function buildSentenceCategoryPages() {
  console.log('[sentence-cats] Generating sentence category drill-down pages...');
  const cats = readJSON('sentences.json');

  cats.forEach((cat, ci) => {
    const prev = cats[(ci + cats.length - 1) % cats.length];
    const next = cats[(ci + 1) % cats.length];
    const allText = cat.sentences.map(s => s.cn).join(' ');
    const seen = new Set();
    const patternChips = SENTENCE_PATTERN_LINKS
      .filter(p => p.re.test(allText) && !seen.has(p.href + p.label) && seen.add(p.href + p.label))
      .slice(0, 6)
      .map(p => `<a href="${p.href}" style="display:inline-block;background:white;border:1px solid var(--mist);border-radius:6px;padding:6px 12px;font-size:13px;text-decoration:none;color:var(--ink);margin:0 6px 6px 0;">${p.label} →</a>`)
      .join('');

    const sentencesHtml = cat.sentences.map((s, i) => `
    <div class="sentence-row" id="s${i + 1}">
      <div class="sent-num">${i + 1}</div>
      <div class="sent-content">
        <div class="sent-cn chinese">${escHtml(s.cn)}</div>
        <div class="sent-py">${escHtml(s.py)}</div>
        <div class="sent-en">${escHtml(s.en)}</div>
        ${s.use ? `<div class="sent-use">\u{1F4CB} ${escHtml(s.use)}</div>` : ''}
      </div>
    </div>`).join('');

    const recallCards = cat.sentences.map((s, i) => `
      <div class="recall-card" data-i="${i}">
        <div class="recall-en">${escHtml(s.en)}</div>
        <div class="recall-cn chinese" style="display:none;">${escHtml(s.cn)}<div class="recall-py">${escHtml(s.py)}</div></div>
        <button class="btn btn-ghost recall-btn" onclick="recallToggle(this)">Show 中文</button>
      </div>`).join('');

    const related = (SENTENCE_CAT_RELATED[cat.slug] || []).map(([href, label]) =>
      `<a href="${href}" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;"><div style="font-size:14px;font-weight:600;">${label}</div></a>`
    ).join('');

    const title = `${cat.name_en} in Chinese — 10 HSK 4 ${cat.name_cn} Sentences`;
    const desc = truncDesc(`10 ready-to-use HSK 4 sentences for ${cat.name_en.toLowerCase()} (${cat.name_cn}) with pinyin, English, usage notes, and active-recall practice. ${cat.desc}`, 158);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(title)} | Mandarin Zone</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/sentences/${cat.slug}/">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/sentences/${cat.slug}/">
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'Article',
  headline: title,
  description: desc,
  inLanguage: ['en', 'zh-CN'], isAccessibleForFree: true,
  url: `https://hsk4.mandarinzone.com/sentences/${cat.slug}/`,
}, null, 1)}
</script>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<style>
  .sentence-row { display:flex; gap:14px; background:white; border:1px solid var(--mist); border-radius:var(--radius-sm); padding:16px 18px; margin-bottom:10px; }
  .sent-num { flex:0 0 28px; height:28px; border-radius:50%; background:var(--accent-soft); color:var(--accent); font-weight:700; font-size:13px; display:flex; align-items:center; justify-content:center; }
  .sent-cn { font-size:17px; font-weight:600; line-height:1.7; }
  .sent-py { color:var(--accent); font-size:13px; margin-top:2px; }
  .sent-en { color:var(--stone); font-size:14px; margin-top:4px; line-height:1.6; }
  .sent-use { color:var(--stone); font-size:12px; margin-top:6px; background:var(--paper); display:inline-block; padding:3px 8px; border-radius:4px; }
  .recall-card { background:white; border:1px solid var(--mist); border-radius:var(--radius-sm); padding:16px 18px; margin-bottom:10px; }
  .recall-en { font-size:15px; line-height:1.6; margin-bottom:10px; }
  .recall-cn { font-size:17px; font-weight:600; line-height:1.7; margin-bottom:10px; color:var(--ink); }
  .recall-py { font-size:13px; color:var(--accent); font-weight:400; margin-top:2px; }
  .cat-nav { display:flex; justify-content:space-between; margin:40px 0 0; flex-wrap:wrap; gap:12px; }
  .breadcrumb { font-size:13px; color:var(--stone); margin:16px 0 8px; }
  .breadcrumb a { color:var(--accent); text-decoration:none; }
</style>
</head>
<body>
${DRILL_HEADER('sentences')}
<main>
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/sentences/">Sentences</a> &rsaquo; ${escHtml(cat.name_en)}</nav>

  <section style="margin:8px 0 24px;">
    <h1 class="chinese" style="font-family:'Noto Serif SC',serif;font-size:clamp(24px,4vw,32px);margin-bottom:8px;">${cat.icon} ${escHtml(cat.name_en)} — <span style="color:var(--accent);">${escHtml(cat.name_cn)}</span></h1>
    <p style="color:var(--stone);line-height:1.7;max-width:680px;">${escHtml(cat.desc)} These 10 sentences are battle-tested HSK 4 building blocks — memorize them as whole chunks, then swap in your own vocabulary. Part of the <a href="/sentences/" style="color:var(--accent);">100 essential HSK 4 sentences</a> collection.</p>
  </section>

  ${patternChips ? `<section style="margin-bottom:24px;">
    <h2 style="font-size:15px;color:var(--stone);margin-bottom:10px;">Grammar patterns used in this set / 本组句子用到的语法</h2>
    ${patternChips}
  </section>` : ''}

  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:24px 0 14px;">The 10 sentences / 句子清单</h2>
  ${sentencesHtml}

  <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:36px 0 8px;">Active Recall Practice / 回忆练习</h2>
  <p style="color:var(--stone);font-size:14px;margin-bottom:14px;">Read the English, say the Chinese out loud, then reveal to check yourself. Recall practice is 3× more effective than re-reading.</p>
  <div style="margin-bottom:12px;"><button class="btn btn-secondary" onclick="recallAll(true)">Reveal all</button> <button class="btn btn-ghost" onclick="recallAll(false)">Hide all</button></div>
  ${recallCards}

  ${related ? `<section style="margin-top:36px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin-bottom:12px;">Related / 相关内容</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px;">${related}</div>
  </section>` : ''}

  <div class="cat-nav">
    <a href="/sentences/${prev.slug}/" class="btn btn-ghost">← ${escHtml(prev.name_en)}</a>
    <a href="/sentences/" class="btn btn-secondary">All 100 Sentences</a>
    <a href="/sentences/${next.slug}/" class="btn btn-ghost">${escHtml(next.name_en)} →</a>
  </div>
${MOCK_CTA}
</main>
${DRILL_FOOTER}
<script>
function recallToggle(btn) {
  var card = btn.closest('.recall-card');
  var cn = card.querySelector('.recall-cn');
  var show = cn.style.display === 'none';
  cn.style.display = show ? 'block' : 'none';
  btn.textContent = show ? 'Hide 中文' : 'Show 中文';
}
function recallAll(show) {
  document.querySelectorAll('.recall-card').forEach(function(card) {
    card.querySelector('.recall-cn').style.display = show ? 'block' : 'none';
    card.querySelector('.recall-btn').textContent = show ? 'Hide 中文' : 'Show 中文';
  });
}
</script>
</body>
</html>`;

    const dir = path.join(ROOT, 'sentences', cat.slug);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  });

  // Inject the category nav into the hub (idempotent markers).
  const hubPath = path.join(ROOT, 'sentences', 'index.html');
  let hub = fs.readFileSync(hubPath, 'utf8');
  hub = hub.replace(/\s*<!-- SENTENCE CATEGORY NAV -->[\s\S]*?<!-- \/SENTENCE CATEGORY NAV -->/g, '');
  const navCards = cats.map(c => `
      <a href="/sentences/${c.slug}/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
        <div style="font-size:14px;font-weight:600;">${c.icon} ${escHtml(c.name_en)} <span class="chinese" style="color:var(--stone);font-weight:400;">${escHtml(c.name_cn)}</span></div>
        <div style="font-size:12px;color:var(--accent);margin-top:4px;">10 sentences + recall practice →</div>
      </a>`).join('');
  const navBlock = `\n  <!-- SENTENCE CATEGORY NAV -->
  <section style="margin:24px 0 32px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin-bottom:12px;">Deep-dive by category / 分类精学</h2>
    <p style="color:var(--stone);font-size:14px;margin-bottom:14px;">Each category has its own page with grammar-pattern links and active-recall practice.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:12px;">${navCards}
    </div>
  </section>
  <!-- /SENTENCE CATEGORY NAV -->\n`;
  hub = hub.replace(/(<h2><span class="cat-icon">)/, navBlock + '$1');
  fs.writeFileSync(hubPath, hub, 'utf8');

  console.log(`[sentence-cats] Generated ${cats.length} category pages + hub nav`);
  return cats.map(c => ({ loc: `/sentences/${c.slug}/`, priority: '0.7' }));
}

// Per-category intros for trap drill-down pages.
const TRAP_CAT_META = {
  'adverb-polarity': {
    seo_title: 'HSK 4 Adverb Traps: 差点儿(没) Polarity & 千万 Rules',
    seo_desc: '差点儿 vs 差点儿没 polarity and why 千万 needs 要/别 — the two adverb traps HSK 4 listening and 排词成句 test most, with examples and a quiz.',
    grammar: ['/grammar/adverbs/'],
    intro: 'Mood adverbs are tiny words with outsized exam weight. These two traps — 差点儿 polarity and 千万’s mandatory imperative partner — appear in listening comprehension and 排词成句 every single session.',
    related: [['/words/cai-jiu/', '才 vs 就'], ['/sentences/time-expressions/', 'Time expression sentences']],
  },
  'passive': {
    seo_title: 'HSK 4 Passive Traps: 被/让/叫 Mistakes to Avoid',
    seo_desc: '让/叫 passives need an explicit agent and a result complement — three 被/让/叫 traps with wrong-vs-right examples and a focused quiz.',
    grammar: ['/grammar/passive/'],
    intro: '被/让/叫 passives look interchangeable but follow different rules about subjects, agents, and complements. HSK 4 tests exactly the differences.',
    related: [['/words/shi-rang-jiao-bei/', '使 vs 让 vs 叫 vs 被'], ['/grammar/pivotal-sentences/', '兼语句 — pivotal sentences']],
  },
  'ba-sentence': {
    seo_title: 'HSK 4 把字句 Traps: When 把 Is Mandatory',
    seo_desc: '把 is mandatory with verb+在+place, imperatives still need a subject, and double-object verbs change order — three 把字句 traps with quiz.',
    grammar: ['/grammar/ba-sentence/'],
    intro: 'The 把 construction is mandatory in specific structures — not optional stylistic flair. These three traps cover the cases 排词成句 (Q86-95) tests most.',
    related: [['/grammar/patterns/', '8 sentence patterns'], ['/strategies/writing-construction/', 'Writing Q86-95 strategy']],
  },
  'comparison': {
    seo_title: 'HSK 4 比 Sentence Traps: 很/非常 Ban & 不如 Rules',
    seo_desc: 'Never put 很/非常/真 before the adjective in a 比 sentence, and never combine 不如 with 比 — two comparison traps with examples and quiz.',
    grammar: ['/grammar/comparison/'],
    intro: '比 sentences have one iron rule (no 很/非常/真 before the adjective) and one common illegal hybrid (不如 + 比). Both are free points if you know them.',
    related: [['/words/bijiao-bi/', '比较 vs 比'], ['/sentences/comparison/', 'Comparison sentences']],
  },
  'connectors': {
    seo_title: 'HSK 4 Connector Traps: 即使 vs 尽管, 不管 vs 无论',
    seo_desc: '即使 (hypothetical) vs 尽管 (factual), 不管 (spoken) vs 无论 (written) — the connector distinctions HSK 4 reading tests most, with quiz.',
    grammar: ['/grammar/complex-sentences/'],
    intro: 'Connector pairs like 即使/尽管 and 不管/无论 differ by hypothetical-vs-factual and register — distinctions reading Part 1 (选词填空) loves.',
    related: [['/words/jishi-jinguan/', '即使 vs 尽管'], ['/words/buguan-wulun/', '不管 vs 无论'], ['/sentences/contrast-concession/', 'Contrast sentences']],
  },
  'rhetorical': {
    seo_title: 'HSK 4 反问句 Traps: Rhetorical Questions in Listening',
    seo_desc: 'A rhetorical question means the opposite of its literal form — flip the polarity to find what the speaker really means. Examples + quiz.',
    grammar: ['/grammar/rhetorical/'],
    intro: 'A rhetorical question states the opposite of its literal form. Listening loves asking what the speaker actually means — flip the polarity and you have the answer.',
    related: [['/grammar/adverbs/', '难道 and mood adverbs'], ['/strategies/listening-dialog/', 'Listening dialog strategy']],
  },
  'time-adverbs': {
    seo_title: 'HSK 4 Time Adverb Traps: 才 vs 就, 已经 vs 曾经',
    seo_desc: '才 = later than expected, 就 = earlier; 已经 = still true now, 曾经 = past experience. Two top-10 HSK 4 confusable pairs with quiz.',
    grammar: ['/grammar/adverbs/'],
    intro: '才 vs 就 and 已经 vs 曾经 encode whether something happened earlier or later than expected, and whether it still matters now. Both pairs are top-10 HSK 4 confusables.',
    related: [['/words/cai-jiu/', '才 vs 就'], ['/words/yijing-cengjing/', '已经 vs 曾经'], ['/sentences/time-expressions/', 'Time expression sentences']],
  },
};

function buildTrapCategoryPages() {
  console.log('[trap-cats] Generating trap category drill-down pages...');
  const cats = readJSON('traps.json');

  cats.forEach((cat, ci) => {
    const prev = cats[(ci + cats.length - 1) % cats.length];
    const next = cats[(ci + 1) % cats.length];
    const meta = TRAP_CAT_META[cat.slug] || { grammar: [], intro: '', related: [] };

    const cardsHtml = cat.traps.map(t => t.html).join('\n\n');
    const quizHtml = cat.traps.map(t => t.quiz_html).filter(Boolean).join('\n\n');
    const relatedHtml = (meta.related || []).map(([href, label]) =>
      `<a href="${href}" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;"><div style="font-size:14px;font-weight:600;">${label}</div></a>`
    ).join('');

    const title = meta.seo_title || `HSK 4 ${cat.name_en} \u2014 ${cat.traps.length} Traps + Quiz`;
    const desc = truncDesc(meta.seo_desc || `${cat.name_cn}\uFF1A${meta.intro}`, 158);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escHtml(title)} | Mandarin Zone</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/traps/${cat.slug}/">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/traps/${cat.slug}/">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Noto+Serif+SC:wght@400;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/common.css">
<style>
  .trap-card { background:white; border:1px solid var(--mist); border-left:4px solid var(--accent); border-radius:var(--radius); padding:22px 26px; margin-bottom:18px; }
  .trap-card h3 { font-family:'Noto Serif SC',serif; font-size:20px; font-weight:700; margin-bottom:6px; color:var(--ink); }
  .trap-tag { display:inline-block; background:var(--accent-soft); color:var(--accent); font-size:11px; font-weight:700; padding:2px 8px; border-radius:4px; text-transform:uppercase; letter-spacing:0.5px; margin-right:6px; vertical-align:middle; }
  .trap-tag.high { background:#ffe0e0; color:#c53030; }
  .trap-summary { color:var(--stone); font-size:14px; line-height:1.7; margin-bottom:12px; }
  .ex-wrong { background:#fff5f5; border-left:3px solid #c53030; padding:10px 14px; border-radius:6px; margin-bottom:8px; font-size:14px; line-height:1.7; }
  .ex-wrong strong { color:#c53030; }
  .ex-right { background:#e8f5e9; border-left:3px solid var(--correct,#38a169); padding:10px 14px; border-radius:6px; margin-bottom:8px; font-size:14px; line-height:1.7; }
  .ex-right strong { color:var(--correct,#38a169); }
  .trap-rule { background:var(--gold-soft); padding:10px 14px; border-radius:6px; font-size:13px; line-height:1.6; margin-top:10px; }
  .trap-link { display:inline-block; margin-top:12px; font-size:13px; color:var(--accent); font-weight:600; text-decoration:none; }
  .trap-link:hover { text-decoration:underline; }
  .trap-quiz-item { background:white; border:1px solid var(--mist); border-radius:var(--radius); padding:18px 22px; margin-bottom:14px; }
  .tq-num { font-size:11px; color:var(--accent); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
  .tq-num a { color:var(--accent); }
  .tq-stem { font-size:15px; line-height:1.7; margin-bottom:12px; color:var(--ink); font-family:'Noto Sans SC',sans-serif; }
  .tq-stem strong { font-weight:600; }
  .tq-opts { display:flex; flex-direction:column; gap:8px; }
  .tq-opt { padding:10px 14px; border:1px solid var(--mist); border-radius:6px; background:white; font-family:'Noto Sans SC',sans-serif; font-size:14px; line-height:1.6; cursor:pointer; transition:all 0.15s; text-align:left; color:var(--ink); }
  .tq-opt:hover:not(.disabled) { border-color:var(--accent); background:var(--accent-soft); }
  .tq-opt.correct { background:#e8f5e9; border-color:#38a169; color:#2f855a; font-weight:600; }
  .tq-opt.wrong { background:#fff5f5; border-color:#c53030; color:#c53030; }
  .tq-opt.disabled { pointer-events:none; opacity:0.6; }
  .tq-opt.disabled.correct { opacity:1; }
  .tq-explain { display:none; margin-top:10px; font-size:13px; color:var(--stone); line-height:1.7; padding:10px 14px; background:var(--paper); border-radius:6px; border-left:3px solid var(--accent); }
  .cat-nav { display:flex; justify-content:space-between; margin:40px 0 0; flex-wrap:wrap; gap:12px; }
  .breadcrumb { font-size:13px; color:var(--stone); margin:16px 0 8px; }
  .breadcrumb a { color:var(--accent); text-decoration:none; }
</style>
</head>
<body>
${DRILL_HEADER('traps')}
<main>
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/traps/">Traps</a> &rsaquo; ${escHtml(cat.name_en)}</nav>

  <section style="margin:8px 0 24px;">
    <h1 class="chinese" style="font-family:'Noto Serif SC',serif;font-size:clamp(24px,4vw,32px);margin-bottom:8px;">HSK 4 ${escHtml(cat.name_en)} <span style="color:var(--accent);">/ ${escHtml(cat.name_cn)}</span></h1>
    <p style="color:var(--stone);line-height:1.7;max-width:680px;">${meta.intro} Part of the <a href="/traps/" style="color:var(--accent);">15 high-frequency HSK 4 traps</a> collection.</p>
  </section>

  ${cardsHtml}

  ${quizHtml ? `<h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:36px 0 8px;">Test yourself / 自测</h2>
  <p style="color:var(--stone);font-size:14px;margin-bottom:14px;">One question per trap. Click an option to check your answer. Want all 15 in one sitting? Take the <a href="/traps/#quiz" style="color:var(--accent);">full trap quiz on the hub page</a>.</p>
  ${quizHtml}` : ''}

  ${meta.grammar.length ? `<div style="margin-top:24px;padding:14px 18px;background:var(--jade-soft);border-radius:8px;font-size:14px;">
    \u{1F527} Full grammar treatment: ${meta.grammar.map(g => `<a href="${g}" style="color:var(--jade);font-weight:600;">${g}</a>`).join(' · ')}
  </div>` : ''}

  ${relatedHtml ? `<section style="margin-top:32px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin-bottom:12px;">Related / 相关内容</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(220px, 1fr));gap:12px;">${relatedHtml}</div>
  </section>` : ''}

  <div class="cat-nav">
    <a href="/traps/${prev.slug}/" class="btn btn-ghost">← ${escHtml(prev.name_en)}</a>
    <a href="/traps/" class="btn btn-secondary">All 15 Traps</a>
    <a href="/traps/${next.slug}/" class="btn btn-ghost">${escHtml(next.name_en)} →</a>
  </div>
${MOCK_CTA}
</main>
${DRILL_FOOTER}
<script>
window.trapAnswer = function(btn, isCorrect, qNum) {
  var item = btn.closest('.trap-quiz-item');
  if (item.dataset.done) return;
  item.dataset.done = '1';
  item.querySelectorAll('.tq-opt').forEach(function(o) {
    o.classList.add('disabled');
    if (o.dataset.correct === '1') o.classList.add('correct');
  });
  if (!isCorrect) btn.classList.add('wrong');
  item.querySelector('.tq-explain').style.display = 'block';
};
</script>
</body>
</html>`;

    const dir = path.join(ROOT, 'traps', cat.slug);
    ensureDir(dir);
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  });

  // Inject category nav into the hub (idempotent markers).
  const hubPath = path.join(ROOT, 'traps', 'index.html');
  let hub = fs.readFileSync(hubPath, 'utf8');
  hub = hub.replace(/\s*<!-- TRAP CATEGORY NAV -->[\s\S]*?<!-- \/TRAP CATEGORY NAV -->/g, '');
  const navCards = cats.map(c => `
      <a href="/traps/${c.slug}/" style="background:white;border:1px solid var(--mist);border-radius:8px;padding:12px 16px;text-decoration:none;color:var(--ink);display:block;">
        <div style="font-size:14px;font-weight:600;">${c.letter}. ${escHtml(c.name_en)} <span class="chinese" style="color:var(--stone);font-weight:400;">${escHtml(c.name_cn)}</span></div>
        <div style="font-size:12px;color:var(--accent);margin-top:4px;">${c.traps.length} ${c.traps.length === 1 ? 'trap' : 'traps'} + focused quiz →</div>
      </a>`).join('');
  const navBlock = `\n  <!-- TRAP CATEGORY NAV -->
  <section style="margin:24px 0 32px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin-bottom:12px;">Deep-dive by category / 分类精学</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:12px;">${navCards}
    </div>
  </section>
  <!-- /TRAP CATEGORY NAV -->\n`;
  hub = hub.replace(/(<h2 class="category-h2">A\.)/, navBlock + '$1');
  fs.writeFileSync(hubPath, hub, 'utf8');

  console.log(`[trap-cats] Generated ${cats.length} category pages + hub nav`);
  return cats.map(c => ({ loc: `/traps/${c.slug}/`, priority: '0.7' }));
}


buildVocabulary();
buildTestPages();
buildHomepage();
buildTopics();
fixGuide();
buildSentenceOrder();
addGrammarCrossLinks();
buildWritingGuide();
const taskSlugs = buildTaskTopicPages();
const confusableSlugs = buildConfusablePages();
const grammarPatternSlugs = buildGrammarPatternPages();
buildGrammarPatternsHub();
const characterList = buildCharacterPages();
const sentenceCatPages = buildSentenceCategoryPages();
const trapCatPages = buildTrapCategoryPages();
addTestLinksToHubs();
buildSitemap(taskSlugs, confusableSlugs, grammarPatternSlugs, characterList, [...sentenceCatPages, ...trapCatPages]);
console.log('\nDone! All static content pre-rendered.');
