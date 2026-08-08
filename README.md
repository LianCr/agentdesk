# AgentDesk

**中英双语保险经纪人 AI 知识助手(演示项目) / Bilingual insurance-broker AI knowledge assistant (demo)**

## 一分钟看懂 One-minute overview

**谁使用 Who it serves**
面向中英双语保险经纪团队的内部演示助手。经纪人是使用者,持牌经纪人是最终审核者;它不面向客户直接销售。

**解决什么 What it solves**
客户用中文提问,产品资料是英文 PDF。AgentDesk 从英文资料中检索证据,用客户的语言解释,并给出**英文原文引用和页码**,让经纪人不必逐页翻 PDF。

**能做什么 What it can do**

- 中文/英文提问 → 检索英文产品文档 → 回答 + 原文引用 + `#page=N` 定位
- 产品比较**草稿**(逐格可追溯到引用)、缺失信息清单、风险标记
- 由确定性代码规则触发人工审核,经 n8n 推进 follow-up

**不能做什么 What it will not do**

- ❌ 不输出最终推荐、suitability 判断或"最好/保证/无风险"式结论
- ❌ 不编造引用:证据不足时拒答或降级为"需要更多资料"
- ❌ 不自动对外发送:所有 client-facing 内容必须人工批准
- ❌ 不使用真实客户数据:全部产品与客户均为**虚构**,每页 PDF 均带
  `DEMONSTRATION DOCUMENT — FICTIONAL PRODUCT — NOT FOR SALE`

## 当前状态 Current status: M5 — Guardrails、人审与 n8n

| Milestone | 内容 | 状态 |
|---|---|---|
| M1 | 数据合同、虚构产品 PDF 生成与自动验证 | ✅ 完成 |
| M2 | Ingestion 与 pgvector(3 文档 / 20 页 / 45 chunks 已入库) | ✅ 完成 |
| M3 | 双语 RAG、引用与拒答 + 可点击 Demo + 冻结评估 | ✅ 完成 |
| M3.1 | 评估脚本稳健性(重复运行统计) | ⏸ 非阻塞,M7 前完成 |
| M4 | 产品比较草稿(比较表、单元格引用、观察项、审核标记) | ✅ 完成 |
| M4.1 | 叙述稳定性与延迟 | ⏸ 非阻塞,M7 前完成 |
| M5 | Guardrails、人审与 n8n | ⬅ 当前 |
| M6 | Evaluation(≥25 题) | ⬜ |
| M7 | Vercel 部署与交付物 | ⬜ |

**M3 评估**(冻结 30 题 + 21 红队探针,详见 `docs/m3-evaluation.md`):
评估集已冻结并包含对抗性覆盖。重复运行暴露了评估脚本的误报和预期内的模型随机性,
因此报告把**确定性的引用/接地不变量**与**随机性质量指标**分开呈现:

- 确定性不变量(每次观察到的运行中均成立):渲染层无出处事实 **0**、引用错页码 **0**、
  无效引文 **0**、引用元数据由代码注入、评估全程数据库只读(3/20/45 前后不变);
- 随机性质量指标(按分布报告,会逐轮波动):证据状态与行为判定准确率、自由文本红队检测器、
  检索 hit@k、重试率与延迟。

重复运行的统计加固作为 **M3.1** 跟踪,在公开发布(M7)前完成,不阻塞 M4/M5/M6。

**M4 产品比较**(冻结 23 例结构化评估,详见 `docs/m4-evaluation.md`):
比较表**完全由代码生成**——模型不参与事实抽取、字段归属、数值比较、NA 判断、证据选择、
引用构造、观察项、缺失信息、审核标记与比较状态。

- 每个事实单元格可追溯到 documentId + 页码 + 逐字英文引文;结构化值与文档证据必须一致,
  不一致即 `conflict` 且**不显示任何值**
- 派生事实带溯源:年金"第 7 年"由退保费用表推导(指南全文没有 "seven"),
  与结构化字段对账,文案只说表格显示什么
- 客户上下文只影响缺失信息清单与审核标记,**从不改变产品事实**,也不产生排名
- 可选中性说明由守卫校验,失败时表格照常返回
- 评估结果:23/23 案例、**17 项确定性硬门全部通过**、数据库 3/20/45 未变;
  事实/可用性/引用/观察项/缺失信息/审核标记/状态/对称性准确率均 **100%**;
  确定性比较延迟中位数 **1 ms**
- 16 项变异测试证明评估器能够失败(注入错误引用、id 冲突、否定事实塌缩、推荐结论等)

## 使用方法 Usage

```bash
npm install
npx playwright install chromium

# M1 — 数据合同与 PDF
npm run validate:data       # 校验 products.json / cases / manifests(zod)
npm run generate:pdfs       # products.json → HTML → PDF(含溢出检查)
npm run generate:manifest   # 由 products.json + 实际 PDF 生成 manifest.json
npm run validate:pdfs       # SPEC §12 全部验收检查

# M2 — Ingestion 与 pgvector(需 .env,见 .env.example 与 supabase/README.md)
npm run extract:documents   # PDF → 确定性 pages/chunks fixtures(data/derived)
npm run validate:chunks     # fixtures 可复现性 + coverage + omission 检查
npm run db:push             # 应用 supabase/migrations
npm run ingest:products -- --embedding=openai   # 三份文档事务式入库(幂等)
npm run validate:ingestion  # 数据库与 fixtures 全量对账(只读)
npm run delete:document -- --document-id=test_…  # 仅限 test_ 文档
npm test / npm run test:db  # 离线套件 / 数据库集成套件

# M3 — 双语 RAG 与 Demo(需 OPENAI_API_KEY)
npm run dev                 # 打开 http://localhost:3000 体验可点击 Demo
npm run ask -- "定期寿险有现金价值吗？"   # CLI 有据问答
npm run retrieve -- "IUL 的 cap 是多少？" # 仅检索(调试)
npm run test:ui             # 浏览器 UI 测试(mock API)
npm run eval -- --out=evals/results/run.json  # 冻结评估 + 红队探针

# M5 — 人工审核工作流(进行中;见 docs/m5-review-workflow.md)
npm run review -- --a=doc_securerate5_v1 --b=doc_indexflex_ul_v1 --case=DEMO-2026-003
```

单一事实源:`data/fictional-products/products.json`。
PDF、manifest、表格单元格全部由它派生,同一数字不在两处手写维护。
设计意图与验收规则见 `data/fictional-products/SPEC.md`,工程规则见 `CLAUDE.md`。

## 目录 Key paths

- `data/fictional-products/` — 产品事实源、模板、生成的 PDF 与 manifest
- `data/synthetic-cases/` — 虚构客户 Case A(低风险)/ B(中风险)/ C(高风险替换)
- `data/public-documents/` — 公开监管指南的官方下载说明(第三方 PDF 不入库)
- `scripts/` — 生成与验证脚本
- `lib/schemas.ts` — 所有数据边界的 zod schema

## 免责声明 Disclaimer

本项目为技术演示。所有产品、carrier、费率与客户均为虚构;输出不构成保险建议、
suitability 判断、税务或法律意见。真实使用前须由合规人员与持牌经纪人确认。
