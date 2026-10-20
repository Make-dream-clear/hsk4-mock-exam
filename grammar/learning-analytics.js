/* Observe existing grammar controls without changing their scoring or UI. */
(function () {
  'use strict';
  function init() {
    const analytics = window.HSK4Learning;
    if (!analytics) return;
    const topic = location.pathname.split('/').filter(Boolean).slice(1).join('-') || 'overview';
    const sessions = new Map();
    const revision = /\/grammar\/(?:patterns\/[^/]+|passive)\//.test(location.pathname) ? '-r20261020' : '';
    function session(mode, id, count) {
      const key = mode + '-' + id;
      if (!sessions.has(key)) sessions.set(key, analytics.create('grammar', mode, topic + '-' + id + revision, count));
      return sessions.get(key);
    }
    function wrap(name, observe) {
      const original = window[name];
      if (typeof original !== 'function') return;
      window[name] = function (...args) {
        let after;
        try { after = observe(...args); } catch (_) {}
        const result = original.apply(this, args);
        try { if (after) after(); } catch (_) {}
        return result;
      };
    }
    const items = Array.from(document.querySelectorAll('.quiz-item[data-quiz]'));
    const seen = new Set();
    wrap('answerQuiz', (button, correct) => {
      if (button.classList.contains('disabled')) return;
      const item = button.closest('.quiz-item'), name = item?.dataset.quiz;
      const group = items.filter(q => q.dataset.quiz === name);
      if (!item || !group.length) return;
      return () => {
        if (!button.classList.contains('disabled')) return;
        const s = session('quiz', name, group.length), id = 'q-' + (items.indexOf(item) + 1);
        s.answer(id, correct ? 'matched' : 'needs_review', {topic_id: topic});
        seen.add(item);
        if (item.querySelector('.quiz-explanation')) s.explanation(id);
        if (group.every(q => seen.has(q))) s.complete({answered_count: group.length});
      };
    });
    wrap('retryQuizItem', item => {
      if (!item.querySelector('.quiz-opt.disabled')) return;
      return () => session('quiz', item.dataset.quiz).retry('q-' + (items.indexOf(item) + 1));
    });
    const cardAnswers = new Set();
    wrap('ecJudge', saysCorrect => {
      const index = window.ecIdx, cards = window.EC_CARDS;
      if (window.ecJudged || !cards?.[index]) return;
      return () => {
        if (!window.ecJudged) return;
        const s = session('error_cards', 'error-cards', cards.length), id = 'q-' + (index + 1);
        s.answer(id, saysCorrect === cards[index].correct ? 'matched' : 'needs_review', {topic_id: topic});
        s.explanation(id);
        cardAnswers.add(index);
        if (cardAnswers.size === cards.length) s.complete();
      };
    });
    wrap('ddCheck', () => {
      const index = window.ddIdx, count = window.DD_SENTENCES?.length;
      if (window.ddChecked || !count || index >= count) return;
      return () => {
        if (!window.ddChecked) return;
        const s = session('order', 'tiles', count), id = 'q-' + (index + 1);
        s.answer(id, document.getElementById('dd-feedback')?.classList.contains('pass') ? 'matched' : 'needs_review', {topic_id: topic});
        s.explanation(id);
        // Completion means all items have actually been checked, not merely skipped.
        tileAnswers.add(index);
        if (tileAnswers.size === count) s.complete();
      };
    });
    const tileAnswers = new Set();
    wrap('ddReset', () => () => session('order', 'tiles', window.DD_SENTENCES?.length).retry('q-' + (window.ddIdx + 1)));
    const patternItems = Array.from(document.querySelectorAll('.q-item'));
    const patternSeen = new Set();
    wrap('answer', (button, correct) => {
      const item = button.closest('.q-item');
      if (!item || item.dataset.answered === 'true') return;
      return () => {
        if (item.dataset.answered !== 'true') return;
        const s = session('quiz','pattern-quiz',patternItems.length), id = 'q-'+(patternItems.indexOf(item)+1);
        s.answer(id,correct?'matched':'needs_review',{topic_id:topic}); s.explanation(id);
        patternSeen.add(item);
        if(patternSeen.size===patternItems.length)s.complete();
      };
    });
    wrap('retryPattern', button => {
      const item = button.closest('.q-item');
      if (!item || item.dataset.answered !== 'true') return;
      return () => session('quiz', 'pattern-quiz', patternItems.length).retry('q-' + (patternItems.indexOf(item) + 1));
    });
    const fills = Array.from(document.querySelectorAll('.fill-item')), fillSeen = new Set();
    wrap('checkFill', button => {
      const item = button.closest('.fill-item');
      if (!item || button.classList.contains('done')) return;
      return () => {
        if (!button.classList.contains('done')) return;
        fillSeen.add(item);
        const reviewed = item.dataset.reviewed === 'grammar-20261020';
        const result = reviewed && ['matched', 'needs_review'].includes(item.dataset.result) ? item.dataset.result : 'selected';
        const s = session('interactive', 'fill-check', fills.length), id = 'q-' + (fills.indexOf(item) + 1);
        s.answer(id, result, {topic_id: topic}); s.explanation(id);
        if (fillSeen.size === fills.length) s.complete();
      };
    });
    wrap('retryFill', button => {
      const item = button.closest('.fill-item');
      if (!item?.querySelector('.fill-check-btn.done')) return;
      return () => session('interactive', 'fill-check', fills.length).retry('q-' + (fills.indexOf(item) + 1));
    });
    const actions = {xrayCheck:'check', revCheck:'check', sortReset:'reset', genUpdate:'generate', toggleReview:'review'};
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (link) {
        const url = new URL(link.href, location.href);
        if (url.origin === location.origin && /^\/(grammar|writing|vocabulary|test)\//.test(url.pathname)) {
          const target = url.pathname.split('/').filter(Boolean).join('-');
          analytics.emit('learning_navigate', {learning_area:'grammar', practice_mode:'navigation', activity_id:topic, topic_id:target});
        }
      }
      const control = event.target.closest('[onclick]');
      const fn = control?.getAttribute('onclick')?.match(/^([a-zA-Z]+)\(/)?.[1];
      if (actions[fn]) session('interactive', 'tools').event('learning_interaction', {action:actions[fn], topic_id:topic});
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
