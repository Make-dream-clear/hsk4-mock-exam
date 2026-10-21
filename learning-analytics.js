/* Learning events use the existing GA4 tag. Never pass answers or search text. */
(function (root) {
  'use strict';
  const events = new Set(['learning_start', 'learning_answer', 'learning_complete', 'learning_submit', 'learning_retry', 'learning_explanation', 'learning_navigate', 'learning_interaction']);
  const enums = {
    learning_area: ['exam', 'vocabulary', 'sentence_order', 'writing', 'grammar', 'topics'],
    practice_mode: ['paper', 'meaning', 'context', 'saved', 'flashcard', 'order', 'picture', 'word', 'essay', 'quiz', 'error_cards', 'interactive', 'navigation', 'retelling', 'explain', 'roleplay', 'describe'],
    attempt_type: ['first', 'retry', 'revision', 'resume', 'review'],
    result: ['matched', 'needs_review', 'selected', 'draft_started', 'self_reviewed', 'known', 'learning'],
    display_type: ['automatic', 'requested'],
    action: ['answer_reveal', 'check', 'next', 'reset', 'generate', 'review', 'navigate']
  };
  const ids = new Set(['activity_id', 'question_id', 'topic_id']);
  const numbers = new Set(['item_count', 'answered_count', 'correct_count', 'writing_count']);
  function clean(input) {
    const out = {tracking_version: 'learning_v1'};
    for (const [key, value] of Object.entries(input || {})) {
      if (enums[key]?.includes(value)) out[key] = value;
      else if (ids.has(key) && typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(value)) out[key] = value;
      else if (numbers.has(key) && Number.isInteger(value) && value >= 0 && value <= 10000) out[key] = value;
    }
    return out;
  }
  function emit(name, input) {
    try {
      // Local previews and automated browsers must not contaminate live reports.
      if (root.location?.hostname !== 'hsk4.mandarinzone.com' || root.navigator?.webdriver || root['ga-disable-G-L4CMDLM3DL']) return;
      if (!events.has(name) || typeof root.gtag !== 'function') return;
      const params = clean(input);
      if (!params.learning_area || !params.practice_mode || !params.activity_id) return;
      root.gtag('event', name, Object.assign(params, {send_to: 'G-L4CMDLM3DL'}));
    } catch (_) { /* Analytics must never interrupt practice, even if blocked. */ }
  }
  function create(area, mode, activity, count) {
    const base = {learning_area: area, practice_mode: mode, activity_id: activity, item_count: count};
    const answers = new Set(), shown = new Set();
    let started = false, completed = false;
    function event(name, extra) { emit(name, Object.assign({}, base, extra)); }
    return {
      start(type = 'first') {
        if (started) return;
        started = true; base.attempt_type = type; event('learning_start');
      },
      answer(id, result, extra = {}) {
        this.start();
        const type = answers.has(id) ? 'retry' : 'first';
        answers.add(id);
        event('learning_answer', Object.assign({question_id: id, result, attempt_type: type}, extra));
      },
      explanation(id, display = 'automatic') {
        const key = id + ':' + display;
        if (shown.has(key)) return;
        shown.add(key); event('learning_explanation', {question_id: id, display_type: display});
      },
      retry(id) { shown.delete(id + ':automatic'); event('learning_retry', {question_id: id, attempt_type: 'retry'}); },
      complete(extra = {}) {
        if (!started || completed) return;
        completed = true; event('learning_complete', Object.assign({answered_count: answers.size}, extra));
      },
      submit(extra = {}) { if (started) event('learning_submit', Object.assign({answered_count: answers.size}, extra)); },
      event
    };
  }
  root.HSK4Learning = {create, emit, clean};
  if (root.document) {
    const bindReferences = () => {
      const groups = [
        ['#context-library article details', 'vocabulary', 'context', 'context-reference'],
        ['#staticExercises .static-ex-answer', 'sentence_order', 'order', 'order-reference']
      ];
      groups.forEach(([selector, area, mode, activity]) => {
        const references = create(area, mode, activity);
        root.document.querySelectorAll(selector).forEach((details, index) => {
          details.addEventListener('toggle', () => {
            if (details.open) references.explanation('q-' + (index + 1), 'requested');
          });
        });
      });
    };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', bindReferences, {once:true});
    else bindReferences();
  }
  if (typeof module === 'object' && module.exports) module.exports = {create, emit, clean};
})(typeof window === 'object' ? window : globalThis);
