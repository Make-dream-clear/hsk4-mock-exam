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

function generateTopicQuiz(words) {
  // Pick 5 random words for a vocabulary matching quiz
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const quizWords = shuffled.slice(0, Math.min(5, words.length));

  const quizItems = quizWords.map((w, qi) => {
    const others = words.filter(x => x.id !== w.id).sort(() => Math.random() - 0.5).slice(0, 2);
    const allOpts = [w, ...others].sort(() => Math.random() - 0.5);
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
      <div class="example-en">${escHtml(w.example_en || '')}</div>
    </div>
  </div>
</div>`;
  }).join('\n');

  // Replace the loading spinner inside #vocab-list with pre-rendered content
  html = html.replace(
    /<div class="vocab-list" id="vocab-list">\s*<div class="loading">.*?<\/div>\s*<\/div>/s,
    `<div class="vocab-list" id="vocab-list">\n${staticRows}\n</div>`
  );

  // Move SEO content BEFORE the vocab list so it's near the top of the page
  // We do this by replacing the existing SEO section AND injecting new content before the filter bar
  const newVocabSEO = `<section class="seo-content" style="margin-top:48px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:24px;margin-bottom:16px;">HSK 4 Vocabulary (2026 New Syllabus)</h2>
    <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
      This word list follows the <strong>2025 official HSK syllabus</strong> (published by the Center for Language Education and Cooperation, effective July 2026). The new syllabus organizes HSK 4 around 25 communicative tasks \u2014 from discussing people (\u8C08\u8BBA\u67D0\u4E2A\u4EBA\u7269) and emotions (\u8C08\u8BBA\u60C5\u611F\u8BDD\u9898), to handling daily affairs (\u4EA4\u6D41\u3001\u5904\u7406\u65E5\u5E38\u4E8B\u52A1), to discussing social phenomena (\u8C08\u8BBA\u793E\u4F1A\u73B0\u8C61).
    </p>

    <h3 style="font-family:'Noto Serif SC',serif;font-size:20px;margin-bottom:12px;margin-top:28px;">How HSK 4 Vocabulary Differs from HSK 3</h3>
    <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
      HSK 3 covers about 600 words for daily survival \u2014 ordering food, asking directions, describing your family. HSK 4 adds roughly 600 new words that shift toward <strong>abstract thinking and opinion expression</strong>. The official syllabus explicitly requires you to handle \u201c\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u201d (a certain level of complexity) in conversations. This means words like \u201c\u5374\u201d (qu\u00E8, however), \u201c\u5C3D\u7BA1\u201d (j\u01D0ngu\u01CEn, despite), \u201c\u7ADF\u7136\u201d (j\u00ECngr\u00E1n, unexpectedly), and \u201c\u65E2\u7136\u201d (j\u00ECr\u00E1n, since) become essential for building the complex sentences the exam tests.
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

  // Remove old SEO section (after the word list)
  html = html.replace(
    /<!-- STATIC SEO CONTENT -->.*?<\/section>/s,
    `<!-- SEO content moved above word list -->`
  );

  // Inject SEO content BEFORE the search/filter bar so it's near the top
  html = html.replace(
    /<!-- SEARCH & FILTER -->/,
    `<!-- STATIC SEO CONTENT -->\n  ${newVocabSEO}\n\n  <!-- SEARCH & FILTER -->`
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

        return `
          <div class="static-question">
            <div class="static-q-num">Question ${q.number}</div>
            ${q.text ? `<div class="static-q-text chinese">${escHtml(q.text)}</div>` : ''}
            <div class="static-options">
            ${optionsHtml}
            </div>
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

    // Keep title under 60 chars
    const shortTitle = meta.title.length > 30 ? `HSK 4 Mock Test ${num}` : meta.title;
    const pageTitle = `${shortTitle} \u2014 ${meta.questions} Questions | HSK4 \u6A21\u62DF\u8BD5\u5377 ${num}`;
    const pageDesc = truncDesc(isComplete
      ? `Free HSK 4 practice test #${num}: ${listeningCount} listening, ${readingCount} reading, ${writingCount} writing questions with answer keys.`
      : `Free HSK 4 practice test #${num}: ${listeningCount} listening + ${readingCount} reading questions. Auto-scored with answer keys.`);

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
<meta name="viewport" content="width=device-width, initial-scale=1.0">
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

<link rel="alternate" hreflang="en" href="https://hsk4.mandarinzone.com/test/${num}/">
<link rel="alternate" hreflang="zh" href="https://hsk4.mandarinzone.com/test/${num}/">
<link rel="alternate" hreflang="x-default" href="https://hsk4.mandarinzone.com/test/${num}/">

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
      <div class="logo-mark chinese">MZ</div>
      <div class="logo-text">HSK 4 <span>Mock Exam</span></div>
    </a>
    <nav class="site-nav">
      <a href="/" class="nav-link">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link">Vocabulary</a>
      <a href="/grammar/" class="nav-link">Grammar</a>
      <a href="/topics/" class="nav-link">Topics</a>
      <a href="/writing/" class="nav-link">Writing</a>
      <a href="/words/" class="nav-link">Words</a>
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
      Browse all 12 tests on the <a href="/" style="color:var(--accent);">homepage</a>, or study with our <a href="/vocabulary/" style="color:var(--accent);">vocabulary list</a>, <a href="/grammar/" style="color:var(--accent);">grammar guides</a>, and <a href="/writing/" style="color:var(--accent);">writing exercises</a>.
    </p>
  </section>

  <div class="cta-banner">
    <h3 class="chinese">\u60F3\u8981\u66F4\u7CFB\u7EDF\u5730\u5B66\u4E2D\u6587\uFF1F</h3>
    <p>Mandarin Zone \u2014 Learn Chinese in Beijing & Online since 2008</p>
    <a href="https://mandarinzone.com" target="_blank" rel="noopener" class="btn btn-primary">Visit Mandarin Zone</a>
  </div>
</main>

<footer>
  <p>Made by <a href="https://mandarinzone.com" target="_blank" rel="noopener">Mandarin Zone</a> \u2014 Learn Chinese in Beijing & Online since 2008</p>
  <p style="margin-top:4px;"><a href="/">Mock Exams</a> \u00B7 <a href="/vocabulary/">Vocabulary</a> \u00B7 <a href="/grammar/">Grammar</a> \u00B7 <a href="/writing/">Writing</a> \u00B7 <a href="/guide/">Study Guide</a> \u00B7 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
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

  // Insert noscript after test-grid div
  html = html.replace(
    /(<div id="test-grid" class="test-grid">.*?<\/div>)/s,
    `$1\n    ${noscriptBlock}`
  );

  // Replace generic SEO section with unique, valuable content
  const newSEO = `<!-- STATIC SEO CONTENT -->
    <section style="margin-top:48px;">
      <h2 style="font-family:'Noto Serif SC',serif;font-size:24px;margin-bottom:16px;">Free HSK 4 Practice Tests \u2014 Aligned with the 2026 Official Syllabus</h2>
      <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
        These 12 practice tests follow the <strong>2025 official HSK syllabus</strong> (published by the Center for Language Education and Cooperation, effective July 2026). 5 tests include all three sections (listening, reading, and writing); the other 7 cover listening and reading only, as the writing section requires manual scoring that cannot be automated online. All tests are auto-scored with instant results.
      </p>

      <h3 style="font-family:'Noto Serif SC',serif;font-size:20px;margin-bottom:12px;margin-top:28px;">Section-by-Section Tips</h3>
      <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
        <strong>Listening (\u542C\u529B):</strong> The HSK 4 listening section plays each audio clip only once. The true/false section (\u5224\u65AD\u5BF9\u9519) tests inference \u2014 not just what was said, but what it implies. Tip: practice deciding \u201cwhat does the speaker really mean?\u201d rather than just recognizing individual words.
      </p>
      <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
        <strong>Sentence ordering (\u8BED\u53E5\u6392\u5E8F):</strong> These questions follow structural templates: time/place setup \u2192 subject \u2192 action \u2192 result/comment. Recognizing these patterns makes the section much more manageable. See our <a href="/writing/sentence-order/" style="color:var(--accent);">sentence ordering practice</a> for targeted drills.
      </p>
      <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
        <strong>Fill-in-the-blank (\u9009\u8BCD\u586B\u7A7A):</strong> This section rewards collocations, not just vocabulary. For example, knowing \u201c\u5F71\u54CD\u201d means \u201cinfluence\u201d is not enough \u2014 you need to know it pairs with \u201c\u5BF9\u2026\u4EA7\u751F\u5F71\u54CD\u201d. Our <a href="/vocabulary/" style="color:var(--accent);">vocabulary list</a> includes example sentences showing these collocations in context.
      </p>

      <h2 style="font-family:'Noto Serif SC',serif;font-size:24px;margin-bottom:16px;margin-top:32px;">HSK 4 Exam Format at a Glance</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:15px;">
        <thead>
          <tr style="border-bottom:2px solid var(--mist);text-align:left;">
            <th style="padding:10px 12px;">Section</th>
            <th style="padding:10px 12px;">Questions</th>
            <th style="padding:10px 12px;">Time</th>
            <th style="padding:10px 12px;">What It Tests</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid var(--mist);">
            <td style="padding:10px 12px;">\u542C\u529B Listening</td>
            <td style="padding:10px 12px;">45</td>
            <td style="padding:10px 12px;">~30 min</td>
            <td style="padding:10px 12px;">True/false judgments, multiple choice from audio clips</td>
          </tr>
          <tr style="border-bottom:1px solid var(--mist);">
            <td style="padding:10px 12px;">\u9605\u8BFB Reading</td>
            <td style="padding:10px 12px;">40</td>
            <td style="padding:10px 12px;">40 min</td>
            <td style="padding:10px 12px;">Vocabulary fill-in, sentence ordering, passage comprehension</td>
          </tr>
          <tr style="border-bottom:1px solid var(--mist);">
            <td style="padding:10px 12px;">\u4E66\u5199 Writing</td>
            <td style="padding:10px 12px;">15</td>
            <td style="padding:10px 12px;">25 min</td>
            <td style="padding:10px 12px;">Construct sentences from given words</td>
          </tr>
          <tr style="background:var(--paper);">
            <td style="padding:10px 12px;font-weight:600;">Total</td>
            <td style="padding:10px 12px;font-weight:600;">100</td>
            <td style="padding:10px 12px;font-weight:600;">~105 min</td>
            <td style="padding:10px 12px;">Pass mark: 180/300 (60%)</td>
          </tr>
        </tbody>
      </table>

      <h2 style="font-family:'Noto Serif SC',serif;font-size:24px;margin-bottom:16px;margin-top:32px;">The 25 HSK 4 Task Topics (2026 Syllabus)</h2>
      <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
        Unlike HSK 3 which focuses on basic daily needs, the new HSK 4 syllabus requires handling \u201c\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u201d (a certain level of complexity) across 25 communicative tasks:
      </p>
      <ol style="color:var(--stone);line-height:2.2;margin-bottom:16px;padding-left:20px;columns:2;column-gap:32px;font-size:14px;">
        <li>\u8C08\u8BBA\u67D0\u4E2A\u4EBA\u7269 \u2014 Discuss a person</li>
        <li>\u4EA4\u6D41\u3001\u5904\u7406\u65E5\u5E38\u4E8B\u52A1 \u2014 Handle daily affairs</li>
        <li>\u65E5\u5E38\u8A00\u8BED\u4EA4\u5F80 \u2014 Daily verbal interactions</li>
        <li>\u8C08\u8BBA\u60C5\u611F\u8BDD\u9898 \u2014 Discuss emotions</li>
        <li>\u4ECB\u7ECD\u996E\u98DF\u60C5\u51B5 \u2014 Describe food & dining</li>
        <li>\u8C08\u8BBA\u4EA4\u901A\u51FA\u884C \u2014 Discuss transportation</li>
        <li>\u4EA4\u6D41\u8D2D\u7269\u4F53\u9A8C \u2014 Share shopping experiences</li>
        <li>\u8C08\u8BBA\u5C31\u533B\u3001\u5065\u5EB7\u751F\u6D3B \u2014 Health & medical</li>
        <li>\u4EA4\u6D41\u4E1A\u4F59\u7231\u597D \u2014 Hobbies & leisure</li>
        <li>\u4EA4\u6D41\u5C45\u4F4F\u3001\u793E\u533A\u60C5\u51B5 \u2014 Housing & community</li>
        <li>\u4EA4\u6D41\u5BB6\u5EAD\u751F\u6D3B \u2014 Family life</li>
        <li>\u8C08\u8BBA\u6559\u5B66\u3001\u5B66\u4E60 \u2014 Education & learning</li>
        <li>\u4EA4\u6D41\u6821\u56ED\u751F\u6D3B \u2014 Campus life</li>
        <li>\u8C08\u8BBA\u6559\u80B2\u73B0\u8C61 \u2014 Education phenomena</li>
        <li>\u8C08\u8BBA\u5DE5\u4F5C\u60C5\u51B5 \u2014 Work situations</li>
        <li>\u4ECB\u7ECD\u804C\u4E1A\u7ECF\u5386 \u2014 Career experiences</li>
        <li>\u8C08\u8BBA\u81EA\u7136\u60C5\u51B5 \u2014 Nature & geography</li>
        <li>\u8C08\u8BBA\u73AF\u4FDD\u60C5\u51B5 \u2014 Environmental protection</li>
        <li>\u4ECB\u7ECD\u65B0\u6280\u672F\u5E94\u7528 \u2014 Technology</li>
        <li>\u4ECB\u7ECD\u4E2D\u56FD\u7701\u5E02\u3001\u6C11\u65CF \u2014 Chinese provinces & ethnicities</li>
        <li>\u8C08\u8BBA\u7ECF\u6D4E\u73B0\u8C61 \u2014 Economic phenomena</li>
        <li>\u8C08\u8BBA\u793E\u4F1A\u73B0\u8C61 \u2014 Social phenomena</li>
        <li>\u4ECB\u7ECD\u6587\u827A\u5F62\u5F0F \u2014 Arts & entertainment</li>
        <li>\u8C08\u8BBA\u4F53\u80B2\u6BD4\u8D5B \u2014 Sports</li>
        <li>\u8BB2\u8FF0\u4E2D\u5916\u53CB\u597D\u6545\u4E8B \u2014 China-world friendship</li>
      </ol>

      <h2 style="font-family:'Noto Serif SC',serif;font-size:24px;margin-bottom:16px;margin-top:32px;">HSK 4 Grammar: What the 2026 Syllabus Adds</h2>
      <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
        The official grammar syllabus adds significant complexity at Level 4. Key new patterns include: <strong>\u628A\u5B57\u53E52</strong> with four new structures (tentative, completed, quantified, and modified forms); <strong>\u88AB\u52A8\u53E52</strong> using \u53EB/\u8BA9 instead of just \u88AB; <strong>\u517C\u8BED\u53E52</strong> for causative and evaluative sentences; <strong>\u6BD4\u8F83\u53E53</strong> with \u201cA\u4E0D\u5982B\u201d and \u201c\u8DDF\u2026\u76F8\u6BD4\u201d; <strong>\u53CC\u91CD\u5426\u5B9A\u53E5</strong> for emphasis; plus many new complex sentence types (\u590D\u53E5) including concessive (\u5C3D\u7BA1\u2026\u4F46\u662F), conditional (\u4E0D\u7BA1\u2026\u90FD, \u65E0\u8BBA\u2026\u90FD), and hypothetical (\u8981\u662F\u2026\u5426\u5219) patterns. See our <a href="/grammar/" style="color:var(--accent);">grammar guide</a> for interactive practice on each pattern.
      </p>

      <h2 style="font-family:'Noto Serif SC',serif;font-size:24px;margin-bottom:16px;margin-top:32px;">How to Use These Mock Exams Effectively</h2>
      <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
        <strong>Week 1\u20134:</strong> Take one test per week under timed conditions. After each test, spend twice as long reviewing your wrong answers as you spent taking the test. For every wrong answer, find the grammar pattern or vocabulary word you missed and add it to your study list.
      </p>
      <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
        <strong>Week 5\u20138:</strong> Focus on your weakest section. If listening is your weakest, replay the audio questions from completed tests and practice shadowing the dialogues. If reading is weakest, use our <a href="/grammar/" style="color:var(--accent);">grammar guide</a> to fill gaps in sentence patterns. If writing is weakest, practice the <a href="/writing/" style="color:var(--accent);">sentence ordering drills</a>.
      </p>
      <p style="color:var(--stone);line-height:1.8;margin-bottom:16px;">
        <strong>Final 2 weeks:</strong> Take 2\u20133 full tests back-to-back to build exam stamina. By this point, aim for 70%+ consistently \u2014 that gives you a comfortable margin above the 60% pass line.
      </p>
      <p style="color:var(--stone);line-height:1.8;">
        These tests are created by <a href="https://mandarinzone.com" style="color:var(--accent);">Mandarin Zone</a>, a Chinese language school in Beijing since 2008. For personalized HSK preparation with experienced teachers, visit our website for online and in-person classes.
      </p>
    </section>`;

  html = html.replace(
    /<!-- Static SEO content for search engines -->.*?<\/section>/s,
    newSEO
  );

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('[home] Homepage SEO content updated');
}

// ============================================================
// 4. UPDATE SITEMAP with test pages
// ============================================================

function buildSitemap(taskSlugs, confusableSlugs, grammarPatternSlugs) {
  console.log('[sitemap] Updating sitemap.xml...');
  const index = readJSON('index.json');
  const today = new Date().toISOString().split('T')[0];

  const existingPages = [
    { loc: '/', priority: '1.0' },
    { loc: '/vocabulary/', priority: '0.9' },
    { loc: '/grammar/', priority: '0.8' },
    { loc: '/topics/', priority: '0.9' },
    { loc: '/guide/', priority: '0.8' },
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

  const allPages = [...existingPages, ...testPages, ...taskPages, ...confusablePages, ...grammarPatternPages];

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

  // Insert static content before the empty #categories div
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
// 6. FIX GUIDE PAGE: 30 tasks → 25 tasks + 5 cultural topics
// ============================================================

function fixGuide() {
  console.log('[guide] Fixing task count consistency (30 → 25+5)...');
  const htmlPath = path.join(ROOT, 'guide', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Fix the section title
  html = html.replace(
    /30 Task Scenarios \/ 30个交际任务/g,
    '25 Communicative Tasks + 5 Cultural Topics / 25\u4E2A\u4EA4\u9645\u4EFB\u52A1 + 5\u4E2A\u6587\u5316\u8BDD\u9898'
  );

  // Fix the description paragraph
  html = html.replace(
    /defines exactly 30 communicative tasks/,
    'defines 25 communicative tasks and 5 cultural knowledge topics'
  );

  // Fix the info card that says "30 Task Scenarios"
  html = html.replace(
    /<div class="info-card-num" style="color:var\(--jade\);font-size:24px;">30<\/div>\s*<div class="info-card-label">Task Scenarios<\/div>\s*<div class="info-card-detail">Covering 7 topic categories<\/div>/,
    `<div class="info-card-num" style="color:var(--jade);font-size:24px;">25+5</div>
      <div class="info-card-label">Tasks & Topics</div>
      <div class="info-card-detail">25 tasks + 5 cultural topics</div>`
  );

  // Add a note before the Culture category to distinguish tasks from topics
  html = html.replace(
    /<div class="task-category">\s*<div class="task-category-header"><div class="task-dot" style="background:var\(--ink\)"><\/div> Culture \/ 文化<\/div>/,
    `<p style="color:var(--stone);font-size:14px;margin:16px 0 8px;font-style:italic;">The following 5 items are cultural knowledge topics (\u8BDD\u9898\u5927\u7EB2), not communicative tasks (\u4EFB\u52A1\u5927\u7EB2). They define background knowledge the exam may reference.</p>
    <div class="task-category">
      <div class="task-category-header"><div class="task-dot" style="background:var(--ink)"></div> Cultural Knowledge / \u6587\u5316\u77E5\u8BC6 <span style="font-size:12px;color:var(--stone);font-weight:400;margin-left:4px;">(\u8BDD\u9898\u5927\u7EB2)</span></div>`
  );

  // Fix FAQ structured data if it mentions 30
  html = html.replace(
    /30 defined task scenarios/g,
    '25 communicative tasks and 5 cultural knowledge topics'
  );

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('[guide] Fixed: 25 tasks + 5 cultural topics, with clear distinction');
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

  // Insert before the exercise box
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
    { dir: 'ba-sentence', name: '\u628A\u5B57\u53E5', nameEn: 'Ba-Sentence' },
    { dir: 'passive', name: '\u88AB\u5B57\u53E5', nameEn: 'Passive' },
    { dir: 'comparison', name: '\u6BD4\u8F83\u53E5', nameEn: 'Comparison' },
    { dir: 'complement', name: '\u8865\u8BED', nameEn: 'Complements' },
    { dir: 'complex-sentences', name: '\u590D\u53E5', nameEn: 'Complex Sentences' },
    { dir: 'adverbs', name: '\u526F\u8BCD', nameEn: 'Adverbs' },
    { dir: 'function-words', name: '\u865A\u8BCD', nameEn: 'Function Words' },
    { dir: 'pivotal-sentences', name: '\u517C\u8BED\u53E5', nameEn: 'Pivotal Sentences' },
    { dir: 'fixed-patterns', name: '\u56FA\u5B9A\u642D\u914D', nameEn: 'Fixed Patterns' },
    { dir: 'rhetorical', name: '\u4FEE\u8F9E', nameEn: 'Rhetorical' },
  ];

  grammarPages.forEach(page => {
    const htmlPath = path.join(ROOT, 'grammar', page.dir, 'index.html');
    if (!fs.existsSync(htmlPath)) return;
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Skip if cross-links already added
    if (html.includes('seo-cross-links')) return;

    // Build links to other grammar pages (excluding self)
    const links = grammarPages
      .filter(p => p.dir !== page.dir)
      .map(p => `<a href="/grammar/${p.dir}/" style="color:var(--accent);text-decoration:none;padding:4px 12px;border:1px solid var(--mist);border-radius:6px;font-size:13px;display:inline-block;margin:3px;">${p.name} ${p.nameEn}</a>`)
      .join('\n      ');

    const crossLinkBlock = `
  <!-- seo-cross-links -->
  <section style="margin-top:32px;padding-top:24px;border-top:1px solid var(--mist);">
    <h3 style="font-size:16px;margin-bottom:12px;color:var(--stone);">Other HSK 4 Grammar Topics</h3>
    <div style="display:flex;flex-wrap:wrap;gap:4px;">
      ${links}
    </div>
    <p style="margin-top:16px;font-size:14px;color:var(--stone);">
      Practice these grammar patterns in context with our <a href="/" style="color:var(--accent);">mock exams</a>, or review the full <a href="/vocabulary/" style="color:var(--accent);">HSK 4 vocabulary list</a>. For sentence-level practice, try our <a href="/writing/sentence-order/" style="color:var(--accent);">sentence ordering exercises</a>.
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
  console.log('[writing] Enriching writing entry page...');
  const htmlPath = path.join(ROOT, 'writing', 'index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log('[writing] writing/index.html not found, skipping');
    return;
  }
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Skip if already enriched
  if (html.includes('writing-seo-content')) return;

  const writingContent = `
  <!-- writing-seo-content -->
  <section style="margin-top:40px;">
    <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin-bottom:14px;">HSK 4 Writing Section: What the Exam Actually Tests</h2>
    <p style="color:var(--stone);line-height:1.8;margin-bottom:14px;">
      The HSK 4 writing section (\u4E66\u5199) has <strong>15 questions in 25 minutes</strong>, worth 100 points. It consists of two parts:
    </p>
    <ul style="color:var(--stone);line-height:2;margin-bottom:16px;padding-left:20px;">
      <li><strong>Part 1 \u2014 Sentence ordering (\u8BED\u53E5\u6392\u5E8F):</strong> You are given 4\u20136 sentence fragments and must arrange them into a grammatically correct sentence. This tests your understanding of Chinese word order rules: time before place, adverbs before verbs, \u628A/\u88AB placement, complement positions. <a href="/writing/sentence-order/" style="color:var(--accent);">Practice sentence ordering \u2192</a></li>
      <li><strong>Part 2 \u2014 Sentence construction (\u770B\u56FE\u9020\u53E5):</strong> Given a set of words (usually 3\u20135) and sometimes a picture, you must write a complete, grammatically correct sentence using all the given words. This tests productive grammar \u2014 you cannot just recognize patterns, you must generate them.</li>
    </ul>

    <h3 style="font-family:'Noto Serif SC',serif;font-size:18px;margin-bottom:12px;margin-top:24px;">Common Mistakes in HSK 4 Writing (and How to Avoid Them)</h3>
    <ol style="color:var(--stone);line-height:2;margin-bottom:16px;padding-left:20px;">
      <li><strong>\u628A\u5B57\u53E5 word order errors:</strong> Putting the complement before \u628A instead of after the verb. Correct: \u4ED6<em>\u628A</em>\u4E66<em>\u653E\u5728</em>\u684C\u5B50\u4E0A\u3002 <a href="/grammar/ba-sentence/" style="color:var(--accent);">Review \u628A\u5B57\u53E5 \u2192</a></li>
      <li><strong>Adverb misplacement:</strong> Adverbs like \u5DF2\u7ECF, \u90FD, \u53C8 must go <em>before</em> the verb, not at the end. Correct: \u4ED6<em>\u5DF2\u7ECF</em>\u5230\u4E86\u3002</li>
      <li><strong>Missing \u4E86/\u8FC7/\u7740:</strong> Forgetting aspect markers changes the meaning entirely. \u4ED6\u5403\u996D = He eats. \u4ED6\u5403<em>\u4E86</em>\u996D = He ate.</li>
      <li><strong>Comparison structure errors:</strong> Mixing up A\u6BD4B+adj. vs. A\u6CA1\u6709B+adj. The negative form uses \u6CA1\u6709, never \u4E0D\u6BD4. <a href="/grammar/comparison/" style="color:var(--accent);">Review comparisons \u2192</a></li>
      <li><strong>Complex sentence connector pairing:</strong> Using \u867D\u7136 without \u4F46\u662F, or putting \u56E0\u4E3A/\u6240\u4EE5 in the wrong clause. <a href="/grammar/complex-sentences/" style="color:var(--accent);">Review \u590D\u53E5 \u2192</a></li>
    </ol>

    <h3 style="font-family:'Noto Serif SC',serif;font-size:18px;margin-bottom:12px;margin-top:24px;">Writing Section Strategy</h3>
    <p style="color:var(--stone);line-height:1.8;margin-bottom:14px;">
      <strong>For sentence ordering:</strong> First identify the time/place word (it usually goes first), then find paired connectors (\u5C3D\u7BA1\u2026\u4F46\u662F, \u4E0D\u4F46\u2026\u800C\u4E14), then slot in the subject and verb. Check your answer by reading the complete sentence aloud \u2014 if it sounds unnatural, something is likely out of order.
    </p>
    <p style="color:var(--stone);line-height:1.8;margin-bottom:14px;">
      <strong>For sentence construction:</strong> Before writing, decide the sentence pattern first (\u628A\u5B57\u53E5? \u88AB\u5B57\u53E5? \u6BD4\u8F83\u53E5?). Then place each given word into its correct slot in the pattern. Make sure every given word is used exactly once.
    </p>
    <p style="color:var(--stone);line-height:1.8;">
      The official syllabus requires HSK 4 students to \u201c\u5199\u51FA\u4E00\u6BB5\u8BDD\u7B80\u5355\u4ECB\u7ECD\u201d (write a paragraph to briefly describe) topics. Practice with our <a href="/writing/paragraph/" style="color:var(--accent);">paragraph writing exercises</a> to build this skill.
    </p>
  </section>`;

  // Insert before closing </main>
  html = html.replace(/<\/main>/, `${writingContent}\n</main>`);

  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('[writing] Added writing section guide content');
}

// ============================================================
// 10. GENERATE 25 TASK TOPIC PAGES
// ============================================================

function buildTaskTopicPages() {
  console.log('[task-topics] Generating 25 task topic pages...');
  const topics = readJSON('topics.json');
  const vocab = readJSON('vocabulary.json');
  const wordMap = {};
  vocab.forEach(w => { wordMap[w.id] = w; });

  // 25 official tasks mapped to topic IDs, descriptions, grammar links
  const tasks = [
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
      slug: 'shopping', task_cn: '\u4EA4\u6D41\u8D2D\u7269\u4F53\u9A8C', task_en: 'Shopping Experiences',
      topic_ids: ['shopping'],
      desc: 'Discuss product selection, online shopping, brand choices, spending, payment methods, and sales promotions. HSK 4 goes beyond price negotiation to evaluating shopping experiences.',
      syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u5546\u54C1\u9009\u8D2D\u3001\u8D2D\u7269\u4F53\u9A8C\u3001\u5546\u4E1A\u6D3B\u52A8\u7B49\u65B9\u9762\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002\u5982\u7F51\u8D2D\u4E0E\u54C1\u724C\u9009\u62E9\u3001\u652F\u4ED8\u65B9\u5F0F\u3001\u6253\u6298\u4FC3\u9500\u7B49\u3002',
      grammar: ['/grammar/comparison/', '/grammar/adverbs/'],
      skills: ['listening', 'speaking', 'reading', 'writing'],
    },
    {
      slug: 'health-medical', task_cn: '\u8C08\u8BBA\u5C31\u533B\u3001\u5065\u5EB7\u751F\u6D3B', task_en: 'Health & Medical',
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
      slug: 'housing-community', task_cn: '\u4EA4\u6D41\u5C45\u4F4F\u3001\u793E\u533A\u60C5\u51B5', task_en: 'Housing & Community',
      topic_ids: ['community'],
      desc: 'Discuss living conditions, neighborhood relationships, community services, and house renting/buying. Includes understanding rental listings and community notices.',
      syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u5C45\u4F4F\u60C5\u51B5\u3001\u793E\u533A\u751F\u6D3B\u3001\u623F\u5C4B\u79DF\u8D41\u4E0E\u4E70\u5356\u7B49\u60C5\u51B5\u7684\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u8BE2\u95EE\u3002\u5982\u5C0F\u533A\u73AF\u5883\u3001\u90BB\u91CC\u76F8\u5904\u3001\u79DF\u623F\u6761\u4EF6\u7B49\u3002',
      grammar: ['/grammar/comparison/', '/grammar/passive/'],
      skills: ['listening', 'speaking', 'reading', 'writing'],
    },
    {
      slug: 'family-life', task_cn: '\u4EA4\u6D41\u5BB6\u5EAD\u751F\u6D3B', task_en: 'Family Life',
      topic_ids: ['family'],
      desc: 'Discuss home life, family relationships, growing up, habits, and household affairs. Includes topics like parent-child relationships and hometown memories.',
      syllabus_cn: '\u80FD\u542C\u61C2\u5173\u4E8E\u5C45\u5BB6\u751F\u6D3B\u3001\u5BB6\u5EAD\u5173\u7CFB\u3001\u6210\u957F\u8FC7\u7A0B\u3001\u751F\u6D3B\u4E60\u60EF\u3001\u5BB6\u5EAD\u4E8B\u52A1\u7B49\u6709\u4E00\u5B9A\u590D\u6742\u5EA6\u7684\u95EE\u9898\u3002',
      grammar: ['/grammar/complex-sentences/', '/grammar/pivotal-sentences/'],
      skills: ['listening', 'speaking', 'reading', 'writing'],
    },
    {
      slug: 'education-learning', task_cn: '\u8C08\u8BBA\u6559\u5B66\u3001\u5B66\u4E60', task_en: 'Education & Learning',
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
      slug: 'education-issues', task_cn: '\u8C08\u8BBA\u6559\u80B2\u73B0\u8C61', task_en: 'Education Phenomena',
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
      slug: 'china-provinces', task_cn: '\u4ECB\u7ECD\u4E2D\u56FD\u7701\u5E02\u6C11\u65CF', task_en: 'China Overview',
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
  ];

  // Skip thin pages (< 10 words) — content merged into related pages
  const skipSlugs = new Set(['economy', 'education-issues', 'international-friendship']);

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

    // Grammar links
    const grammarLinksHtml = task.grammar.map(g => {
      const name = g.replace('/grammar/', '').replace('/', '');
      return `<a href="${g}" class="btn btn-ghost" style="font-size:13px;">${name}</a>`;
    }).join(' ');

    // Keep title under 65 chars
    let pageTitle = `HSK 4 ${task.task_en} \u2014 ${task.task_cn} | Vocabulary`;
    if (pageTitle.length > 65) {
      pageTitle = `HSK 4 ${task.task_en} \u2014 ${task.task_cn}`;
    }
    if (pageTitle.length > 65) {
      pageTitle = `HSK 4: ${task.task_en} | ${task.task_cn}`;
    }
    const pageDesc = truncDesc(`${words.length} HSK 4 words for "${task.task_en}" (${task.task_cn}). Vocabulary with pinyin, meanings, examples from the official syllabus.`);

    const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(pageTitle)}</title>
<meta name="description" content="${escHtml(pageDesc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/topics/${task.slug}/">

<meta property="og:title" content="HSK 4 ${escHtml(task.task_en)} Vocabulary \u2014 ${escHtml(task.task_cn)}">
<meta property="og:description" content="${escHtml(pageDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/topics/${task.slug}/">
<meta property="og:site_name" content="Mandarin Zone">

<link rel="alternate" hreflang="en" href="https://hsk4.mandarinzone.com/topics/${task.slug}/">
<link rel="alternate" hreflang="zh" href="https://hsk4.mandarinzone.com/topics/${task.slug}/">
<link rel="alternate" hreflang="x-default" href="https://hsk4.mandarinzone.com/topics/${task.slug}/">

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
      <div class="logo-mark chinese">MZ</div>
      <div class="logo-text">HSK 4 <span>Mock Exam</span></div>
    </a>
    <nav class="site-nav">
      <a href="/" class="nav-link">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link">Vocabulary</a>
      <a href="/grammar/" class="nav-link">Grammar</a>
      <a href="/topics/" class="nav-link" style="opacity:1;">Topics</a>
      <a href="/writing/" class="nav-link">Writing</a>
      <a href="/words/" class="nav-link">Words</a>
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
    <h1 class="chinese">${escHtml(task.task_cn)} \u2014 <span class="accent">${escHtml(task.task_en)}</span></h1>
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

  ${words.length >= 8 ? generateTopicQuiz(words) : ''}

  <div style="text-align:center;margin:32px 0;">
    <a href="/vocabulary/" class="btn btn-primary">Study All HSK 4 Vocabulary</a>
    <a href="/" class="btn btn-secondary" style="margin-left:8px;">Take a Mock Exam</a>
    <a href="/words/" class="btn btn-ghost" style="margin-left:8px;">Confusable Words</a>
  </div>

  <h2 style="font-family:'Noto Serif SC',serif;font-size:20px;margin:32px 0 12px;">Practice This Topic</h2>
  <p style="color:var(--stone);margin-bottom:12px;font-size:14px;">Test your knowledge of ${escHtml(task.task_en).toLowerCase()} vocabulary in context:</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
    <a href="/test/01/" class="btn btn-ghost" style="font-size:13px;">Mock Test 01</a>
    <a href="/test/03/" class="btn btn-ghost" style="font-size:13px;">Mock Test 03</a>
    <a href="/test/06/" class="btn btn-ghost" style="font-size:13px;">Mock Test 06</a>
    <a href="/writing/sentence-order/" class="btn btn-ghost" style="font-size:13px;">Sentence Ordering</a>
  </div>

  <div class="task-nav">
    ${tasks.indexOf(task) > 0 ? `<a href="/topics/${tasks[tasks.indexOf(task)-1].slug}/" class="btn btn-ghost">&larr; ${escHtml(tasks[tasks.indexOf(task)-1].task_en)}</a>` : '<span></span>'}
    <a href="/topics/" class="btn btn-secondary">All Topics</a>
    ${tasks.indexOf(task) < tasks.length - 1 ? `<a href="/topics/${tasks[tasks.indexOf(task)+1].slug}/" class="btn btn-ghost">${escHtml(tasks[tasks.indexOf(task)+1].task_en)} &rarr;</a>` : '<span></span>'}
  </div>
</main>

<footer>
  <p>Made by <a href="https://mandarinzone.com" target="_blank" rel="noopener">Mandarin Zone</a> \u2014 Learn Chinese in Beijing & Online since 2008</p>
  <p style="margin-top:4px;"><a href="/">Mock Exams</a> \u00B7 <a href="/vocabulary/">Vocabulary</a> \u00B7 <a href="/grammar/">Grammar</a> \u00B7 <a href="/topics/">Topics</a> \u00B7 <a href="/writing/">Writing</a> \u00B7 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
</footer>

</body>
</html>`;

    fs.writeFileSync(path.join(dir, 'index.html'), pageHtml, 'utf8');
  });

  // Add to sitemap
  const generated = tasks.filter(t => !skipSlugs.has(t.slug));
  console.log(`[task-topics] Generated ${generated.length} task topic pages (skipped ${skipSlugs.size} thin pages)`);
  return generated.map(t => t.slug);
}

// ============================================================
// 11. GENERATE CONFUSABLE WORD PAIR PAGES
// ============================================================

function buildConfusablePages() {
  console.log('[confusables] Generating confusable word pair pages...');
  const pairs = readJSON('confusables.json');

  pairs.forEach((pair, pi) => {
    const dir = path.join(ROOT, 'words', pair.slug);
    ensureDir(dir);

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
    const pageDesc = truncDesc(`${pair.wordA} vs ${pair.wordB}: ${pair.subtitle}. Comparison, examples, and quiz for HSK 4.`);

    const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(pageTitle)}</title>
<meta name="description" content="${escHtml(pageDesc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/words/${pair.slug}/">

<meta property="og:title" content="${escHtml(pair.wordA)} vs ${escHtml(pair.wordB)} \u2014 HSK 4 Confusable Words">
<meta property="og:description" content="${escHtml(pageDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/words/${pair.slug}/">
<meta property="og:site_name" content="Mandarin Zone">

<link rel="alternate" hreflang="en" href="https://hsk4.mandarinzone.com/words/${pair.slug}/">
<link rel="alternate" hreflang="zh" href="https://hsk4.mandarinzone.com/words/${pair.slug}/">
<link rel="alternate" hreflang="x-default" href="https://hsk4.mandarinzone.com/words/${pair.slug}/">

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
    <a href="/" class="logo"><div class="logo-mark chinese">MZ</div><div class="logo-text">HSK 4 <span>Mock Exam</span></div></a>
    <nav class="site-nav">
      <a href="/" class="nav-link">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link">Vocabulary</a>
      <a href="/grammar/" class="nav-link">Grammar</a>
      <a href="/topics/" class="nav-link">Topics</a>
      <a href="/writing/" class="nav-link">Writing</a>
      <a href="/words/" class="nav-link" style="opacity:1;">Words</a>
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
    <h1 class="chinese"><span class="accent">${escHtml(pair.wordA)}</span> vs <span style="color:var(--jade);">${escHtml(pair.wordB)}</span></h1>
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

  <div class="pair-nav">
    ${prevPair ? `<a href="/words/${prevPair.slug}/" class="btn btn-ghost">&larr; ${escHtml(prevPair.wordA)} vs ${escHtml(prevPair.wordB)}</a>` : '<span></span>'}
    <a href="/words/" class="btn btn-secondary">All Confusable Words</a>
    ${nextPair ? `<a href="/words/${nextPair.slug}/" class="btn btn-ghost">${escHtml(nextPair.wordA)} vs ${escHtml(nextPair.wordB)} &rarr;</a>` : '<span></span>'}
  </div>
</main>

<footer>
  <p>Made by <a href="https://mandarinzone.com" target="_blank" rel="noopener">Mandarin Zone</a> \u2014 Learn Chinese in Beijing & Online since 2008</p>
  <p style="margin-top:4px;"><a href="/">Mock Exams</a> \u00B7 <a href="/vocabulary/">Vocabulary</a> \u00B7 <a href="/grammar/">Grammar</a> \u00B7 <a href="/words/">Confusable Words</a> \u00B7 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
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
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(pageTitle)}</title>
<meta name="description" content="${escHtml(pageDesc)}">
<link rel="canonical" href="https://hsk4.mandarinzone.com/grammar/patterns/${pat.slug}/">

<meta property="og:title" content="${escHtml(pat.pattern_cn)} \u2014 HSK 4 Grammar">
<meta property="og:description" content="${escHtml(pageDesc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://hsk4.mandarinzone.com/grammar/patterns/${pat.slug}/">
<meta property="og:site_name" content="Mandarin Zone">

<link rel="alternate" hreflang="en" href="https://hsk4.mandarinzone.com/grammar/patterns/${pat.slug}/">
<link rel="alternate" hreflang="zh" href="https://hsk4.mandarinzone.com/grammar/patterns/${pat.slug}/">
<link rel="alternate" hreflang="x-default" href="https://hsk4.mandarinzone.com/grammar/patterns/${pat.slug}/">

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
    <a href="/" class="logo"><div class="logo-mark chinese">MZ</div><div class="logo-text">HSK 4 <span>Mock Exam</span></div></a>
    <nav class="site-nav">
      <a href="/" class="nav-link">Mock Exams</a>
      <a href="/vocabulary/" class="nav-link">Vocabulary</a>
      <a href="/grammar/" class="nav-link" style="opacity:1;">Grammar</a>
      <a href="/topics/" class="nav-link">Topics</a>
      <a href="/writing/" class="nav-link">Writing</a>
      <a href="/words/" class="nav-link">Words</a>
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
    <h1 class="chinese" style="font-family:'Noto Serif SC',serif;">${escHtml(pat.pattern_cn)}</h1>
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

  <div class="pat-nav">
    ${prevPat ? `<a href="/grammar/patterns/${prevPat.slug}/" class="btn btn-ghost">&larr; ${escHtml(prevPat.pattern_cn)}</a>` : '<span></span>'}
    <a href="/grammar/" class="btn btn-secondary">Grammar Hub</a>
    ${nextPat ? `<a href="/grammar/patterns/${nextPat.slug}/" class="btn btn-ghost">${escHtml(nextPat.pattern_cn)} &rarr;</a>` : '<span></span>'}
  </div>
</main>

<footer>
  <p>Made by <a href="https://mandarinzone.com" target="_blank" rel="noopener">Mandarin Zone</a> \u2014 Learn Chinese in Beijing & Online since 2008</p>
  <p style="margin-top:4px;"><a href="/">Mock Exams</a> \u00B7 <a href="/vocabulary/">Vocabulary</a> \u00B7 <a href="/grammar/">Grammar</a> \u00B7 <a href="/words/">Confusable Words</a> \u00B7 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a></p>
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
// RUN ALL
// ============================================================

console.log('=== HSK4 SEO Build ===\n');
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
addTestLinksToHubs();
buildSitemap(taskSlugs, confusableSlugs, grammarPatternSlugs);
console.log('\nDone! All static content pre-rendered.');
