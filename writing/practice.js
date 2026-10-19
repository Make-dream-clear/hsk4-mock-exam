/* Local study drafts and self-review; no automatic grammar or exam scoring. */
(function () {
  'use strict';
  const learning = new Map(), startedDrafts = new Set(), selfReviewed = new Set();
  function track(mode, id) {
    const key=mode+'-'+id;
    if(!learning.has(key))learning.set(key,window.HSK4Learning?.create('writing',mode,key,1));
    return learning.get(key);
  }
  function startDraft(mode,id,value) {
    const key=mode+'-'+id;
    if(!value.trim()||startedDrafts.has(key))return;
    startedDrafts.add(key);track(mode,id)?.answer(id,'draft_started');
  }
  const KEY = 'hsk4_writing_drafts_v1';
  let state = { mode: 'picture', positions: {}, drafts: {}, reviewed: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      if (['picture', 'word'].includes(saved.mode)) state.mode = saved.mode;
      for (const name of ['positions', 'drafts']) {
        if (saved[name] && typeof saved[name] === 'object' && !Array.isArray(saved[name])) state[name] = saved[name];
      }
      if (Array.isArray(saved.reviewed)) state.reviewed = saved.reviewed.filter(x => typeof x === 'string');
    }
  } catch (_) { /* An unreadable saved value must not prevent practice. */ }
  const byId = id => document.getElementById(id);
  const draft = id => typeof state.drafts[id] === 'string' ? state.drafts[id] : '';
  function save(status) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      status.textContent = 'Drafts saved in this browser. Use Previous to return to an earlier answer.';
    } catch (_) {
      status.textContent = 'This browser cannot save drafts. Copy your answer before leaving; answers remain available while this page stays open.';
    }
  }
  function position(key, length) {
    const n = state.positions[key];
    return Number.isInteger(n) && n >= 0 && n < length ? n : 0;
  }
  function resetChecks(container) {
    container.querySelectorAll('.self-check input').forEach(input => { input.checked = false; });
  }

  const bank = JSON.parse(byId('kt-bank').textContent);
  const card = byId('kt-trainer');
  const input = byId('kt-input');
  const status = byId('kt-save');
  const feedback = byId('kt-feedback');
  const mode = byId('kt-mode');
  let items, current;
  function saveSentence() {
    state.drafts[current.id] = input.value;
    save(status);
  }
  function syncReviewed() {
    byId('kt-done').textContent = items.filter(item => state.reviewed.includes(item.id)).length;
  }
  function renderSentence() {
    items = bank.filter(item => item.kind === state.mode);
    const pos = position(state.mode, items.length);
    current = items[pos];
    mode.value = state.mode;
    byId('kt-pos').textContent = `${pos + 1} / ${items.length}`;
    byId('kt-word').textContent = current.w;
    byId('kt-py').textContent = current.py;
    byId('kt-mean').textContent = current.m ? ' · ' + current.m : '';
    const image = byId('kt-picture');
    image.hidden = !current.image;
    byId('kt-picture-error').hidden = true;
    byId('kt-picture-description').hidden = !current.image;
    byId('kt-picture-description').open = false;
    byId('kt-picture-check').hidden = !current.image;
    if (current.image) { image.alt = current.alt; image.src = current.image; }
    byId('kt-alt').textContent = current.alt || '';
    const source = byId('kt-source');
    source.replaceChildren();
    if (current.href) {
      const link = document.createElement('a');
      link.href = current.href;
      link.textContent = current.source;
      source.append(link, document.createTextNode(' · Picture-sentence skill practice'));
    } else source.textContent = 'Word-only practice · This prompt has no picture.';
    input.value = draft(current.id);
    byId('kt-models').classList.remove('show');
    resetChecks(card);
    feedback.textContent = state.reviewed.includes(current.id) ? 'You marked this answer as reviewed. You can keep revising it.' : '';
    syncReviewed();
    save(status);
  }
  const sentenceTrackingId=()=>'sentence-'+(bank.indexOf(current)+1);
  input.addEventListener('input', () => {
    startDraft(state.mode,sentenceTrackingId(),input.value);
    state.reviewed = state.reviewed.filter(id => id !== current.id);
    resetChecks(card);
    syncReviewed();
    feedback.textContent = '';
    saveSentence();
  });
  mode.addEventListener('change', () => {
    saveSentence();
    state.mode = mode.value;
    renderSentence();
  });
  function moveSentence(delta) {
    saveSentence();
    state.positions[state.mode] = (position(state.mode, items.length) + delta + items.length) % items.length;
    renderSentence();
    input.focus({ preventScroll: true });
  }
  byId('kt-prev').addEventListener('click', () => moveSentence(-1));
  byId('kt-next').addEventListener('click', () => moveSentence(1));
  byId('kt-picture').addEventListener('error', () => {
    if (!current.image) return;
    byId('kt-picture-error').hidden = false;
    byId('kt-picture-description').open = true;
  });
  byId('kt-check').addEventListener('click', () => {
    saveSentence();
    track(state.mode,sentenceTrackingId())?.explanation(sentenceTrackingId(),'requested');
    byId('kt-model').textContent = current.s;
    byId('kt-models').classList.add('show');
    const text = input.value.trim();
    feedback.textContent = !text
      ? 'Read the example, then try your own sentence. Viewing an answer does not mark this prompt as reviewed.'
      : !text.includes(current.w)
        ? `Your sentence does not yet contain “${current.w}”. Try including it naturally, then review the checklist.`
        : 'The given word is present. Check its meaning, word order and the picture yourself; this is not an automatic correctness check.';
    if (current.hint) feedback.textContent += ' Hint: ' + current.hint;
  });
  byId('kt-reviewed').addEventListener('click', () => {
    const checks = Array.from(card.querySelectorAll('.self-check input')).filter(el => !el.closest('label').hidden);
    if (!input.value.trim() || !input.value.includes(current.w)) {
      feedback.textContent = 'Write a sentence using the given word before marking it as reviewed.';
      input.focus();
      return;
    }
    if (!byId('kt-models').classList.contains('show') || checks.some(el => !el.checked)) {
      feedback.textContent = 'Compare with the model and complete the self-check first. Your sentence can differ from the model.';
      return;
    }
    const trackingId=sentenceTrackingId(), trackingKey=state.mode+'-'+trackingId;
    if(!selfReviewed.has(trackingKey)){
      selfReviewed.add(trackingKey);
      track(state.mode,trackingId)?.start(draft(current.id)?'resume':'first');
      track(state.mode,trackingId)?.event('learning_answer',{question_id:trackingId,result:'self_reviewed',attempt_type:'review'});
      track(state.mode,trackingId)?.complete({answered_count:1});
    }
    if (!state.reviewed.includes(current.id)) state.reviewed.push(current.id);
    saveSentence();
    syncReviewed();
    feedback.textContent = 'Saved as self-reviewed, not teacher-graded. Try another prompt or revise this answer.';
  });
  renderSentence();

  const prompts = window.HSK4_ESSAY_PROMPTS;
  const essayCard = byId('essay-trainer');
  const essayInput = byId('essay-input');
  const essayStatus = byId('essay-save');
  let essay;
  const essayId = () => 'essay-' + essay.t;
  const countCharacters = value => Array.from(value).filter(char => /\p{Script=Han}/u.test(char)).length;
  function updateCount() {
    const n = countCharacters(essayInput.value);
    byId('essay-counter').querySelector('.cnum').textContent = n;
    byId('essay-counter').classList.toggle('ok', n >= 80);
  }
  function saveEssay() {
    state.drafts[essayId()] = essayInput.value;
    save(essayStatus);
  }
  function renderEssay() {
    essay = prompts[position('essay', prompts.length)];
    byId('essay-title').textContent = essay.t;
    byId('essay-brief').textContent = essay.b;
    const words = byId('essay-kw');
    words.replaceChildren();
    essay.kw.forEach(word => {
      const span = document.createElement('span');
      span.className = 'kw chinese';
      span.textContent = word;
      words.append(span);
    });
    essayInput.value = draft(essayId());
    updateCount();
    resetChecks(essayCard);
    byId('essay-model-wrap').classList.remove('show');
    byId('essay-feedback').textContent = '';
    save(essayStatus);
  }
  const essayTrackingId=()=>'essay-'+(prompts.indexOf(essay)+1);
  essayInput.addEventListener('input', () => {
    startDraft('essay',essayTrackingId(),essayInput.value); updateCount(); saveEssay(); });
  byId('essay-show').addEventListener('click', () => {
    track('essay',essayTrackingId())?.explanation(essayTrackingId(),'requested');
    saveEssay();
    byId('essay-model').textContent = essay.m;
    byId('essay-model-wrap').classList.add('show');
    const n = countCharacters(essayInput.value);
    byId('essay-feedback').textContent = n < 80
      ? `You have ${n} Chinese characters. Add relevant details about who, when, where or why to reach 80; then review the topic and structure.`
      : 'You have reached the practice length target. Now check the topic, connections between sentences and grammar. Length alone does not establish correctness.';
  });
  function moveEssay(delta) {
    saveEssay();
    state.positions.essay = (position('essay', prompts.length) + delta + prompts.length) % prompts.length;
    renderEssay();
    essayInput.focus({ preventScroll: true });
  }
  byId('essay-prev').addEventListener('click', () => moveEssay(-1));
  byId('essay-next').addEventListener('click', () => moveEssay(1));
  renderEssay();
})();
