# HSK4 Mock Exam — Content Plan

> Based on analysis of 《新版HSK考试大纲1219》(406 pages) and HSK4_Vocabulary_MandarinZone_2026.pdf (65 pages, 1000 words)

---

## Data Sources

| Source | Content | Pages |
|--------|---------|-------|
| 新版HSK考试大纲1219.pdf | Official 2025 HSK 3.0 syllabus (published 2025-11, effective 2026-07) | 406 |
| HSK4_Vocabulary_MandarinZone_2026.pdf | 1000 HSK4 words with pinyin, POS, meaning, example sentences (CN+EN) | 65 |

---

## Site Architecture

```
/                              → Mock exams (existing)
/vocabulary/                   → Interactive vocabulary tool (search, filter, flashcards, progress)
/grammar/                      → Grammar overview
/grammar/{topic}/              → Individual grammar topics with exercises
/words/{word-a}-vs-{word-b}/   → Confusable word pairs with quizzes
/guide/                        → Study guide & new HSK4 exam overview
```

### Internal Linking Strategy

```
Homepage (Mock Exams)
  ├── Study Guide ←→ Vocabulary
  │     ↕              ↕
  │   Grammar ←→ Confusable Words
  │     ↕
  └── Mock Exams ←── CTA from all pages
```

Every page includes:
- Breadcrumb navigation
- Related content sidebar/footer
- "Test yourself with mock exams" CTA → links back to homepage

---

## Content Strategy: Tools Over Information

**Core Principle:** AI can replace information, but cannot replace tools and experiences.

Each page follows this structure:
1. **SEO hook** (short text explanation, 200-300 words) — brings search traffic
2. **Interactive tool** (quizzes, flashcards, progress tracking) — the real value AI can't provide
3. **Funnel exit** — CTA to mock exams

---

## Priority 0: Vocabulary Tool

**URL:** `/vocabulary/`

**Target keywords:** `HSK 4 vocabulary list`, `HSK4 词汇表`, `新HSK4词汇`

**Data source:** HSK4_Vocabulary_MandarinZone_2026.pdf — 1000 words with example sentences

**Features:**
- Search box + filters (by topic, POS, mastered/unmastered)
- Stats bar: "Mastered 230/1000 · New today 15"
- Default view: grouped by topic (7 categories from syllabus)
- Collapsed cards: 汉字 + pinyin + POS + meaning
- Expanded cards: + example sentence + related grammar link + mock exam link
- Progress tracking via localStorage
- Study modes:
  - Flashcard mode: show Chinese → guess English → flip → mark known/unknown
  - Quiz mode: given meaning, pick correct word from 4 choices
  - Dictation mode: play pinyin → type character
- PDF download link

**Differentiation vs competitors:**
- Competitors: bare lists (character + pinyin + translation), no context
- Ours: every word has example sentence + usage context + linked to grammar & mock exams
- Interactive practice modes (competitors are read-only)
- Progress tracking (AI conversations are stateless)

---

## Priority 1: Grammar Topics with Exercises

**URL:** `/grammar/` (overview) + `/grammar/{topic}/` (individual)

**Target keywords:** `HSK4 语法`, `HSK 4 grammar points`, `把字句 用法`, `被字句`, etc.

### HSK4 Grammar Points (from syllabus p.395-397)

**Word Classes:**
- 能愿动词: 敢
- 指示代词: 各、各位、各种、任何、此
- 名量词: 打、袋、棵、台、幅 / 借用: 脸、手、盒、屋子、桌子
- 动量词: 场、顿、趟
- 程度副词: 十分、更加、稍、稍微、尤其、多么
- 范围副词: 共、全、光、仅、仅仅、至少
- 时间副词: 按时、从来、赶紧、赶快、已、忽然、将、将要、从、本来
- 频率副词: 重新、往往、偶尔、再次、老
- 方式副词: 故意、互相、相互
- 关联副词: 却
- 情态副词: 也许、恐怕
- 语气副词: 才4、就5、并1、还4、竟然、究竟、正好、到底、难道、千万、确实、只好、差(一)点儿
- 介词: 自、当、由、随着、等、将、叫、让、由于、对于、与、作为、按、按照
- 连词: 并、而、与、此外、甚至、不过、并且、不光、不仅、另外、要是、因此、由于、加上
- 助词: 等、者、之、就是
- 叹词: 啊、嗯

