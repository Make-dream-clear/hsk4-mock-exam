# SEO 实施方案 — 字符页/词汇页收录问题修复

> 本文档是给执行模型（或开发者）的**逐步施工手册**。按任务顺序执行，每完成一个任务独立提交一次。
> 背景诊断：全站 607 个 URL 中 442 个是字符页（73%），其中 411 个使用旧薄模板
> （唯一内容 < 100 字符），Google 判定为薄内容不予收录，并拖累全站收录率。

---

## 0. 执行须知（全局规则，先读完再动手）

1. **本仓库是"生成器 + 生成产物"同仓提交**的 GitHub Pages 站点：
   - `build.js` 是唯一的页面生成器。改任何生成页面 = 改 `build.js`，**严禁手工编辑**
     `characters/`、`topics/`、`words/`、`test/`、`vocabulary/`、`sentences/`、`traps/`、
     `grammar/patterns/` 下的 HTML（会在下次构建时被覆盖）。
   - 每次改完 `build.js` 必须运行 `node build.js`，然后把 **build.js 和重新生成的 HTML 一起提交**。
2. **构建已验证为确定性**（同一份 build.js 连续跑两次输出完全一致）。改动后请自测：
   ```bash
   node build.js && git add -A && git stash
   node build.js && git diff --stat   # 应无输出（除 sitemap lastmod，任务 5 完成后连它也不变）
   git stash pop
   ```
3. **执行顺序**（build.js 末尾 RUN ALL 段，约 5377 行起）：
   `buildVocabulary → buildTestPages → buildHomepage → buildTopics → fixGuide →
   addGrammarCrossLinks → buildCharacterPages → buildSitemap → injectAnalytics → syncCounts`。
   注意 `injectAnalytics`/`syncCounts` 在 sitemap **之后**还会改页面内容 —— 任务 5 要处理这一点。
4. 文中给出的行号是当前 `main` 分支的参考锚点，行号会随编辑漂移，**定位一律用 grep 函数名/字符串**。
5. 不要动：`CNAME`、`google08b0f8b834b380d3.html`、`robots.txt`（除非任务明确要求）。
6. 每个任务的"验收"一节必须全部通过才能提交；提交信息格式：`SEO: <任务名> (task N)`。
7. 数据事实（写方案时已核实，直接引用不必重查）：
   - `data/hsk4-characters.json`：150 书写字 `{char, pinyin, meaning}`
   - `data/hsk4-rendu-characters.json`：291 认读字，同结构
   - `data/character-data.json`：makemeahanzi 子集，**只覆盖 236 字**（150 书写字 + 86 个部件字），
     291 个认读字全部缺失 → 任务 1 补齐
   - `data/vocabulary.json`：1000 词 `{id, word, pinyin, pos, meaning, example_cn, example_pinyin, example_en}`，例句 100% 齐全
   - `data/index.json`：19 套真题 `{file, title, questions}`
   - 字符在真题中的出现量充足（如 与 出现在 44 道题、式 19 道、乒 4 道）→ 任务 3 的内容来源
   - 现状：259 个字符页只列 1 个词、97 页只列 2 个词

---

## 任务 1：补齐字符结构化数据（数据基建，其他任务的前置）

**目标**：`data/character-data.json` 从 236 字扩到覆盖全部 441 字 + 所有拆解部件字；
新增 `data/character-strokes.json`（笔画 SVG 路径，任务 4 用）。

**数据源**（已验证本构建环境可直接访问，HTTP 200）：
- `https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt`
  （每行一个 JSON：`character, definition, pinyin[], decomposition, etymology, radical, matches`）
- `https://raw.githubusercontent.com/skishore/makemeahanzi/master/graphics.txt`
  （每行一个 JSON：`character, strokes[]（SVG path 字符串）, medians[][]`，全文件约 18MB，**必须裁剪后入库**）

**步骤**：

