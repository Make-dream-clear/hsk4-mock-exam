(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HSK4Scoring = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function isWriting(q) {
    return q.type === 'writing_construction' || q.type === 'choice';
  }
  function isOrdering(q) {
    return isWriting(q) && /完成句子|组成.*句子|排列|排词|连词/.test(q.text || '');
  }
  function sectionOf(q) {
    return isWriting(q) ? 'Writing' : q.type.startsWith('listening') ? 'Listening' : 'Reading';
  }
  function hasAnswer(q, answer) {
    return isWriting(q)
      ? typeof answer === 'string' && answer.trim().length > 0
      : Number.isInteger(answer) && answer >= 0 && answer < q.options.length;
  }
  // Legacy writing option indices are not written answers; never turn them into credit.
  function normalizeAnswers(questions, answers) {
    const result = {};
    questions.forEach((q, i) => { if (hasAnswer(q, answers && answers[i])) result[i] = answers[i]; });
    return result;
  }
  function summarize(questions, answers) {
    const result = { total: questions.length, scoredTotal: 0, correct: 0, wrong: 0,
      unanswered: 0, writingTotal: 0, writingAnswered: 0, wrongIdx: [], writingIdx: [], sections: {} };
    questions.forEach((q, i) => {
      const section = sectionOf(q);
      const stat = result.sections[section] ||= { total: 0, correct: 0, answered: 0 };
      stat.total++;
      const answered = hasAnswer(q, answers && answers[i]);
      if (answered) stat.answered++;
      if (isWriting(q)) {
        result.writingTotal++;
        result.writingIdx.push(i);
        if (answered) result.writingAnswered++;
        return;
      }
      result.scoredTotal++;
      if (!answered) result.unanswered++;
      else if (answers[i] === q.correct_answer_index) { result.correct++; stat.correct++; }
      else result.wrong++;
      if (!answered || answers[i] !== q.correct_answer_index) result.wrongIdx.push(i);
    });
    result.pct = result.scoredTotal ? Math.round(result.correct / result.scoredTotal * 100) : null;
    return result;
  }
  function resource(q) {
    if (isWriting(q)) return isOrdering(q)
      ? { href: '/writing/sentence-order/', label: 'Practise sentence order / 排词成句' }
      : { href: '/writing/#part1', label: 'Practise picture sentences / 看图造句' };
    return ({
      listening_true_false: { href: '/strategies/listening-judgment/', label: 'Review listening judgment strategies' },
      listening_choice: { href: '/strategies/listening-keywords/', label: 'Practise identifying listening clues' },
      fill_in_blank: { href: '/strategies/reading-fill/', label: 'Review word-choice strategies' },
      reading_ordering: { href: '/strategies/reading-ordering/', label: 'Practise reading sentence order' },
      reading_comprehension: { href: '/strategies/reading-comprehension/', label: 'Review reading comprehension strategies' }
    })[q.type] || { href: '/practice/', label: 'Explore targeted practice' };
  }
  return { isWriting, isOrdering, sectionOf, hasAnswer, normalizeAnswers, summarize, resource };
});
