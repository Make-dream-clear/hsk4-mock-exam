// === STATE ===
let allTests = [];
let currentTest = null;
let currentTestIndex = null;
let currentQ = 0;            // absolute question index (0-based)
let userAnswers = {};        // qIndex -> choice index or a written draft
let retrying = false;
let retryFeedback = null;
let progressSaved = true;
let flags = {};              // qIndex -> true (marked for review)
let reviewMode = false;
let reviewList = null;       // null = walk all questions; array = subset (wrong-only)
let elapsed = 0;             // seconds spent on the current attempt
let timerId = null;
let timerPaused = false;
let lastResult = null;       // cached result for review/next-steps

const STORE = 'hsk4_progress_';        // in-progress attempt, per test
const STORE_RESULT = 'hsk4_result_';   // last completed score, per test

// === SECTIONS ===
// Map each question type to an exam section so we can score by skill.
const SECTION_OF = {
  listening_true_false: 'Listening',
  listening_choice: 'Listening',
  fill_in_blank: 'Reading',
  reading_ordering: 'Reading',
  reading_comprehension: 'Reading',
  choice: 'Writing',
  writing_construction: 'Writing',
};
const SECTION_META = {
  Listening: { zh: '听力', cls: 'badge-listening', href: '/strategies/listening-judgment/', resource: 'Listening strategies' },
  Reading:   { zh: '阅读', cls: 'badge-reading',   href: '/strategies/reading-comprehension/', resource: 'Reading strategies' },
  Writing:   { zh: '书写', cls: 'badge-writing',   href: '/sentences/', resource: '100 essential sentences' },
};
function sectionOf(q) { return HSK4Scoring.sectionOf(q); }

const TYPE_MAP = {
  listening_true_false: ['Listening · 听力判断', 'badge-listening'],
  listening_choice: ['Listening · 听力选择', 'badge-listening'],
  fill_in_blank: ['Reading · 选词填空', 'badge-reading'],
  reading_ordering: ['Reading · 语句排序', 'badge-reading'],
  reading_comprehension: ['Reading · 阅读理解', 'badge-reading'],
  choice: ['Writing · 书写', 'badge-writing'],
  writing_construction: ['Writing · 独立作答', 'badge-writing'],
};
const MARKERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// === UTILS ===
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : str;
  return d.innerHTML;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h > 0 ? h + ':' + pad2(m) : m) + ':' + pad2(sec);
}
function $(id) { return document.getElementById(id); }