1. 新建 `scripts/fetch-character-data.js`（Node 原生，无依赖）：
   ```js
   // 用法: node scripts/fetch-character-data.js
   // 1) 需要的字 = hsk4-characters ∪ hsk4-rendu-characters
   // 2) 第一遍从 dictionary.txt 取这些字的条目
   // 3) 收集这些条目 decomposition 里出现的部件字 + radical 字，再取一遍（一层递归即可）
   // 4) 与现有 character-data.json 合并：上游数据优先，上游没有的保留旧条目
   // 5) 按 key 排序后写回 data/character-data.json（排序保证构建确定性）
   // 6) 从 graphics.txt 取【441 个页面字】的 strokes + medians，写 data/character-strokes.json
   //    （部件字不需要笔画数据；medians 只保留每笔第一个点 [x,y]，用于任务 4 标笔序号，控制体积）
   ```
   下载用 `https.get` + 手动跟随 redirect，或直接 `execSync('curl -sL <url>', {maxBuffer: 64*1024*1024})`。
   `character-strokes.json` 结构：
   ```json
   { "与": { "strokes": ["M ...", "M ...", "M ..."], "starts": [[x,y],[x,y],[x,y]] } }
   ```
2. 运行并检查覆盖率，脚本末尾打印：
   `coverage: 441/441 pages, missing: []`。若 makemeahanzi 缺个别字（预期 < 5 个），打印清单即可，
   模板对缺数据字有降级处理（任务 2）。
3. 版权署名：makemeahanzi 数据基于 Arphic 字体（Arphic Public License）。在任务 2 改字符页模板时，
   页脚 `footer-links` 行追加一条：
   `Character data: <a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noopener">Make Me a Hanzi</a>`。

**验收**：
- [ ] `node -e "const d=require('./data/character-data.json');const a=[...require('./data/hsk4-characters.json'),...require('./data/hsk4-rendu-characters.json')];console.log(a.filter(c=>!d[c.char]).map(c=>c.char))"` 输出空数组（或 <5 个字的已知清单）
- [ ] `data/character-strokes.json` 覆盖同样范围；文件 < 3MB
- [ ] 脚本可重复运行且输出 byte-identical（key 已排序）

---

## 任务 2：增强模板推广到全部 441 个字符页（核心任务）

**现状**：`buildCharacterPages()`（grep `function buildCharacterPages`）里已有两套模板：
- `renderEnhancedDetail(...)`（grep 该函数名）：Quick Answer、多音字读音、义项列表、部件拆解、
  部首 + 同部首互链、字源、FAQ + FAQPage JSON-LD —— **只用于词频前 30 的书写字**
  （grep `TOP_N = 30` 和 `top30Set.has(c.char)`）
- 旧薄模板（`pageChars.forEach` 循环里 top-30 gate 之后的内联 HTML）：其余 120 书写字 + 291 认读字在用

**目标**：删掉 top-30 门槛，全部 441 页走增强模板；旧模板代码整段删除。

**步骤**：

1. `renderEnhancedDetail` 增加对认读字的支持。函数签名加一个参数 `isRecognition`
   （调用处传 `c.tier === 'recognition'`），需要条件化的位置：
   - `<title>`：认读字用 `${c.char} (${pinyin}) Meaning, Pinyin & Stroke Order — HSK 4 认读字 | Mandarin Zone`（保持与旧模板一致的标题意图，书写字标题不变）
   - `<h1>`：认读字用 `${c.char} (${pinyin}) — HSK 4 Recognition Character: Meaning, Radical & Stroke Order`
   - Quick Answer 的尾句：书写字保留现有
     `and is one of the 150 HSK 4 required writing characters (rank #N by ...)`；
     认读字改为 `and is one of the 441 HSK 4 recognition characters (认读字) — you must recognize it when reading, but handwriting it is not required`。
     **注意** `charToRank` 只覆盖 150 书写字，认读字不要输出 rank 子句。
   - FAQ 第 1 条答案里的 "required for the HSK 4 writing section" 同样条件化。
   - `char-stats` 行（`HSK 4 required writing character`）条件化为 `HSK 4 recognition character (认读字)`。
2. 同部首互链扩到全集：现在 `radicalToChars`（grep 该变量）只遍历 `chars`（150 字）。
   改为遍历 `[...chars, ...renduChars]`，这样认读字也有部首互链、书写字的互链池也变大。
   同时 `sameRadicalOthers` 的链接渲染处不用改（已按 char 生成链接）。
   互链列表可能变长，**上限 12 个**，超出截断（`.slice(0, 12)`）。
