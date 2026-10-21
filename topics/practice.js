/* Self-review only: no recording, answer text, or automatic speaking score. */
(function () {
  'use strict';
  document.querySelectorAll('#guided-practice a[data-topic]').forEach(link => link.addEventListener('click', () => {
    window.HSK4Learning?.emit('learning_navigate', {learning_area:'topics', practice_mode:'navigation', activity_id:'topics-hub-r20261021', topic_id:link.dataset.topic});
  }));
  document.querySelectorAll('.topic-practice').forEach(section => {
    const find = s => section.querySelector(s);
    const source = find('.tp-source'), speaking = find('.tp-speaking'), review = find('.tp-review');
    const result = find('.tp-result'), finish = find('[data-finish]'), retry = find('[data-retry]');
    const timerButton = find('[data-action="timer"]'), clock = find('.tp-timer'), sourceButton = find('[data-action="source"]');
    const keepSource = section.dataset.keepSource === 'true';
    const fields = [...section.querySelectorAll('[data-check]')];
    const fallback = {start(){}, answer(){}, explanation(){}, complete(){}, retry(){}};
    const cases = [...section.querySelectorAll('.tp-case')];
    const caseLearning = cases.length ? window.HSK4Learning?.create('topics','quiz',`${section.dataset.topic}-cases-r20261021`,cases.length) : null;
    const answeredCases = new Set();
    cases.forEach(item => {
      const buttons = [...item.querySelectorAll('[data-case-choice]')];
      const feedback = item.querySelector('.tp-case-feedback');
      const explanation = item.querySelector('details');
      const retryCase = item.querySelector('[data-case-retry]');
      item.querySelector('[data-case-controls]').hidden = false;
      buttons.forEach(button => button.addEventListener('click', () => {
        if (item.dataset.done) return;
        item.dataset.done = 'true';
        const matched = button.dataset.caseChoice === item.dataset.answer;
        buttons.forEach(b => { b.disabled = true; });
        button.setAttribute('aria-pressed','true');
        feedback.textContent = (matched ? '符合题目重点 / Best fit. ' : '对照题目重点 / Compare the focus. ') + button.dataset.reason;
        feedback.hidden = false; explanation.open = true; retryCase.hidden = false;
        caseLearning?.answer(`case-${item.dataset.case}`,matched ? 'matched' : 'needs_review',{topic_id:section.dataset.topic});
        caseLearning?.explanation(`case-${item.dataset.case}`,'automatic');
        answeredCases.add(item.dataset.case);
        if (answeredCases.size === cases.length) caseLearning?.complete({answered_count:cases.length,topic_id:section.dataset.topic});
      }));
      retryCase.addEventListener('click', () => {
        delete item.dataset.done; explanation.open = false; feedback.hidden = true; retryCase.hidden = true;
        buttons.forEach(b => { b.disabled = false; b.removeAttribute('aria-pressed'); });
        caseLearning?.retry(`case-${item.dataset.case}`); buttons[0].focus();
      });
      explanation.addEventListener('click', event => {
        if (event.target.closest('summary') && !explanation.open) caseLearning?.explanation(`case-${item.dataset.case}`,'requested');
      });
    });
    let session, state = 'ready', attempt = 0, startTime = 0, elapsed = 0, interval;
    function newSession() {
      return window.HSK4Learning?.create('topics', section.dataset.mode, `${section.dataset.topic}-r20261021`, fields.length) || fallback;
    }
    function focus(el) { el.focus(); }
    function updateClock() {
      const seconds = Math.floor((elapsed + (state === 'speaking' ? Date.now() - startTime : 0)) / 1000);
      clock.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
    function stopClock() { clearInterval(interval); interval = undefined; }
    function start() {
      if (state === 'speaking') return;
      attempt++;
      session = newSession(); session.start(attempt === 1 ? 'first' : 'retry');
      state = 'speaking'; elapsed = 0; startTime = Date.now(); stopClock();
      clock.hidden = true; timerButton.setAttribute('aria-pressed', 'false'); timerButton.textContent = '显示计时 / Show timer'; updateClock();
      source.hidden = !keepSource; sourceButton.setAttribute('aria-expanded', String(keepSource));
      sourceButton.textContent = keepSource ? '收起材料 / Hide material' : '回看原文 / Show passage';
      section.querySelectorAll('details').forEach(d => { d.open = false; });
      speaking.hidden = false; finish.hidden = false; review.hidden = true; retry.hidden = true;
      find('[data-controls]').hidden = true; review.reset();
      // Keep the previous self-review visible as a concrete target for this retry.
      if (attempt > 1) speaking.append(result);
      focus(find('[data-speaking-title]'));
    }
    find('[data-controls]').hidden = false;
    find('[data-static-review]').hidden = true;
    find('[data-action="start"]').addEventListener('click', start);
    sourceButton.addEventListener('click', () => {
      source.hidden = !source.hidden;
      sourceButton.setAttribute('aria-expanded', String(!source.hidden));
      sourceButton.textContent = source.hidden ? (keepSource ? '查看材料 / Show material' : '回看原文 / Show passage') : (keepSource ? '收起材料 / Hide material' : '收起原文 / Hide passage');
      if (!source.hidden) session?.explanation('source', 'requested');
    });
    timerButton.addEventListener('click', () => {
      clock.hidden = !clock.hidden;
      timerButton.setAttribute('aria-pressed', String(!clock.hidden));
      timerButton.textContent = clock.hidden ? '显示计时 / Show timer' : '隐藏计时 / Hide timer';
      stopClock(); updateClock();
      if (!clock.hidden && state === 'speaking') interval = setInterval(updateClock, 1000);
    });
    find('[data-action="finish"]').addEventListener('click', () => {
      if (state !== 'speaking') return;
      elapsed = Date.now() - startTime; state = 'review'; stopClock(); updateClock();
      speaking.hidden = true; finish.hidden = true; review.hidden = false; result.hidden = true;
      focus(find('[data-review-title]'));
    });
    review.addEventListener('submit', event => {
      event.preventDefault();
      if (state !== 'review' || !review.reportValidity()) return;
      const missed = fields.filter(f => f.querySelector('input:checked')?.value !== 'yes');
      fields.forEach((f, i) => session.answer(`point-${i + 1}`, 'self_reviewed', {attempt_type: attempt === 1 ? 'first' : 'retry', topic_id:section.dataset.topic}));
      session.complete({result:'self_reviewed', answered_count:fields.length, topic_id:section.dataset.topic});
      state = 'done'; review.hidden = true;
      review.after(result);
      result.replaceChildren();
      const heading = document.createElement('h3');
      heading.textContent = missed.length ? '下次重点练这些 / Your next practice targets' : '本轮自查完成 / Self-review complete';
      result.append(heading);
      const note = document.createElement('p');
      note.textContent = `你自评有 ${fields.length - missed.length} / ${fields.length} 项说清了。这不是口语得分。You marked ${fields.length - missed.length} of ${fields.length} points as covered; this is not a speaking score.`;
      result.append(note);
      if (missed.length) {
        const list = document.createElement('ul');
        missed.forEach(f => { const li = document.createElement('li'); li.textContent = f.dataset.tip; list.append(li); });
        result.append(list);
      } else {
        const tip = document.createElement('p'); tip.textContent = '再练时试着少看提示，或完成下面的新情境；有不同说法也可以。Try again with fewer hints, or try the new situation below.'; result.append(tip);
      }
      result.hidden = false; retry.hidden = false; focus(result);
    });
    find('[data-action="retry"]').addEventListener('click', () => { if (state !== 'done') return; session.retry('whole-task'); start(); });
    section.querySelectorAll('[data-help]:not(.tp-case details)').forEach(d => d.addEventListener('toggle', () => {
      if (d.open) (session || newSession()).explanation(d.dataset.help, 'requested');
    }));
    window.addEventListener('pagehide', stopClock);
    window.addEventListener('pageshow', () => { if (state === 'speaking' && !clock.hidden && !interval) { updateClock(); interval = setInterval(updateClock,1000); } });
  });
})();