// === PERSISTENCE (localStorage; degrades silently in private mode) ===
function progKey(i) { return STORE + i; }
function resultKey(i) { return STORE_RESULT + i; }
function saveProgress() {
  if (currentTestIndex == null || reviewMode) return;
  try {
    localStorage.setItem(progKey(currentTestIndex), JSON.stringify({
      schemaVersion: 2, answers: userAnswers, flags: flags, currentQ: currentQ, elapsed: elapsed, ts: Date.now(),
    }));
    progressSaved = true;
  } catch (e) { progressSaved = false; }
}
function loadProgress(i) {
  try { const raw = localStorage.getItem(progKey(i)); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}
function clearProgress(i) { try { localStorage.removeItem(progKey(i)); } catch (e) {} }
function saveResult(i, r) {
  try { localStorage.setItem(resultKey(i), JSON.stringify(r)); return true; }
  catch (e) { return false; }
}
function loadResult(i) {
  try { const raw = localStorage.getItem(resultKey(i)); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}
function answeredCount(answers) { return answers ? Object.keys(answers).length : 0; }

// === DATA LOADING ===
const BASE = './data/';

async function loadIndex() {
  try {
    const res = await fetch(BASE + 'index.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    allTests = await res.json();
    renderTestGrid();
    handleDeepLink();
  } catch (e) {
    $('test-grid').innerHTML = '<p style="color:var(--stone);padding:20px;">Failed to load tests. Make sure you\'re serving this from a web server or GitHub Pages.</p>';
  }
}

// Auto-start a test from /?start=N (used by every static test page's
// "Start Interactive Test" button). Clean the URL afterwards so a refresh
// doesn't relaunch the quiz unexpectedly.
function handleDeepLink() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('start')) return;
  const n = parseInt(params.get('start'), 10);
  try { history.replaceState(null, '', window.location.pathname + window.location.hash); } catch (e) {}
  if (!isNaN(n) && n >= 0 && n < allTests.length) startTest(n);
}

function renderTestGrid() {
  const grid = $('test-grid');
  grid.innerHTML = allTests.map((t, i) => {
    const prog = loadProgress(i);
    const done = answeredCount(prog && prog.answers);
    const result = loadResult(i);
    let status = '';
    if (done > 0) {
      status = `<span class="test-card-status is-progress">In progress · ${done}/${t.questions}</span>`;
    } else if (result) {
      status = `<span class="test-card-status">${result.schemaVersion === 2 ? (result.pct == null ? 'Written practice saved' : 'Last objective accuracy ' + result.pct + '%') : 'Earlier result · old scoring method'}</span>`;
    }
    return `
    <div class="test-card" tabindex="0" role="button" onclick="startTest(${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();startTest(${i})}">
      <div class="test-card-num">Test ${pad2(i + 1)}</div>
      <div class="test-card-title">${escHtml(t.title)}</div>
      <div class="test-card-meta">
        <span>${t.questions} questions</span>
        <span>Self-paced · older format</span>
      </div>
      ${status}
      ${result && result.schemaVersion === 2 && result.answers ? `<button class="link-btn saved-attempt" type="button" onclick="event.stopPropagation();reviewSavedAttempt(${i})" onkeydown="event.stopPropagation()">Review saved answers →</button>` : ''}
    </div>`;
  }).join('');
}

// === SCREENS ===
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function goHome() {
  stopTimer();
  $('audio-el').pause();
  saveProgress();
  currentTest = null;
  currentTestIndex = null;
  currentQ = 0;
  userAnswers = {};
  flags = {};
  reviewMode = false;
  reviewList = null;
  closeNavigator();
  renderTestGrid();
  showScreen('home-screen');
}

// === QUIZ LIFECYCLE ===
async function startTest(index) {
  const meta = allTests[index];
  if (!meta) return;
  try {
    const res = await fetch(BASE + meta.file);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    currentTest = await res.json();
    currentTestIndex = index;
  } catch (e) {
    alert('Failed to load test data.');
    return;
  }
  const saved = loadProgress(index);
  if (saved && answeredCount(saved.answers) > 0) {
    showResumePrompt(index, saved);
  } else {
    beginAttempt(null);
  }
}

function beginAttempt(saved) {
  reviewMode = false;
  retrying = false;
  retryFeedback = null;
  reviewList = null;
  if (saved) {
    userAnswers = HSK4Scoring.normalizeAnswers(currentTest.questions, saved.answers);
    flags = saved.flags || {};
    currentQ = Number.isInteger(saved.currentQ) && saved.currentQ >= 0 && saved.currentQ < currentTest.questions.length ? saved.currentQ : 0;
    elapsed = Number.isFinite(saved.elapsed) && saved.elapsed >= 0 ? saved.elapsed : 0;
  } else {
    userAnswers = {};
    flags = {};
    currentQ = 0;
    elapsed = 0;
    if (currentTestIndex != null) clearProgress(currentTestIndex);
  }
  $('review-banner').hidden = true;
  $('kbd-hint').style.display = '';
  closeNavigator();
  showScreen('quiz-screen');
  startTimer();
  saveProgress();
  renderQuestion();
}

// Lightweight resume dialog, built on the fly so the static markup stays clean.
function showResumePrompt(index, saved) {
  const total = currentTest.questions.length;
  const done = answeredCount(HSK4Scoring.normalizeAnswers(currentTest.questions, saved.answers));
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="resume-title">
      <h3 id="resume-title">Resume Test ${pad2(index + 1)}?</h3>
      <p>You have <strong>${done}/${total}</strong> saved responses (${fmtTime(saved.elapsed || 0)} on the clock). Pick up where you left off, or start over?${saved.schemaVersion !== 2 ? " Older saved writing choices are not written drafts; please answer those questions again." : ""}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-act="restart">Start over</button>
        <button class="btn btn-primary" data-act="resume">Resume</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = (resume) => { overlay.remove(); beginAttempt(resume ? saved : null); };
  overlay.addEventListener('click', (e) => {
    const act = e.target.getAttribute && e.target.getAttribute('data-act');
    if (act === 'resume') close(true);
    else if (act === 'restart') close(false);
  });
  const resumeBtn = overlay.querySelector('[data-act="resume"]');
  if (resumeBtn) resumeBtn.focus();
}

// Questions to walk for prev/next (all, or the wrong-only subset in review).
function navList() {
  if (reviewMode && reviewList) return reviewList;
  return currentTest.questions.map((_, i) => i);
}

function renderQuestion() {
  const q = currentTest.questions[currentQ];
  const list = navList();
  const pos = list.indexOf(currentQ);

  $('quiz-title').textContent = currentTest.title;
  $('progress-fill').style.width = ((pos + 1) / list.length * 100) + '%';
  $('progress-text').textContent = `${pos + 1} / ${list.length}`;
  $('question-number').textContent = `Question ${q.number}`;

  // Type badge
  const badge = $('question-type-badge');
  const [label, cls] = HSK4Scoring.isWriting(q) ? [HSK4Scoring.isOrdering(q) ? 'Writing · 排词成句' : 'Writing · 造句', 'badge-writing'] : TYPE_MAP[q.type] || ['Question', 'badge-reading'];
  badge.textContent = label;
  badge.className = 'question-type-badge ' + cls;

  // Flag button (hidden in review)
  const flagBtn = $('flag-btn');
  const flagged = !!flags[currentQ];
  flagBtn.style.display = reviewMode ? 'none' : '';
  flagBtn.classList.toggle('is-flagged', flagged);
  flagBtn.setAttribute('aria-pressed', flagged ? 'true' : 'false');
  $('flag-label').textContent = flagged ? 'Flagged' : 'Flag for review';

  // Audio
  const ac = $('audio-container');
  const ae = $('audio-el');
  const an = $('audio-note');
  const isListening = q.type && q.type.startsWith('listening');
  if (q.audio) {
    // Per-question clip (Mandarin Zone tests).
    ac.style.display = 'block';
    if (ae.getAttribute('src') !== q.audio) ae.src = q.audio;
    an.textContent = 'Listen before answering. During review, replay the recording and compare it with the available transcript.';
  } else if (currentTest.listening_audio && isListening) {
    // Official papers: one continuous track for the whole listening section.
    // Only (re)set the src when it changes so navigating between listening
    // questions doesn't restart the audio.
    ac.style.display = 'block';
    // listening_audio is a root-relative path (e.g. /test/13/listening.mp3).
    if (ae.getAttribute('src') !== currentTest.listening_audio) ae.src = currentTest.listening_audio;
    an.textContent = 'Full-section recording · your playback position is kept as you move between listening questions.';
  } else {
    ac.style.display = 'none';
    if (ae.getAttribute('src')) { ae.pause(); ae.removeAttribute('src'); }
  }

  // Text
  $('question-text').textContent = q.text || '';

  // Image (看图造句 writing prompts)
  const qi = $('question-image');
  if (q.image) {
    qi.hidden = false;
    qi.innerHTML = '<img src="' + escHtml(q.image) + '" alt="HSK 4 看图造句 writing prompt" loading="lazy">';
  } else {
    qi.hidden = true;
    qi.innerHTML = '';
  }

  const writing = HSK4Scoring.isWriting(q);
  const missingPicture = writing && /看图/.test(q.text || '') && !q.image;
  const panel = $('writing-answer-panel');
  panel.hidden = !writing;
  $('options-list').hidden = writing;
  panel.innerHTML = '';
  const selected = retrying ? undefined : retryFeedback && retryFeedback.index === currentQ ? retryFeedback.answer : userAnswers[currentQ];
  if (writing) {
    $('options-list').innerHTML = '';
    panel.innerHTML = `<p>${missingPicture ? 'The source picture is unavailable for this prompt. Use it as word-only practice; picture fit cannot be checked.' : HSK4Scoring.isOrdering(q) ? 'Arrange the given words into a complete sentence.' : 'Write your own sentence using the prompt.'} Written answers are saved as drafts and are not automatically graded.</p>
      <label for="written-answer">${reviewMode ? 'Your saved answer / 你的作答' : 'Your answer / 请独立作答'}</label>
      <textarea id="written-answer" class="chinese" rows="4" ${reviewMode ? 'readonly' : ''}></textarea>
      <p id="writing-save-status" role="status"></p>`;
    $('written-answer').value = typeof userAnswers[currentQ] === 'string' ? userAnswers[currentQ] : '';
    $('written-answer').addEventListener('input', saveWritingDraft);
    if (!reviewMode) $('writing-save-status').textContent = progressSaved ? 'Saved in this browser as you type.' : 'This browser cannot save progress. Copy your answer before leaving.';
  } else {
    $('options-list').innerHTML = q.options.map((opt, i) => {
      let oc = 'option-btn';
      if (reviewMode && !retrying) {
        oc += ' disabled';
        if (i === q.correct_answer_index) oc += ' correct';
        else if (i === selected) oc += ' wrong';
      } else if (i === selected) oc += ' selected';
      return `<button class="${oc}" onclick="selectOption(${i})"><span class="marker">${MARKERS[i] || i + 1}</span><span class="chinese">${escHtml(opt)}</span></button>`;
    }).join('');
  }

  const exBox = $('explanation-box');
  if (reviewMode && !retrying) {
    const ua = userAnswers[currentQ];
    const hasAnswer = HSK4Scoring.hasAnswer(q, ua);
    let you = writing
      ? `<p>${hasAnswer ? 'Compare your sentence with the reference. Other correct answers are possible.' : 'No written answer was saved for this question.'}</p>`
      : !hasAnswer ? '<div class="ex-you ex-skip">You skipped this question.</div>'
      : ua === q.correct_answer_index ? '<div class="ex-you ex-correct">Your original answer was correct.</div>'
      : `<div class="ex-you ex-wrong">Your original answer: ${MARKERS[ua] || ua + 1}. ${escHtml(q.options[ua])}</div>`;
    if (retryFeedback && retryFeedback.index === currentQ) you += `<p role="status">${retryFeedback.answer === q.correct_answer_index ? 'Your retry is correct.' : 'Not yet. Compare your retry with the answer and explanation.'} Your original result is unchanged.</p>`;
    const resource = HSK4Scoring.resource(q);
    const learningExplanation = HSK4Explanations.render(q);
    exBox.innerHTML = `<div class="ex-answer">${writing ? 'Reference sentence / 参考答案' : 'Correct answer'}: <strong class="chinese">${escHtml(q.options[q.correct_answer_index])}</strong></div>` + you +
      (q.note ? `<div class="ex-explain">${escHtml(q.note)}</div>` : '') +
      (learningExplanation || (q.explanation && !missingPicture ? `<div class="ex-explain"><span class="ex-explain-label">解析 · Explanation</span>${escHtml(q.explanation)}</div>` : '<p class="ex-explain">Detailed study notes are not yet available for this question. Use the answer reference and the transcript, when provided, to review. / 本题暂未提供详细解析，可先对照答案及已有原文复盘。</p>')) +
      (q.transcript ? `<div class="ex-explain"><span class="ex-explain-label">听力原文 · Transcript</span><span class="chinese" style="white-space:pre-wrap">${escHtml(q.transcript)}</span></div>` : '') +
      (writing ? '<p>Self-check: use the required words, complete the thought, check word order and match the picture when available. A different sentence is not automatically wrong.</p>' : '') +
      `<div class="review-learning-actions">${!writing ? '<button class="btn btn-secondary" type="button" onclick="retryQuestion()">Try again without the answer</button>' : ''}<a href="${resource.href}" target="_blank" rel="noopener">${resource.label} ↗</a></div>`;
    exBox.hidden = false;
  } else {
    exBox.hidden = true;
    exBox.innerHTML = '';
  }

  // Nav buttons
  $('btn-prev').style.display = pos > 0 ? '' : 'none';
  const nextBtn = $('btn-next');
  nextBtn.textContent = (pos >= list.length - 1)
    ? (reviewMode ? 'Back to results' : 'Finish test')
    : 'Next →';

  renderNavigator();
  updateNavStats();
  saveProgress();
}

function saveWritingDraft() {
  if (reviewMode) return;
  const value = $('written-answer').value;
  if (value.trim()) userAnswers[currentQ] = value; else delete userAnswers[currentQ];
  saveProgress();
  $('writing-save-status').textContent = progressSaved ? 'Draft saved in this browser.' : 'This browser cannot save progress. Copy your answer before leaving.';
  renderNavigator();
  updateNavStats();
}
function selectOption(i) {
  const q = currentTest.questions[currentQ];
  if (HSK4Scoring.isWriting(q) || !Number.isInteger(i) || i < 0 || i >= q.options.length) return;
  if (reviewMode) {
    if (!retrying) return;
    retryFeedback = { index: currentQ, answer: i };
    retrying = false;
  } else userAnswers[currentQ] = i;
  saveProgress();
  renderQuestion();
}
function retryQuestion() {
  retrying = true;
  retryFeedback = null;
  renderQuestion();
  $('options-list').querySelector('button').focus({ preventScroll: true });
}
function clearRetry() { retrying = false; retryFeedback = null; }

function toggleFlag() {
  if (reviewMode) return;
  if (flags[currentQ]) delete flags[currentQ]; else flags[currentQ] = true;
  saveProgress();
  renderQuestion();
}

function nextQuestion() {
  clearRetry();
  const list = navList();
  const pos = list.indexOf(currentQ);
  if (pos < list.length - 1) {
    currentQ = list[pos + 1];
    renderQuestion();
    window.scrollTo(0, 0);
  } else if (reviewMode) {
    showScreen('results-screen');
  } else {
    finishTest();
  }
}

function prevQuestion() {
  clearRetry();
  const list = navList();
  const pos = list.indexOf(currentQ);
  if (pos > 0) {
    currentQ = list[pos - 1];
    renderQuestion();
    window.scrollTo(0, 0);
  }
}

function gotoQuestion(i) {
  clearRetry();
  const leaveSubset = reviewMode && reviewList && !reviewList.includes(i);
  if (leaveSubset) reviewList = null;
  currentQ = i;
  closeNavigator();
  if (leaveSubset) enterReview();
  else renderQuestion();
  window.scrollTo(0, 0);
}

function finishTest() {
  const total = currentTest.questions.length;
  const unanswered = total - answeredCount(userAnswers);
  if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Finish and review your answers anyway?`)) return;
  showResults();
}

// === QUESTION NAVIGATOR ===
function toggleNavigator() {
  const panel = $('qnav-panel');
  const open = panel.hidden;
  panel.hidden = !open;
  $('qnav-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) renderNavigator();
}
function closeNavigator() {
  const panel = $('qnav-panel');
  if (!panel) return;
  panel.hidden = true;
  $('qnav-toggle').setAttribute('aria-expanded', 'false');
}
function renderNavigator() {
  const grid = $('qnav-grid');
  if (!grid || (grid.parentElement && grid.parentElement.hidden)) return;
  grid.innerHTML = currentTest.questions.map((q, i) => {
    let c = 'qnav-cell';
    if (i === currentQ) c += ' is-current';
    if (reviewMode) {
      const ua = userAnswers[i];
      if (HSK4Scoring.isWriting(q)) c += HSK4Scoring.hasAnswer(q, ua) ? ' is-answered' : ' is-skip';
      else if (ua === undefined) c += ' is-skip';
      else if (ua === q.correct_answer_index) c += ' is-correct';
      else c += ' is-wrong';
    } else {
      if (userAnswers[i] !== undefined) c += ' is-answered';
      if (flags[i]) c += ' is-flagged';
    }
    return `<button class="${c}" type="button" onclick="gotoQuestion(${i})" title="Question ${q.number}">${i + 1}</button>`;
  }).join('');
}
function updateNavStats() {
  const el = $('qnav-stats');
  if (!el) return;
  if (reviewMode) { el.textContent = ''; return; }
  const total = currentTest.questions.length;
  const done = answeredCount(userAnswers);
  const flagged = Object.keys(flags).length;
  el.textContent = `${done}/${total} answered` + (flagged ? ` · ${flagged} flagged` : '');
}

// === TIMER (counts up; tap to pause) ===
function startTimer() {
  stopTimer();
  timerPaused = false;
  renderTimer();
  updateTimerUI();
  timerId = setInterval(() => {
    if (timerPaused) return;
    elapsed++;
    renderTimer();
    if (elapsed % 10 === 0) saveProgress();
  }, 1000);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
function toggleTimer() { timerPaused = !timerPaused; updateTimerUI(); }
function renderTimer() { const el = $('timer-text'); if (el) el.textContent = fmtTime(elapsed); }
function updateTimerUI() {
  const t = $('quiz-timer');
  if (t) { t.classList.toggle('is-paused', timerPaused); t.title = timerPaused ? 'Paused — tap to resume' : 'Tap to pause / resume'; }
}

// === RESULTS ===
function showResults(persist = true) {
  stopTimer();
  $('audio-el').pause();
  clearRetry();
  lastResult = { ...HSK4Scoring.summarize(currentTest.questions, userAnswers), elapsed };
  const { correct, scoredTotal, pct, wrong, unanswered, sections, writingTotal, writingAnswered } = lastResult;
  let resultSaved = true;
  if (persist && currentTestIndex != null) {
    resultSaved = saveResult(currentTestIndex, { ...lastResult, schemaVersion: 2, answers: { ...userAnswers }, ts: Date.now() });
    if (resultSaved) clearProgress(currentTestIndex);
  }
  reviewMode = true;
  const circle = $('score-circle');
  circle.className = 'score-circle';
  $('score-num').textContent = pct == null ? '—' : pct + '%';
  $('results-msg').textContent = 'Review, understand, then practise again / 复盘与巩固';
  $('results-detail').textContent = `${correct} of ${scoredTotal} objective questions correct. Skipped objective questions are included in this percentage.`;
  $('writing-result').textContent = `${writingAnswered} of ${writingTotal} written answers ${resultSaved ? 'saved' : 'available in this session'} for self-review. They are not counted as correct or wrong.${resultSaved ? '' : ' This browser could not save the completed attempt. Copy your written answers before leaving; any earlier saved progress has been kept.'}`;
  $('res-correct').textContent = correct;
  $('res-wrong').textContent = wrong;
  $('res-unanswered').textContent = unanswered;
  $('res-time').textContent = fmtTime(elapsed);
  renderSectionScores(sections);
  renderNextSteps(lastResult);
  $('btn-review-wrong').style.display = lastResult.wrongIdx.length ? '' : 'none';
  $('btn-review-writing').style.display = writingTotal ? '' : 'none';
  closeNavigator();
  showScreen('results-screen');
}

function renderSectionScores(sections) {
  const wrap = $('section-scores');
  const order = ['Listening', 'Reading', 'Writing'];
  const present = order.filter(s => sections[s] && sections[s].total > 0);
  if (present.length <= 1) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `<div class="section-scores-title">How you did by section</div>` + present.map(s => {
    const { correct, total, answered } = sections[s];
    if (s === 'Writing') return `<div class="section-score-row"><div class="section-score-head"><span>Writing 书写 · self-review</span><span>${answered}/${total} drafted</span></div></div>`;
    const p = Math.round(correct / total * 100);
    const meta = SECTION_META[s];
    return `
      <div class="section-score-row">
        <div class="section-score-head">
          <span class="section-score-name">${s} <span class="section-score-zh">${meta.zh}</span></span>
          <span class="section-score-val">${correct}/${total} · ${p}%</span>
        </div>
        <div class="section-score-bar"><div class="section-score-fill ${meta.cls}" style="width:${p}%"></div></div>
      </div>`;
  }).join('');
}

function renderNextSteps(result) {
  const missedTypes = {};
  result.wrongIdx.forEach(i => {
    const q = currentTest.questions[i];
    if (HSK4Scoring.hasAnswer(q, userAnswers[i])) (missedTypes[q.type] ||= []).push(q);
  });
  const cards = Object.values(missedTypes).sort((a, b) => b.length - a.length).slice(0, 2).map(questions => {
    const resource = HSK4Scoring.resource(questions[0]);
    return `<a class="next-step-card" href="${resource.href}" target="_blank" rel="noopener"><div class="next-step-tag">${questions.length} missed in this question type</div><h4>${resource.label}</h4><p>Read the explanation, practise the skill, then return here to retry your question.</p><span class="next-step-cta">Open practice in a new tab ↗</span></a>`;
  });
  if (!cards.length) cards.push('<div class="next-step-card"><h4>Choose what to review</h4><p>Use the review buttons to revisit skipped questions and written answers. Skipped questions alone do not identify a weak skill.</p></div>');
  if (result.writingTotal) cards.push('<a class="next-step-card" href="/writing/" target="_blank" rel="noopener"><div class="next-step-tag">Writing practice</div><h4>Build a sentence of your own</h4><p>Practise with picture prompts, saved drafts and a self-review checklist.</p><span class="next-step-cta">Open writing practice ↗</span></a>');
  $('next-steps').innerHTML = `<h3 class="next-steps-title">Practise what you missed</h3><div class="next-steps-cards">${cards.join('')}</div>`;
}

async function reviewSavedAttempt(index) {
  const saved = loadResult(index);
  if (!saved || saved.schemaVersion !== 2 || !saved.answers) return;
  try {
    const res = await fetch(BASE + allTests[index].file);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    currentTest = await res.json();
    currentTestIndex = index;
    userAnswers = HSK4Scoring.normalizeAnswers(currentTest.questions, saved.answers);
    flags = {};
    elapsed = saved.elapsed || 0;
    showResults(false);
  } catch (e) { alert('The saved attempt could not be opened. Please try again.'); }
}
function reviewWriting() {
  if (!lastResult || !lastResult.writingIdx.length) return;
  reviewMode = true;
  reviewList = lastResult.writingIdx.slice();
  currentQ = reviewList[0];
  enterReview();
}

// === REVIEW ===
function enterReview() {
  clearRetry();
  stopTimer();
  $('kbd-hint').style.display = 'none';
  const banner = $('review-banner');
  banner.hidden = false;
  banner.innerHTML = (reviewMode && reviewList)
    ? `Reviewing the <strong>${reviewList.length}</strong> selected question${reviewList.length > 1 ? 's' : ''} — compare your responses with the answers and available explanations. <button class="link-btn" type="button" onclick="showScreen('results-screen')">← Back to results</button>`
    : `Reviewing all answers — written responses use reference sentences, not automatic grades. <button class="link-btn" type="button" onclick="showScreen('results-screen')">← Back to results</button>`;
  showScreen('quiz-screen');
  renderQuestion();
}
function reviewAnswers() {
  reviewMode = true;
  reviewList = null;
  currentQ = 0;
  enterReview();
}
function reviewWrongOnly() {
  if (!lastResult || !lastResult.wrongIdx.length) return;
  reviewMode = true;
  reviewList = lastResult.wrongIdx.slice();
  currentQ = reviewList[0];
  enterReview();
}
function retakeTest() { beginAttempt(null); }

// === KEYBOARD SHORTCUTS (quiz screen only) ===
document.addEventListener('keydown', (e) => {
  if (!$('quiz-screen').classList.contains('active')) return;
  if (document.querySelector('.modal-overlay')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

  const key = e.key.toLowerCase();
  if (key === 'arrowright') { e.preventDefault(); nextQuestion(); return; }
  if (key === 'arrowleft') { e.preventDefault(); prevQuestion(); return; }
  if (reviewMode && !retrying) return;
  if (key === 'f') { e.preventDefault(); toggleFlag(); return; }
  let idx = -1;
  if (key >= '1' && key <= '9') idx = parseInt(key, 10) - 1;
  else if (key >= 'a' && key <= 'e') idx = key.charCodeAt(0) - 97;
  if (idx >= 0 && idx < currentTest.questions[currentQ].options.length) {
    e.preventDefault();
    selectOption(idx);
  }
});

// Persist progress if the user closes the tab mid-test.
window.addEventListener('beforeunload', saveProgress);

// === SCROLL-TO-TOP ===
(function () {
  const btn = $('to-top');
  if (!btn) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onScroll = () => { btn.hidden = (window.pageYOffset || document.documentElement.scrollTop) < 500; };
  window.addEventListener('scroll', onScroll, { passive: true });
  btn.addEventListener('click', () => window.scrollTo(reduce ? { top: 0 } : { top: 0, behavior: 'smooth' }));
  onScroll();
})();

// === INIT ===
loadIndex();
