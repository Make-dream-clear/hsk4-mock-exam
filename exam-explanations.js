(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HSK4Explanations = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  function escape(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function validate(q) {
    const detail = q.learning_explanation;
    if (!detail) return [];
    const errors = [];
    if (detail.version !== 1) errors.push('Unknown explanation version');
    if (!detail.answer || detail.answer.index !== q.correct_answer_index || detail.answer.text !== q.options[q.correct_answer_index]) errors.push('Answer changed: review the explanation before rebuilding');
    const source = detail.evidence && detail.evidence.source;
    const sourceText = source === 'transcript' ? q.transcript : source === 'question' ? q.text : source === 'reference' ? q.options[q.correct_answer_index] : null;
    const quote = detail.evidence && detail.evidence.quote;
    if (typeof quote !== 'string' || !quote.trim() || typeof sourceText !== 'string' || !sourceText.includes(quote)) errors.push('Evidence must quote the indicated question source exactly');
    for (const field of ['reason', 'pitfall', 'tip']) {
      for (const lang of ['zh', 'en']) {
        if (!detail[field] || typeof detail[field][lang] !== 'string' || !detail[field][lang].trim()) errors.push(`Missing ${field}.${lang}`);
      }
    }
    return errors;
  }
  function render(q) {
    const d = q.learning_explanation;
    if (!d || validate(q).length) return '';
    const writing = q.type === 'writing_construction' || q.type === 'choice';
    const labels = {
      transcript: 'Evidence from the transcript / 听力原文依据',
      question: 'Evidence from the question / 题干依据',
      reference: 'Reference sentence to analyse / 分析参考句',
    };
    const paragraph = (heading, value) => `<div class="learning-explanation-part"><h4>${heading}</h4><p lang="en">${escape(value.en)}</p><p lang="zh-CN" class="learning-explanation-zh">${escape(value.zh)}</p></div>`;
    return `<section class="learning-explanation" aria-label="Study explanation / 学习解析">
      <p class="learning-explanation-credit">Mandarin Zone study notes · 本站学习解析</p>
      <div class="learning-explanation-part"><h4>${labels[d.evidence.source]}</h4><blockquote lang="zh-CN">${escape(d.evidence.quote)}</blockquote></div>
      ${paragraph(writing ? 'How the sentence works / 句子怎么组织' : 'Why this answer fits / 为什么选这个答案', d.reason)}
      ${paragraph(writing ? 'What to watch for / 自查易错处' : 'Avoid this mistake / 容易误选在哪里', d.pitfall)}
      ${paragraph('Try this next time / 下次怎么判断', d.tip)}
    </section>`;
  }
  return { validate, render };
});
