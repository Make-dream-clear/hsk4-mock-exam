(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HSK4Order = api;
})(typeof globalThis === 'object' ? globalThis : this, function() {
  const normalize = value => String(value).replace(/[，。！？、；：“”‘’\s,.!?;:'"（）()]/g, '');
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function tileOrder(fragments, sentence) {
    const target = normalize(sentence);
    function find(rest, used) {
      if (used.length === fragments.length) return rest === '' ? used : null;
      for (let i = 0; i < fragments.length; i++) {
        const tile = normalize(fragments[i]);
        if (!used.includes(i) && tile && rest.startsWith(tile)) {
          const result = find(rest.slice(tile.length), [...used, i]);
          if (result) return result;
        }
      }
      return null;
    }
    return find(target, []);
  }
  function evaluate(ex, indices) {
    if (!Array.isArray(indices) || indices.length !== ex.fragments.length || new Set(indices).size !== indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i >= ex.fragments.length)) return 'incomplete';
    const text = normalize(indices.map(i => ex.fragments[i]).join(''));
    return ex.answers.some(a => normalize(a) === text) ? 'matched' : 'review';
  }
  function renderNotes(ex) {
    return '<section class="learning-explanation" aria-label="Sentence explanation / 语序解析"><p class="learning-explanation-credit">Mandarin Zone study notes · 本站学习解析</p>' + [
      ['reason','How the sentence works / 句子怎么组织'],
      ['pitfall','What to watch for / 自查易错处'],
      ['tip','Check next time / 下次怎么检查']
    ].map(([key,label]) => `<div class="learning-explanation-part"><h4>${label}</h4><p lang="en">${escape(ex.notes[key].en)}</p><p lang="zh-CN">${escape(ex.notes[key].zh)}</p></div>`).join('') + '</section>';
  }
  function recordFirst(records, id, result) {
    if (result !== 'incomplete' && !Object.prototype.hasOwnProperty.call(records, id)) records[id] = result;
  }
  return { normalize, escape, tileOrder, evaluate, renderNotes, recordFirst };
});
