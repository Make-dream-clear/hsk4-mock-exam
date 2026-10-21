'use strict';
const content = require('../data/topic-practice.json');
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function render(slug) {
  const p = content[slug];
  if (!p) return '';
  return `<section id="${p.anchor}" class="topic-practice" data-topic="${slug}" data-mode="${p.mode}" data-keep-source="${!!p.keepSource}" lang="zh-CN" aria-labelledby="tp-title">
  <p class="tp-kicker">读懂 → 开口 → 自查 → 再练 / Read · Speak · Review · Retry</p>
  <h2 id="tp-title">${esc(p.title)}</h2>
  <p>${esc(p.goal)}</p>
  <p class="tp-note">自编学习活动，不是官方试题；用自己的话表达即可。Original learning activity, not an official test. No microphone needed.</p>
  <div class="tp-source" id="tp-source">
    <h3>${esc(p.sourceTitle)}</h3><p>${esc(p.source)}</p>
    <details data-help="translation"><summary>查看英文帮助 / English support</summary><p lang="en">${esc(p.translation)}</p></details>
  </div>
${p.cases ? `<div class="tp-cases"><h3>先判断情境 / Choose in context</h3><p>选择后查看理由，也可以直接展开解析学习。Read the explanation after choosing, or open it to study first.</p>${p.cases.map((q,i)=>`<article class="tp-case" data-case="${i+1}" data-answer="${q.correct}" aria-labelledby="tp-case-${i+1}"><h4 id="tp-case-${i+1}">${i+1}. ${esc(q.prompt)}</h4><p lang="en">${esc(q.translation)}</p><div class="tp-actions" data-case-controls hidden>${q.options.map((o,j)=>`<button type="button" data-case-choice="${j}" data-reason="${esc(o.reason)}">${esc(o.text)}</button>`).join('')}</div><p class="tp-case-feedback" role="status" hidden></p><details data-help="case-${i+1}"><summary>参考判断与逐项解释 / Compare the options</summary><p><strong>本题最贴切的选项 / Best fit: ${esc(q.options[q.correct].text)}</strong></p><ul>${q.options.map(o=>`<li><strong>${esc(o.text)}</strong>：${esc(o.reason)}</li>`).join('')}</ul></details><button type="button" data-case-retry hidden>隐藏解析重做 / Retry this situation</button></article>`).join('')}</div>` : ''}
  <details data-help="words"><summary>关键词：拼音与词义 / Key words</summary><dl class="tp-words">${p.words.map(([cn, py, en]) => `<div><dt>${esc(cn)} <span>${esc(py)}</span></dt><dd lang="en">${esc(en)}</dd></div>`).join('')}</dl></details>
  <div class="tp-actions" data-controls hidden><button type="button" data-action="start" class="btn btn-primary">我准备好了，开始练习 / Start</button></div>
  <noscript><p>读懂材料后，尝试按下面的提示开口，再对照参考表达和自查要点。Read, speak using the prompts, then review the checklist and model below.</p></noscript>
  <div class="tp-speaking" hidden>
    <h3 tabindex="-1" data-speaking-title>用自己的话说 / Your turn</h3>
    <p class="tp-source-note">${p.keepSource ? (slug === 'food-dining' ? '点餐时可以查看菜单，无须背价格。Keep the menu open if useful.' : '可以查看材料，重点是解释意思，不必背诵。Keep the material open and explain the meaning in your own words.') : '原文已收起。卡住时可以看提示或回看原文。The passage is hidden; help is available whenever you need it.'}</p>
    <div class="tp-actions"><button type="button" data-action="source" aria-expanded="${!!p.keepSource}" aria-controls="tp-source">${p.keepSource ? '收起材料 / Hide material' : '回看原文 / Show passage'}</button><button type="button" data-action="timer" aria-pressed="false">显示计时 / Show timer</button><output class="tp-timer" hidden aria-label="Elapsed speaking time">0:00</output></div>
    <p class="tp-note">按自己的节奏说，计时不会自动结束练习。No time limit; finish at your own pace.</p>
  </div>
  <ol class="tp-prompts">${p.prompts.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
  <details data-help="hints"><summary>卡住了？查看表达提示 / Need a hint?</summary><p>${esc(p.hint)}</p></details>
  <div class="tp-actions" data-finish hidden><button type="button" data-action="finish" class="btn btn-primary">我说完了，开始自查 / Review my attempt</button></div>
  <details class="tp-model" id="${slug === 'food-culture' ? 'retelling-model' : 'topic-model'}" data-help="model"><summary>查看一种参考表达 / One possible answer</summary><p>${esc(p.model)}</p><p class="tp-note">表达可以不同；重点是意思清楚、信息准确。Other wording is welcome. Keep the meaning clear and accurate.</p></details>
  <div data-static-review><h3>自查要点 / Review points</h3><ul>${p.checks.map(c => `<li>${esc(c.label)}</li>`).join('')}</ul></div>
  <form class="tp-review" hidden>
    <h3 tabindex="-1" data-review-title>逐项自查 / Check your attempt</h3>
    <p>这是你的自评，不是自动评分。“还没说清”会变成下一次的练习重点。This is self-review, not an automatic assessment.</p>
    ${p.checks.map((c, i) => `<fieldset data-check="${i}" data-tip="${esc(c.help)}"><legend>${i + 1}. ${esc(c.label)}</legend><label><input type="radio" name="point-${i}" value="yes" required> 说清了 / Covered</label><label><input type="radio" name="point-${i}" value="review" required> 还没说清 / Needs practice</label></fieldset>`).join('')}
    <button type="submit" class="btn btn-primary">完成自查，查看下一步 / Get next steps</button>
  </form>
  <div class="tp-result" hidden tabindex="-1" aria-live="polite"></div>
  <div class="tp-actions" data-retry hidden><button type="button" data-action="retry" class="btn btn-primary">带着重点再练一次 / Try again</button></div>
  <div class="tp-transfer"><h3>再进一步 / Try a new situation</h3><p>${esc(p.transfer)}</p></div>
  <p><a href="${esc(p.link)}">${esc(p.linkLabel)} →</a> · <a href="/topics/#guided-practice">更多话题练习 / More guided practice</a></p>
  </section>`;
}

function hub() {
  return `<!-- GUIDED TOPIC PRACTICE -->
  <section id="guided-practice" aria-labelledby="guided-practice-title" style="margin:28px 0;">
    <h2 id="guided-practice-title">选一个任务，开口练习 / Choose a speaking task</h2>
    <p>从材料和提示开始，用自己的话说，再自查、重练。无需录音或登录。Read, speak, check your attempt and try again. No recording or sign-in required.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px;">${Object.entries(content).map(([slug,p]) => `<a data-topic="${slug}" href="/topics/${slug}/#${p.anchor}" style="display:block;padding:18px;border:1px solid var(--mist);border-radius:12px;color:var(--ink);background:var(--surface);text-decoration:none;"><strong>${esc(p.entry)}</strong><p style="font-size:14px;margin:8px 0 0;">${esc(p.goal)}</p></a>`).join('')}</div>
  </section>
  <!-- /GUIDED TOPIC PRACTICE -->`;
}

module.exports = {content, render, hub};