3. 拆解组件卡的"是否可点击"判断（grep `inOurSet`）：现在只查 `chars`，改为查
   `chars.some(...) || renduChars.some(...)`（预先建 `Set` 避免 O(n²)）。
4. 删除 top-30 gate：`pageChars.forEach` 里改为所有字都调 `renderEnhancedDetail(c, i, prev, next, wordsHtml, wordsForChar, isRecognition)`，
   然后**整段删除旧模板**（从 `const detailTitle = isRecognition ? ...` 到该循环内模板字符串结束、
   写文件为止的旧代码路径），只保留一个写文件出口。
5. 缺数据降级：`renderEnhancedDetail` 已对 `mmah[c.char]` 缺失做了空对象降级（strokes/radical 为 null 时
   跳过对应模块）。任务 1 之后缺失字应 < 5 个，无需额外处理，但**确认页面仍能生成且不含 "undefined" 字样**（验收有检查）。
6. 更新返回值与 sitemap 优先级：
   - `buildCharacterPages` 的 `return { all, enhanced, recognition }` 中 `enhanced` 已无意义，
     返回改为 `{ all, recognition }`。
   - `buildSitemap`（grep `characterList.enhanced`）：书写字统一 `priority 0.7`，认读字 `0.6`，
     删除 enhancedSet 逻辑。
   - 同步修改 `console.log` 统计行。
7. 词汇模块上限放宽：`charToWords[c.char].slice(0, 8)` 改为 `slice(0, 10)`（与 出现在 10+ 词中）。
8. 页脚加 Make Me a Hanzi 署名（见任务 1 第 3 步）。
9. 顺手更新文档：`INTERNAL_LINKING.md` 中"字符页"一行的描述（150+291 全部增强模板）。

**验收**：
- [ ] `node build.js` 成功；`ls characters | wc -l` 仍为 442（441 字 + index.html）
- [ ] 抽查 3 页（书写字 `characters/与/`、认读字 `characters/按/`、多音字任选）：
      含 `Quick Answer`、`Radical`、`FAQ`、`FAQPage` JSON-LD；认读字页含 "recognition"、不含 "rank #"
- [ ] `grep -rl "undefined" characters/*/index.html | wc -l` 为 0
- [ ] 页面平均体积显著上升：`for f in characters/*/index.html; do wc -c $f; done | awk '{s+=$1;n++} END{print s/n}'` ≥ 22000（现状 13542）
- [ ] 所有页面 JSON-LD 可解析：写个 10 行 Node 脚本抽取每页 `<script type="application/ld+json">` 逐个 `JSON.parse`，0 报错

---

## 任务 3：字符页"真题例句"模块（独家内容，权重最高的加厚手段）

**目标**：每个字符页新增一节 "Seen in the Real Exams / 真题例句"：该字在 19 套真题中出现的
题目数量 + 最多 3 条真题原句（字高亮）+ 每条链接到对应 `/test/XX/` 页。

**步骤**：

1. 在 `extractExamSentences`（grep 该函数，约 222 行）**旁边**新增一个按字索引的变体，
   不要改动原函数（词汇页还在用它）：
   ```js
   // 每个字 -> 真题原句（带出处 test 编号）。句子清洗规则完全复用
   // extractExamSentences：去题号、去 EXAM_SENT_PREFIX、8-34 字、以。！？结尾、
   // 不含括号/下划线/字母数字。
   function extractExamSentencesByChar(pageCharsSet) {
     const index = readJSON('index.json');
     const sentences = []; // { s, test: 1-based 编号 }
     index.forEach((meta, ti) => {
       readJSON(meta.file).questions.forEach(q => {
         if (!q.text) return;
         const txt = q.text.replace(/^\s*\d+[.、]\s*/, '');
         txt.split(/(?<=[。！？])/).forEach(raw => {
           let s = raw.trim(), prev;
           do { prev = s; s = s.replace(EXAM_SENT_PREFIX, '').trim(); } while (s !== prev);
           if (s.length >= 8 && s.length <= 34 && /[。！？]$/.test(s)
               && !/[（）_A-Za-zＡ-Ｚａ-ｚ0-9★☆:：]/.test(s)) {
             sentences.push({ s, test: ti + 1 });
           }
         });
       });
     });
     // 去重（同句可能出现在多套题，保留最小 test 编号），再按字建索引
     const byChar = {};
     const seen = new Map();
     sentences.forEach(({ s, test }) => {
       if (seen.has(s)) return; seen.set(s, test);
       for (const ch of new Set(s)) {
         if (!pageCharsSet.has(ch)) continue;
         (byChar[ch] = byChar[ch] || []).push({ s, test });
       }
     });
     // 每字排序：句短优先、陈述句（。结尾）优先，取前 3
     for (const ch in byChar) {
       byChar[ch].sort((a, b) =>
         (a.s.endsWith('。') ? 0 : 1) - (b.s.endsWith('。') ? 0 : 1) || a.s.length - b.s.length);
       byChar[ch] = byChar[ch].slice(0, 3);
     }
     return byChar;
   }
   ```