**Phrases & Fixed Patterns:**
- 四字格: 一A一B、无A无B、有A有B
- 固定格式: 来得及/来不及、有的是、说不定、不怎么、就是说
- 一+量词+比+一+量词、在……方面、够……的、拿……来说、再也不/没……
- 怎么都/也+不/没……、为了……而……、动词+一X是一X
- (没)有什么(好)X的、X是X Y是Y、X也得X 不X也得X
- X就是了、还X呢、你X你的吧、让/叫你X你就X
- 说什么/怎么(着)也得X、X就X(点儿)吧、X是X

**Sentence Patterns:**
- 程度补语2: 形容词/心理动词+死了/厉害
- 可能补语2: 动词+得/不+了
- 反问句2: 难道……吗？/ 疑问代词反问句
- 把字句2 (4 types)
- 被动句2: 叫/让+O+V+其他
- 兼语句2 (3 types: 表爱憎、称谓认定、致使)
- 比较句3: A不如B / 跟……相比
- 双重否定句

**Complex Sentences:**
- 并列: 不是…而是 / 既…又/也 / 一方面…另一方面
- 承接: 首先…其次 / 首先…然后 / 于是
- 递进: 甚至 / 不仅/不光…还/而且 / 并且 / 连…也/都…更
- 选择: 不是…就是
- 转折: 尽管…但是/可是 / 然而 / 不过 / X是X 就是/不过
- 假设: 否则 / 要是…就 / 要是…否则
- 条件: 不管…都/也 / 无论…都/也
- 因果: 既然…就 / (由于)…因此
- 目的: …好…
- 让步: 即使…也 / 就是…也
- 紧缩: 无标记 / 不…也…

### Proposed Grammar Pages (~15-20 pages)

Each page structure: formula → examples (correct/incorrect) → common errors → 5 mini quiz questions → related grammar links

| Page | Target Keyword | Content |
|------|---------------|---------|
| `/grammar/ba-sentence/` | 把字句 用法 | 4 HSK4 patterns + HSK3 review + common errors |
| `/grammar/passive-bei/` | 被字句 被动句 | 被/叫/让 patterns + contrast with 把 |
| `/grammar/comparison/` | 比较句 中文 | 不如、跟…相比 + HSK3 review (比/一样) |
| `/grammar/complement/` | 中文补语 | 程度(死了)、可能(得/不了) |
| `/grammar/complex-sentences/` | HSK4 复句 | All complex sentence types with exercises |
| `/grammar/adverbs/` | HSK4 副词 | 竟然/究竟/到底/难道/千万/确实/只好 |
| `/grammar/conjunctions/` | HSK4 连词 | 尽管/即使/不管/无论/既然 |
| `/grammar/prepositions/` | HSK4 介词 | 对于/关于/由于/按照/作为 |
| `/grammar/rhetorical-questions/` | 反问句 | 难道…吗 + 疑问代词反问 |
| `/grammar/double-negation/` | 双重否定句 | Patterns + exercises |
| `/grammar/pivotal-sentences/` | 兼语句 | 3 types with examples |
| `/grammar/fixed-patterns/` | HSK4 固定格式 | 四字格 + all fixed patterns |
| `/grammar/measure-words/` | HSK4 量词 | 打/袋/棵/台/幅 + borrowed MWs |

**Key differentiation:** Show progression chain (HSK3 → HSK4 → HSK5) for each grammar point, not just isolated explanation.

---

## Priority 2: New HSK4 Study Guide

