# 内链模型 / Internal Linking Model

> 本站内链架构的设计文档。所有"由 build.js 生成"的模块在每次 `node build.js` 时自动重建，
> 不需要手工维护；手工维护的模块已在表中标注。

---

## 1. 设计原则

1. **三跳可达**：任何页面距首页 ≤ 3 次点击（首页 → hub → 详情页）。
2. **无孤页**：每个页面至少有 1 个非 sitemap 的入站链接。sitemap 只是兜底，不是主要发现渠道。
3. **集群闭环**：同一主题集群（cluster)内部互链，把权重留在集群里；集群之间只通过"语义相关"的横向链接连接，不滥连。
4. **链接随数据走**：链接模块尽量在 build.js 里由数据（vocabulary.json / topics.json / grammar-patterns.json / test-XX.json）生成，数据变了链接自动变，避免失修。
5. **锚文本带关键词**：中英双语锚文本（如 "把字句 (Ba-Sentence)"），不用 "click here"。
6. **转化导向**：所有学习页都有一条回到模拟考试（mock exams）的 CTA 路径——这是商业漏斗的终点。

---

## 2. 站点层级（金字塔）

```
L0  首页 /                                  ←  全站权重入口
     │
L1  10个 Hub: /vocabulary/ /characters/ /grammar/ /sentences/
     /strategies/ /topics/ /words/ /compare/ /traps/ /guide/
     │
L2  详情页（5 大集群）:
     · 考试集群:   /test/01..12/
     · 词汇集群:   /topics/{30个任务}/ · /words/{43对易混词}/
     · 汉字集群:   /characters/{150书写字}/
     · 语法集群:   /grammar/{14专题}/ · /grammar/patterns/{8句型}/
     · 策略集群:   /strategies/{9篇}/ · /writing/{2}/ · /compare/{3}/
```

---

## 3. 链接模块清单（按页面类型）

| 页面 | 出站链接模块 | 生成方式 |
|------|------------|---------|
| 全站 | 顶部导航（11 hub）+ 页脚（5 链接 + 许可） | 模板内置 |
| 首页 | ① 工具卡片网格（→ 全部 hub + compare 3 页）② 30 任务清单（→ 30 个 /topics/ 任务页）③ noscript 测试列表（→ 12 套题）④ 攻略/计划区（→ strategies） | build.js `buildHomepage` |
| /topics/ hub | 任务导航卡（→ 30 个任务页）+ 按话题分组的静态词表 | build.js `buildTaskTopicPages` 注入 |
| 任务页 /topics/{slug}/ | 面包屑 · 相关语法（→ /grammar/...）· 上/下一个任务 · 模考 CTA | build.js（数据驱动：task.grammar） |
| /grammar/ hub | 14 专题卡 + 句型入口 | 手工 + build |
| 句型页 /grammar/patterns/{slug}/ | 面包屑 · **真题示例（→ 对应 /test/XX/）** · 上/下一句型 · 易混句型对比链 | build.js（扫描 12 套题文本自动配真题） |
| /grammar/patterns/ hub | 8 句型卡 + 回 /grammar/ | build.js `buildGrammarPatternsHub` |
| 测试页 /test/XX/ | 面包屑 · 分题型攻略网格（→ 9 strategies）· 词汇/语法/句子/compare 内文链 · 全部测试回链 | build.js `buildTestPages` |
| 字符页 /characters/{字}/ | 面包屑 · 含该字的词（→ 词汇）· 字符 hub 回链 | build.js `buildCharacterPages` |
| 易混词页 /words/{a}-vs-{b}/ | 面包屑 · 相关词汇/语法链 · 真题引用 | build.js |
| /vocabulary/ | SEO 文案内嵌任务页链接（4 个示例任务 + /topics/ 总入口）· 语法专题链 | build.js `buildVocabulary` |
| /guide/ | 新旧对比页链接 · 词汇/语法/测试链 · 30 任务清单 | 静态 + `fixGuide` 规范化 |
| /compare/* | 互相链接 + guide/vocabulary/characters/topics 相关卡 | 静态 |
| 404.html | 6 个最高价值入口卡 | 静态 |

## 4. 横向语义链（cluster 之间的固定通道）

只保留这些有语义理由的跨集群通道，避免"什么都链什么"：

- 任务页 → 语法专题（task.grammar 字段定义，最多 2 条）
- 句型页 → 测试页（自动匹配的真题，最多 2 条）
- 测试页 → 策略页（按题型一一对应）
- 字符页 → 词汇（含该字的词）
- guide/compare → 词汇·汉字·任务·语法（备考路径）
- 一切学习页 → 模拟考试 CTA（漏斗终点）

## 5. 锚文本规范

- 中文关键词 + 英文说明：`把字句 (Ba-Sentence)`、`HSK 4 vs HSK 3`
- 任务页锚文本用官方任务名：`谈论某个人物 — Discuss a person`
- 禁止：`点这里`、`more`、裸 URL

## 6. 已知待办（后续迭代）

- [ ] 词汇卡片（1000 个）→ 对应任务页/语法页的逐词链接（需控制页面体积，建议随分页改造一起做）
- [ ] 字符页 → 所属任务页（通过 word_topics 反查）
- [ ] sentences/traps 两个 hub 的下钻内容与互链
- [ ] 为 43 个易混词页补"相关易混词"侧栏（同声旁/同语义场）

---

*维护规则：新增 L2 页面时，必须同时（1）挂到所属 hub 的列表模块，（2）加进 build.js 的 sitemap
existingPages 或对应生成器返回值，（3）至少配置 1 条横向语义链。*