2. 题目命中数：`buildCharacterPages` 里已调用 `computeCharFrequency()`（字符出现次数）。
   再加一个**题目级**计数（用于 "appears in N questions" 文案，比字符次数更直观）：
   ```js
   function computeCharQuestionCount(pageCharsSet) {
     const index = readJSON('index.json');
     const counts = {};
     index.forEach(meta => readJSON(meta.file).questions.forEach(q => {
       let blob = (q.text || '') + (q.options || []).join('');
       CHAR_BOILERPLATE_PHRASES.forEach(p => { blob = blob.split(p).join(''); });
       for (const ch of new Set(blob)) if (pageCharsSet.has(ch)) counts[ch] = (counts[ch] || 0) + 1;
     }));
     return counts;
   }
   ```
3. 在 `renderEnhancedDetail` 中、`charTaskLinksHtml(c)` 模块之前插入渲染（两个数据对象在
   `buildCharacterPages` 顶部各计算一次后传入或闭包引用）：
   ```js
   const hits = examSentencesByChar[c.char] || [];
   const qCount = charQuestionCount[c.char] || 0;
   const examHtml = hits.length === 0 ? '' : `
   <section>
     <h2 style="font-family:'Noto Serif SC',serif;font-size:22px;margin:32px 0 8px;">Seen in the Real Exams / 真题例句</h2>
     <p style="color:var(--stone);font-size:14px;margin-bottom:12px;">
       <span class="chinese" style="font-weight:600;">${escHtml(c.char)}</span> appears in
       <strong>${qCount} questions</strong> across the ${TEST_COUNT} mock &amp; official HSK 4 exams on this site.
       Real exam sentences using it:</p>
     ${hits.map(({ s, test }) => `<div class="vw-example" style="margin-bottom:10px;">
       <div class="ex-cn chinese">${escHtml(s).split('').map(ch => ch === c.char ? `<span class="hl">${ch}</span>` : ch).join('')}</div>
       <div><a href="/test/${String(test).padStart(2, '0')}/" style="color:var(--accent);font-size:13px;">From Mock Exam ${String(test).padStart(2, '0')} →</a></div>
     </div>`).join('')}
   </section>`;
   ```
   **没有命中的字整节省略**——不要输出"本字未出现"之类的填充文案。
4. 真题句只展示中文原句 + 出处链接。**不要机器生成拼音/翻译**（质量不可控，宁缺毋滥）。

**验收**：
- [ ] `characters/与/index.html` 含 "真题例句" 节、3 条句子、"From Mock Exam" 链接、与 字有 `<span class="hl">` 高亮
- [ ] `grep -l "真题例句" characters/*/index.html | wc -l` ≥ 350（多数字都有真题命中）
- [ ] 抽查 2 条句子确实出现在对应 `data/test-XX.json` 里、链接编号正确
- [ ] 无命中的字符页不含该节标题

---

## 任务 4：静态笔顺图（把页面核心价值从纯 JS 变成可索引内容）

**现状**：笔顺只有 HanziWriter 运行时动画（jsdelivr CDN + JS），Google 渲染视角下该区域为空，
且 442 页完全相同。

**目标**：在互动练习区**下方**新增一张服务端渲染的静态 SVG 笔顺图：整字全部笔画 + 每笔起点标序号。
每页内容因此获得一块唯一、无 JS 依赖、可被收录的主体内容（也顺带成为打印素材）。

**步骤**：