**URL:** `/guide/`

**Target keywords:** `HSK 4 study guide`, `HSK4 备考`, `新HSK4 考试`, `新HSK4变化`

**Time-sensitive advantage:** Syllabus published 2025-11, effective 2026-07. Window of opportunity.

**Content:**
- New vs old HSK4 comparison
- Exam structure & scoring
- 30 task scenarios explained
- Study roadmap with timeline
- HSK3→4 gap analysis: "5 ability thresholds to cross"

---

## Priority 3: Confusable Word Pairs

**URL:** `/words/{word-a}-vs-{word-b}/`

**Target keywords:** long-tail searches like `关于和对于的区别`, `difference between 对 and 对于`

Each page: short explanation + 3-5 quiz questions + links to vocabulary page and grammar page.

### Candidate word pairs (from HSK4 vocabulary):

From cross-level words (32 words with multi-level meanings):
- 棒 (adj HSK4 vs noun HSK5)
- 不过 (conj HSK4 vs adv HSK5)
- 出口 (noun HSK4 vs verb HSK5)
- 经济 (noun HSK4 vs adj HSK5)
- 死 (verb/adj HSK4 vs adv HSK5)

Synonym/near-synonym pairs to mine from 1000 words:
- 关于 vs 对于
- 因为 vs 由于
- 虽然 vs 尽管
- 不管 vs 无论
- 即使 vs 就是
- 按时 vs 准时
- 安排 vs 计划
- 保护 vs 保证
- 表示 vs 表现 vs 表扬
- 不断 vs 不停
- 成功 vs 成为
- 从来 vs 一直
- 到底 vs 究竟
- 故意 vs 特意
- 忽然 vs 突然
- 坚持 vs 支持
- 减少 vs 降低
- 竟然 vs 居然
- 适合 vs 符合
- 重视 vs 尊重

Target: 30-50 pages total.

---

## Priority 4: Mock Exam Results Analysis

After completing a mock exam, show:
- Section breakdown (listening/reading/writing scores)
- Weak grammar points identified from wrong answers
- Recommended practice links to grammar/vocabulary pages
- Historical progress chart

---

## HSK4 Syllabus Cross-Level Analysis

### HSK3 → HSK4 Ability Progression

| Dimension | HSK3 | HSK4 |
|-----------|------|------|
| Complexity | 简单 (simple) | 有一定复杂度 (some complexity) |
| Fluency | 能简单介绍 (can simply introduce) | 能比较流利地介绍 (can introduce fairly fluently) |
| Writing | 写出一两句话 (write 1-2 sentences) | 写出一段话 (write a paragraph) |
| Reading | 看懂简单小短文 (understand simple short texts) | 看懂一般性短文 (understand general short texts) |
| Thinking | Describe facts | Express 感受 (feelings) and 看法 (opinions) |

### HSK4 → HSK5 Ability Progression

| Dimension | HSK4 | HSK5 |
|-----------|------|------|
| Complexity | 有一定复杂度 | 较复杂 (fairly complex) |
| Fluency | 比较流利地 | 较流畅地 (fairly smoothly) |
| Writing | 写出一段话 (a paragraph) | 写出短文 (a short essay) |
| Reading | 一般性短文 (general short texts) | 一般性文章 (general articles) |

### Topic Expansion at HSK4

New topic category at HSK4: **科学技术** (Science & Technology) — completely absent in HSK3.

New cultural topics at HSK4: 俗语名言, 名胜古迹, 历史人物 — absent in HSK3.

### 32 Cross-Level Words

Words that appear at HSK4 with additional meanings at higher levels:

