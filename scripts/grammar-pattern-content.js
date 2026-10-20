'use strict';
// Shared by the site build and targeted content refresh; preserves custom pages.
const esc = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function fillExercises(pat) {
  return `<h2 id="fill-practice">Fill in the Blanks / 填空练习</h2>
  <p>${esc(pat.fill_instruction)}</p><div class="fill-exercises">${pat.exercises.map((ex, i) => {
    let blank = 0;
    const sentence = esc(ex.sentence).replace(/___/g, () => `<input type="text" class="fill-input" maxlength="12" autocomplete="off" aria-label="Question ${i+1}, blank ${++blank}" data-idx="${i}">`);
    const answers = ex.answers || [ex.answer.split('...')];
    if (answers.some(a => a.length !== blank)) throw new Error(`Blank/answer mismatch: ${pat.slug} ${i}`);
    return `<div class="fill-item" data-answer="${esc(answers[0].join('...'))}" data-answers="${esc(JSON.stringify(answers))}" data-reviewed="grammar-20261020">
      <div class="fill-sentence chinese">${sentence}</div>
      <p class="fill-hint">${esc(ex.hint)}</p>
      <button type="button" class="fill-check-btn" onclick="checkFill(this)">Check / 检查</button>
      <button type="button" class="fill-retry-btn" onclick="retryFill(this)" hidden>Hide answers &amp; retry / 重做</button>
      <div class="fill-feedback" role="status" aria-live="polite"></div>
      <p class="fill-explanation" hidden>${esc(ex.explanation)}</p>
      <noscript><p>Reference: ${esc(answers.map(a => a.join(' / ')).join('; '))}. ${esc(ex.explanation)}</p></noscript>
    </div>`;
  }).join('\n')}</div>`;
}
function enrich(html, pat) {
  if(!html.includes('id="pattern-practice-nav"')) html=html.replace(/(<h1[^>]*>[\s\S]*?<\/h1>)/, '$1<nav id="pattern-practice-nav" aria-label="Lesson shortcuts"><a href="#usage-check">Understand the difference / 看区别</a><a href="#fill-practice">3 fill exercises / 练填空</a><a href="#quick-quiz">3-question check / 测一测</a></nav>');
  html=html.replace(/<h2([^>]*)>Quick Quiz/, (m,attrs)=>`<h2${attrs.includes('id=')?attrs:attrs+' id="quick-quiz"'}>Quick Quiz`);
  let errorIndex=0, quizIndex=0;
  html=html.replace(/<div class="wrong-card">[\s\S]*?<div class="wrong-explain">[\s\S]*?<\/div>\s*<\/div>/g, () => {
    const e=pat.wrong_examples[errorIndex++];
    if(!e) throw new Error('Unexpected error card '+pat.slug);
    return `<div class="wrong-card"><div class="${e.valid?'right':'wrong'}-line"><span class="${e.valid?'right':'wrong'}-mark">${e.valid?'✓':'△'}</span> <span class="chinese">${esc(e.wrong)}</span></div><div class="right-line"><span class="right-mark">✓</span> <span class="chinese">${esc(e.right)}</span></div><div class="wrong-explain">${esc(e.explain)}</div></div>`;
  });
  html=html.replace(/<div class="q-item">[\s\S]*?<div class="q-explain"[^>]*>[\s\S]*?<\/div>\s*(?:<button[^>]*class="q-retry"[\s\S]*?<\/button>)?\s*(?:<noscript>[\s\S]*?<\/noscript>)?\s*<\/div>/g, () => {
    const q=pat.quiz[quizIndex++];
    if(!q)throw new Error('Unexpected quiz item '+pat.slug);
    const choices=[{s:q.correct,ok:true},{s:q.wrong,ok:false}];
    if(quizIndex%2)choices.reverse();
    return `<div class="q-item"><div class="q-stem chinese">${esc(q.stem)}</div><div class="q-opts">${choices.map(o=>`<button type="button" class="q-opt" ${o.ok?'data-correct="1"':''} onclick="answer(this,${o.ok})">${esc(o.s)}</button>`).join(' ')}</div><div class="q-explain" role="status" aria-live="polite">${esc(q.explain)}</div><button type="button" class="q-retry" onclick="retryPattern(this)" hidden>Hide answer &amp; retry / 重做</button><noscript><p>Reference: ${esc(q.correct)}. ${esc(q.explain)}</p></noscript></div>`;
  });
  if(errorIndex!==pat.wrong_examples.length || quizIndex!==pat.quiz.length)throw new Error('Missing practice section '+pat.slug);
  html=html.replace(/<h2[^>]*>Fill in the Blank[\s\S]*?(?=<h2[^>]*>Quick Quiz)/,fillExercises(pat)+'\n');
  html=html.replace(/<section id="usage-check"[\s\S]*?<\/section>\s*/g,'');
  html=html.replace(/<h2[^>]*>Common Errors \/ 常见错误<\/h2>/,`<section id="usage-check" class="compare-box"><h2>Choose the meaning first / 先看要表达什么</h2><p>${esc(pat.usage_note)}</p><p><a href="#fill-practice">Practise the pattern / 开始练习 →</a></p></section><h2>Common Errors &amp; Meaning Differences / 易错点与表达区别</h2>`);
  // Idempotent reruns use the new heading.
  if(!html.includes('id="usage-check"'))html=html.replace(/<h2>Common Errors &amp; Meaning Differences \/ 易错点与表达区别<\/h2>/,`<section id="usage-check" class="compare-box"><h2>Choose the meaning first / 先看要表达什么</h2><p>${esc(pat.usage_note)}</p><p><a href="#fill-practice">Practise the pattern / 开始练习 →</a></p></section>$&`);
  // Keyword co-occurrence cannot establish that an exam question tests a pattern.
  html=html.replace(/<h2[^>]*>HSK 4 Mock Test Questions Using[\s\S]*?(?=<h2[^>]*>[^<]* FAQ<\/h2>)/,'');
  html=html.replace(/<script>\s*function answer\(btn, correct\)[\s\S]*?<\/script>/,'<script src="/grammar/pattern-practice.js"></script>');
  if(!html.includes('href="/grammar/pattern-practice.css"'))html=html.replace('</head>','<link rel="stylesheet" href="/grammar/pattern-practice.css">\n</head>');
  return html;
}
module.exports={enrich,fillExercises};