1. 数据：任务 1 生成的 `data/character-strokes.json`（`strokes[]` = SVG path，`starts[]` = 每笔第一个 median 点）。
2. 在 `buildCharacterPages` 顶部加载：
   ```js
   const strokeData = fs.existsSync(path.join(DATA, 'character-strokes.json'))
     ? readJSON('character-strokes.json') : {};
   ```
3. 在 `renderEnhancedDetail` 的 writer-stage 区块之后插入：
   ```js
   const sd = strokeData[c.char];
   const strokeDiagram = !sd ? '' : `
   <figure style="margin:16px 0;">
     <svg viewBox="0 0 1024 1024" width="220" height="220" role="img"
          aria-label="Stroke order diagram for ${escHtml(c.char)} (${sd.strokes.length} strokes)"
          style="max-width:100%;background:var(--surface);border:1px solid var(--mist);border-radius:8px;">
       <g transform="scale(1, -1) translate(0, -900)">
         ${sd.strokes.map(p => `<path d="${p}" fill="var(--ink, #1a1a2e)"/>`).join('')}
         ${sd.starts.map(([x, y], si) => `
         <g transform="translate(${x}, ${y}) scale(1, -1)">
           <circle r="38" fill="var(--accent, #c23b22)" opacity="0.85"/>
           <text text-anchor="middle" dy="18" font-size="52" fill="#fff" font-family="sans-serif">${si + 1}</text>
         </g>`).join('')}
       </g>
     </svg>
     <figcaption style="color:var(--stone);font-size:13px;">
       ${escHtml(c.char)} — ${sd.strokes.length} strokes, numbered in writing order. 笔顺图（数字为下笔顺序）。
     </figcaption>
   </figure>`;
   ```
   坐标系说明（不要自行改动）：makemeahanzi/hanzi-writer 的 path 坐标是 Y 轴翻转的 1024×1024，
   外层 `scale(1,-1) translate(0,-900)` 是标准变换；序号 `<g>` 内再 `scale(1,-1)` 把文字翻回正向。
4. 序号重叠是可接受的小瑕疵（笔画密集的字），不做碰撞处理——保持实现简单。
5. 页面体积预估：每笔 path 约 200–500B，平均 9 笔 ≈ 3–4KB/页，可接受。

**验收**：
- [ ] `grep -c "<svg viewBox=\"0 0 1024 1024\"" characters/与/index.html` = 1，浏览器打开该 SVG 显示正确字形 + 3 个序号
- [ ] `grep -L "Stroke order diagram" characters/*/index.html | wc -l` ≤ 5（只有缺笔画数据的字没有）
- [ ] 字符页平均体积 ≤ 45KB（防失控）；抽查暗色模式下 SVG 颜色跟随主题（var(--ink)）

---

## 任务 5：sitemap 拆分 + 基于内容哈希的真实 lastmod

**现状**：单个 `sitemap.xml`，607 个 URL 的 lastmod 全部 = 构建日（`new Date()`），每次构建整体
刷新 → Google 已学会忽略本站 lastmod。且无法在 GSC 里分集群看收录率。

**目标**：
- `sitemap.xml` 变为 sitemap index，指向 5 个分文件：
  `sitemap-core.xml`（首页、各 hub、guide、strategies、grammar、compare、writing、practice、train）、
  `sitemap-tests.xml`、`sitemap-topics.xml`、`sitemap-characters.xml`、`sitemap-words.xml`（confusables + grammar patterns）
- lastmod 按**页面文件内容哈希**维护：内容没变的页面日期不变。

**步骤**：