| # | Word | Pinyin | HSK4 meaning | Higher level |
|---|------|--------|-------------|-------------|
| 1013 | 棒 | bàng | adj: great | +noun at HSK5 |
| 1033 | 表 | biǎo | noun: table/watch | +verb at HSK7-9 |
| 1047 | 不过 | búguò | conj: however | +adv at HSK5 |
| 1086 | 重 | chóng | adv: again | +verb at HSK5 |
| 1089 | 出口 | chūkǒu | noun: exit | +verb at HSK5 |
| 1139 | 倒 | dào | verb | +adv at HSK6 |
| 1147 | 等 | děng | particle | +noun/MW at HSK5 |
| 1173 | 队 | duì | noun: team | +MW at HSK5 |
| 1179 | 顿 | dùn | MW | +verb at HSK7-9 |
| 1220 | 干 | gān | adj: dry | +noun at HSK5 |
| 1272 | 管 | guǎn | verb: manage | +noun/MW at HSK5 |
| 1359 | 奖 | jiǎng | noun: prize | +verb at HSK5 |
| 1367 | 交 | jiāo | verb | +noun at HSK7-9 |
| 1396 | 经济 | jīngjì | noun: economy | +adj at HSK5 |
| 1407 | 究竟 | jiūjìng | adv: after all | +noun at HSK5 |
| 1436 | 空 | kōng | adj: empty | +adv at HSK5 |
| 1445 | 困 | kùn | adj: sleepy | +verb at HSK5 |
| 1469 | 连 | lián | prep: even | +verb/adv at HSK5 |
| 1480 | 另 | lìng | pronoun: other | +adv at HSK6 |
| 1642 | 深 | shēn | adj: deep | +adv at HSK5 |
| 1647 | 生 | shēng | adj: raw | +adv at HSK7-9 |
| 1703 | 死 | sǐ | verb/adj: die/dead | +adv at HSK5 |
| 1713 | 所有 | suǒyǒu | adj: all | +verb/noun at HSK5 |
| 1714 | 台 | tái | MW | +noun at HSK5 |
| 1743 | 通 | tōng | verb/adj | +MW at HSK7-9 |
| 1750 | 痛 | tòng | adj: painful | +adv at HSK7-9 |
| 1752 | 图 | tú | noun: picture | +verb at HSK7-9 |
| 1754 | 土 | tǔ | noun: earth | +adj at HSK6 |
| 1975 | 准 | zhǔn | adj: accurate | +adv at HSK5 |
| 1987 | 组 | zǔ | noun: group | +verb/MW at HSK5 |
| 1990 | 左右 | zuǒyòu | noun: approximately | +verb at HSK7-9 |
| 1999 | 作用 | zuòyòng | noun: function | +verb at HSK6 |

### HSK4 Grammar Progression Chain

**把字句 progression:**
- HSK3: 3 basic patterns (把+O+V+在/到, 把+O₁+V+给+O₂, 把+O+V+result/direction complement)
- HSK4: +4 new patterns (把+O+V一V, 把+O+V了, 把+O+V+duration/frequency, 把+O+状语+V)
- HSK5: +1 pattern (把+O+一+V)

**被动句 progression:**
- HSK3: 被+O+V+other
- HSK4: 叫/让+O+V+other
- HSK5: 被/叫/让+O+给+V+other

**比较句 progression:**
- HSK2: A比B+adj, A有/没有B+adj
- HSK3: A跟B一样, A不比B+adj, A比B+多/少+V+数量
- HSK4: A不如B, 跟…相比
- HSK5: A+adj+B+数量补语

**复句 progression:**
- HSK3: 虽然…但是, 因为…所以, 如果…就, 只有…才, 只要…就
- HSK4: +尽管…但是, 既然…就, 不管…都, 无论…都, 即使…也, 不是…而是, 连…也/都
- HSK5: +一旦…就, 假如…就, 万一…就, 哪怕…也, 不但没…反而

---

## HSK4 30 Task Scenarios (Content Generation Framework)

Each task = potential reading passage + writing exercise + quiz questions.