1. 状态文件 `data/sitemap-state.json`（提交入库）：`{ "<loc>": { "hash": "<sha256前16位>", "lastmod": "YYYY-MM-DD" } }`。
2. 改造 `buildSitemap`（grep `function buildSitemap`）：
   - URL 收集逻辑不变，但每个条目按上面的分组打 `cluster` 标签。
   - **关键**：哈希必须在页面全部定稿后计算，而 `injectAnalytics()`/`syncCounts()` 在
     `buildSitemap()` 之后还会改 HTML（见 RUN ALL 段）。改法：`buildSitemap` 只收集
     URL 列表存到模块级变量，新增 `writeSitemaps()` 在 RUN ALL 的**最后一行**调用。
   - `writeSitemaps()` 逻辑：
     ```js
     // loc -> 文件路径：'/' -> index.html，其余 loc + 'index.html'（loc 是 decodeURIComponent 后的目录名）
     // hash = sha256(文件内容).slice(0,16)   (crypto 模块)
     // state[loc] 不存在或 hash 变化 -> lastmod = today, 更新 state
     // 否则沿用 state[loc].lastmod
     // 写 5 个分文件（<urlset>，含 loc/lastmod/priority，去掉 changefreq——Google 忽略它）
     // 写 sitemap.xml（<sitemapindex>，每个分文件的 lastmod = 其成员 lastmod 的最大值）
     // state 按 key 排序写回 data/sitemap-state.json
     ```
   - 首次运行所有页面都会打上当天日期（state 为空），属预期；之后日期只随真实变更移动。
3. `robots.txt` 的 `Sitemap:` 行不用改（仍指向 sitemap.xml）。
4. 部署后在 Google Search Console 重新提交 `sitemap.xml`（人工步骤，写进 PR 描述提醒站长）。

**验收**：
- [ ] `sitemap.xml` 是合法的 `<sitemapindex>`；5 个分文件 URL 总数 = 拆分前总数（607 + 后续任务新增）
- [ ] 连续两次 `node build.js`，第二次后 `git diff --name-only` 里**没有** sitemap 相关文件（日期稳定）
- [ ] 手工改一个字符页数据后重建，只有该页所在分文件的对应条目 lastmod 变化
- [ ] `xmllint --noout sitemap*.xml`（若环境无 xmllint，用 Node 简单校验标签配对）

---

## 任务 6：meta description 截断修复（小任务）

**现状**：`truncDesc`（grep `function truncDesc`）按 155 字符在词边界截断并加 `...`，产出
`"...practice tool by..."` 这类半句描述。

**改法**：优先在**句子边界**截断：
```js
function truncDesc(s, max) {
  max = max || 155;
  if (s.length <= max) return s;
  const head = s.substring(0, max - 1);
  // 先找最后一个句子结束符（中英文）
  const m = head.match(/^[\s\S]*[.!?。！？](?=[^.!?。！？]*$)/);
  if (m && m[0].length >= max * 0.6) return m[0].trim();
  return head.substring(0, head.lastIndexOf(' ')).replace(/[,;:，；：]$/, '') + '…';
}
```
（阈值 0.6：句子边界截掉太多时退回词边界，避免描述过短。）

**验收**：
- [ ] 重建后 `grep -o 'name="description" content="[^"]*"' characters/*/index.html | grep -c '\.\.\."'` = 0
- [ ] 抽查 5 个描述均为完整句或以 `…` 结尾的完整词组，长度 80–160

---

## 任务 7：性能小项 — preconnect 注入（全站后处理）

**改法**：仿照 `injectAnalytics()`（grep 该函数）写一个 `injectPreconnect()`，在 RUN ALL 里
紧跟 `injectAnalytics()` 调用：
- `walkHtmlFiles()` 遍历全部页面；
- 若页面含 `fonts.googleapis.com` 且不含 `rel="preconnect" href="https://fonts.gstatic.com"`，
  在第一个 `<link href="https://fonts.googleapis.com` 之前插入：
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ```
- 若页面含 `cdn.jsdelivr.net`（字符页的 hanzi-writer），再插入
  `<link rel="preconnect" href="https://cdn.jsdelivr.net">`；
- 幂等：插入前先检查标记是否已存在（重跑不重复插）。

**验收**：
- [ ] `grep -c "preconnect" characters/与/index.html` = 3；`grep -c "preconnect" index.html` = 2
- [ ] 连跑两次 build，preconnect 不重复
- [ ] 全站页面数不变

---

## 任务 8（Phase 2，先测量再动手）：/vocabulary/ 巨页优化

**现状**：`/vocabulary/` 单页 897KB（816KB 静态 HTML、1004 张词卡 + 40KB 内联 `WORD_TASKS` 数据）。
该页**目前是被收录的**，排名主关键词 "HSK 4 vocabulary list" —— 所以**不要激进拆页**，防止丢排名。

**执行顺序（严格按此顺序，每步之间观察 1–2 周 GSC/CWV 数据）**：

1. **测量**：PageSpeed Insights 跑 `/vocabulary/`（移动端），记录 LCP/INP/CLS 基线，存入 PR 描述。
2. **无风险瘦身**（不减少可索引内容）：
   - 把 `window.WORD_TASKS = {...}`（40KB）和交互脚本（15KB）从内联抽成外部文件
     `/vocabulary/app.js`（`defer`），HTML 直接减 55KB；
   - 词卡里重复的内联 style 收进 `common.css` 的 class（`buildVocabulary` 里 grep 内联 style 改 class），
     预期再减 100KB+。
3. **观察后再决定**是否做分片：若 CWV 仍差 / 收录无改善，再把 1000 词卡按 30 个任务话题
   （`/topics/` 已有对应页）改为"每话题前 10 词 + 链接到话题页看全量"，全量词卡移入各话题页。
   这一步**必须**保证每个词的卡片在全站至少有一处静态 HTML 存在。
4. 任务 9 上线后，每张词卡的词头链接到对应词详情页。

---

## 任务 9（Phase 2）：高价值词独立页（分批、达标才发布）

**原则**：绝不批量生成 1000 个模板词页（会复刻字符页的旧问题）。**达标线**：一个词只有凑齐
下面 A 组全部 + B 组至少 1 项，才允许生成页面：

- A（必须，数据现成）：词头/拼音/词性/释义 + 人工例句（`vocabulary.json`）+ 所属任务话题链接
  （`buildWordTaskMap`）+ 逐字拆解（每字链接到 `/characters/` 页）+ 模考 CTA + 面包屑 + LearningResource JSON-LD
- B（至少一项）：
  - ≥2 条真题例句（改造 `extractExamSentences` 返回带 test 编号的前 3 条，同任务 3 的模式）
  - 或该词属于某个易混词对（`confusables.json`，链接到 `/words/{pair}/` 页并嵌入对比摘要）

**实现要点**：
1. URL：`/vocabulary/{slug}/`，slug = 去声调拼音（`w.pinyin.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z]/gi,'').toLowerCase()`）；
   冲突时追加 `-{id}`。slug 生成必须确定性（同输入同输出）。
2. 新增 `buildWordPages()`，在 RUN ALL 中 `buildVocabulary()` 之后调用；返回 slugs 传给 sitemap（words 集群）。
3. 内链接入（缺一不可，防孤页）：
   - `/vocabulary/` 对应词卡的词头 → 词页
   - 字符页 "HSK 4 Words Containing X" 列表中的词 → 词页
   - `/topics/` 话题页词表中的词 → 词页
4. 页面结构直接仿照 `/words/{a}-vs-{b}/` 易混词页（现成合格样板，26KB 级、含测验）。
5. 首批规模预期：满足达标线的词约 300–500 个。**分两批提交**（先 100 个词验证 GSC 反应 2–4 周，再放量）。

**验收**：
- [ ] 生成页数与达标线过滤后的清单一致；不满足条件的词**没有**页面
- [ ] 抽查 3 页：真题句出处正确、逐字链接可达、JSON-LD 可解析
- [ ] sitemap-words.xml 包含全部新页；`/vocabulary/`、字符页、话题页三处都有入链

---

## 上线后监控清单（人工，写进 PR 描述）

1. GSC 重新提交 `sitemap.xml`；此后可在"索引 > 页面"按 5 个分 sitemap 过滤收录率。
2. 对 3 个代表页（`characters/与/`、`characters/按/`、任一新词页）用 URL 检查工具请求编入索引。
3. 记录基线：当前 `/characters/` 集群收录数（GSC 截图），4 周后对比。
4. 关注 "已抓取 - 尚未编入索引" 数量变化——这是本方案的核心 KPI。
5. `/vocabulary/` 的 CWV（PageSpeed 移动端）在任务 8 前后对比。

## 任务依赖关系

```
任务1(数据) ──> 任务2(模板推广) ──> 任务3(真题例句) ──> 任务4(笔顺图)
任务5(sitemap)、任务6(description)、任务7(preconnect)：相互独立，可穿插执行
任务8、任务9：Phase 2，等 Phase 1 上线且 GSC 有 2-4 周数据后再启动
```