### Daily Life (Tasks 1-11)
1. 谈论某个人物 — describe a person (appearance, personality, background)
2. 处理日常事务 — handle affairs (courier, documents, membership, legal help)
3. 日常言语交往 — social expressions (praise, congratulate, encourage, apologize)
4. 谈论情感话题 — emotions (love, friendship, family bonds, ideals)
5. 介绍饮食情况 — food (taste, types, restaurants, cooking process)
6. 谈论交通出行 — travel (transport, itinerary, hotels, driving)
7. 购物体验 — shopping (online, brands, discounts, payment)
8. 就医与健康 — health (symptoms, injuries, health concepts)
9. 休闲度假 — leisure (reading, sports, fitness, travel, parties)
10. 居住与社区 — housing (neighborhood, community services, renting/buying)
11. 家庭生活 — family (daily life, relationships, growth, habits, chores)

### Education (Tasks 12-14)
12. 教学与学习 — study (courses, majors, exams, scholarships, methods)
13. 校园生活 — campus (canteen, library, playground, graduation)
14. 教育现象 — education issues (family education, social education, career education)

### Workplace (Tasks 15-16)
15. 工作与表现 — work (office tasks, performance, colleague relations, team building)
16. 职业经历 — career (job hunting, internship, recruitment, interview, salary)

### Nature & Environment (Tasks 17-18)
17. 自然情况 — nature (geography, climate, animals, plants, natural phenomena)
18. 环保 — environment (pollution, conservation practices, regulations)

### Science & Technology (Task 19)
19. 科技应用 — tech (mobile payment, drones, popular science, research)

### Contemporary Society (Tasks 20-22)
20. 中国省市民族 — China overview (capital, provinces, ethnic minorities)
21. 经济现象 — economy (trending products, e-commerce, short video commerce)
22. 社会现象 — society (marriage views, consumer culture, internet life)

### Arts & Sports (Tasks 23-24)
23. 文艺 — arts (novels, films, theater, singers, writers)
24. 体育 — sports (table tennis, volleyball, competitions, sports celebrities)

### Culture & Tradition (Tasks 25-30)
25. 中外友好 — international friendship (sister cities, study abroad, Chinese competitions)
26. 俗语名言 — proverbs & famous quotes
27. 传统饮食文化 — food culture (dining etiquette, regional cuisines, old brands)
28. 风俗传统 — customs (Spring Festival, Mid-Autumn, kung fu, Peking opera, etiquette)
29. 名胜古迹 — landmarks (Tiananmen, Great Wall)
30. 历史人物事件 — history (Confucius, Laozi)

---

## SEO Technical Checklist

- [ ] Unique `<title>` and `<meta description>` per page (bilingual CN+EN keywords)
- [ ] Schema.org structured data (`Article`, `FAQPage`, `Quiz`)
- [ ] `hreflang` tags (zh/en)
- [ ] Internal `<a>` links between pages (not JS navigation, crawler-visible)
- [ ] Update `sitemap.xml`
- [ ] One H1 per page, clear H2/H3 hierarchy
- [ ] Breadcrumb navigation
- [ ] PDF download for vocabulary (proven high-engagement feature)
- [ ] Mobile-responsive design (existing CSS is already responsive)

---

## Anti-AI-Cannibalization Strategy

**Problem:** Pure informational content (grammar explanations, word definitions) gets answered directly by AI, resulting in zero clicks.

**Solution:** Every page provides value AI cannot:

| Feature | Why AI Can't Do This |
|---------|---------------------|
| Interactive quizzes with scoring | AI conversations are stateless |
| Progress tracking (localStorage) | AI has no persistent memory |
| Audio playback for listening | AI can't play audio files |
| Personalized weak-point analysis | AI has no user history |
| PDF downloads | AI can't generate formatted PDFs |
| Timed mock exam simulation | AI is not a testing tool |
| Visual progress dashboard | AI is text-only |

**Content formula per page:**
1. Short text (SEO hook, 200-300 words) — this part AI can also answer
2. Interactive exercises (70% of page) — AI cannot replicate
3. CTA to mock exams — conversion funnel
