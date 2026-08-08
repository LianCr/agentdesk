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

## 线上 Demo Live demo

**https://agentdesk-acme307.vercel.app** — 无需登录,直接可用。
部署与环境变量见 `docs/deployment.md`。

> 该 URL 无认证,`/api/answer` 与 `/api/transcribe` 会消耗 OpenAI 额度。

## 当前状态 Current status: M7 — Deploy & Portfolio Polish

| Milestone | 内容 | 状态 |
|---|---|---|
| M1 | 数据合同、虚构产品 PDF 生成与自动验证 | ✅ 完成 |
| M2 | Ingestion 与 pgvector(3 文档 / 20 页 / 45 chunks 已入库) | ✅ 完成 |
| M3 | 双语 RAG、引用与拒答 + 可点击 Demo + 冻结评估 | ✅ 完成 |
| M3.1 | 评估脚本稳健性(重复运行统计) | ⏸ 非阻塞,M7 前完成 |
| M4 | 产品比较草稿(比较表、单元格引用、观察项、审核标记) | ✅ 完成 |
| M4.1 | 叙述稳定性与延迟 | ⏸ 非阻塞,M7 前完成 |
| M5 | 人工审核工作流(四轴路由、不可变快照、原子审计) | ✅ 完成 |
| M5.1 | 审核后自动化(内部任务 + n8n webhook + mock fallback) | ✅ 完成 |
| M6 | Demo Acceptance(10 场景端到端验收) | ✅ 完成 |
| M7-A | Vercel 部署与视觉打磨 | ✅ 完成 |
| M7-B | Portfolio 交付物(视频、一页纸、README 重写) | ⬅ 当前 |

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

**M5 人工审核工作流**(冻结 41 例结构化评估,详见 `docs/m5-evaluation.md`):
把"需要审核"这个徽章变成一件办得完、查得到的事。

- **服务端拥有审核项**:浏览器只能提交标识符与人写的决定文本;事实、引用、flags、
  路由、审核者与 actor 一律服务端重建
- **不可变比较快照**:创建时冻结确定性内核并按规范化 JSON 取 sha256,
  触发器拒绝任何修改——半年后回看,决定仍然指向当时被看到的那张表
- **确定性路由**:`comparisonStatus` / `workflowDecision` / `requiredApprovalLevel` /
  `reviewState` 四轴永不合并,模型无法触及任何一个
- **人做决定**:批准 / 拒绝 / 要求修改;拒绝与修改必须写下理由(先 trim 再判长度)
- **原子审计轨迹**:创建与决定各自在一个事务内完成"写状态 + 追加事件",append-only
- **陈旧写入保护**:两个标签页竞态时先到者成立,后到者得到 409,只有一条终态事件
- 评估结果:**41/41 用例、19 项确定性硬门全部为 0**,21 项变异测试证明评估器能失败;
  核心验收**完全不依赖模型行为**;数据库 3/20/45 未变

**M6 Demo 验收**(详见 `docs/demo-acceptance.md`):把产品当作保险经纪公司负责人会
看到的样子端到端跑了 10 个场景 —— 中文提问、资料缺失拒答、安全边界、产品比较、
SecureRate 5 年/7 年错配、Case C、送交审核、人工决定、审核后自动化、桌面与手机
UX 巡检。**10/10 可用**,并修复了两个只有真正跑 demo 才会暴露的缺陷:窄屏下比较表
把页面撑宽(而不是自己滚动),以及 mock 运行后按钮文案看起来像没运行过。

本项目不声称任何合规认证。"本演示工作流内已批准"仅表示审核者认可了本演示工作流中的
一个内部步骤,不构成适合性判断、承保方核准、合规或法律批准、报价有效性或购买建议。

**M5.1 审核后自动化**(详见 `docs/m5-1-automation.md`):
人做完决定之后,系统才产生后续工作 —— 而且**只产生内部任务**。

- `approved` → 内部跟进任务;`revision_requested` → 内部修改任务(带审核者原话);
  `rejected` → **不产生任何自动化**
- **Case C 只产生内部任务**:`TaskType` 枚举里没有 client-facing 值,payload 里
  没有收件人字段 —— "不会误发给客户"不是一条规则,是系统里不存在能发的东西
- n8n webhook + **mock fallback**:未配置 webhook 时明确显示"演示模式,未实际发送",
  绝不写成"已投递";Demo 在没有任何外部基础设施时也能完整走通
- **重复触发保护**:幂等键 = `reviewId:终态事件id`,唯一索引即是锁;双击、并发、
  重复请求都只产生一个任务
- 投递失败**绝不回滚人类决定**:两张表,且自动化代码没有任何路径能写回审核项

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
# 示例问题使用已核验的预存回答以便快速演示;自由提问始终实时运行完整 RAG 流程。
# Preset demo questions use pre-verified cached responses for fast presentation;
# free-form questions always run the live grounded RAG pipeline.
# 语音输入 Voice input:知识助手页面的麦克风按钮 → 转写进输入框(需 OPENAI_API_KEY);
# 转写结果**不会自动提交**,由使用者确认后再点「提问 Ask」
npm run retrieve -- "IUL 的 cap 是多少？" # 仅检索(调试)
npm run test:ui             # 浏览器 UI 测试(mock API)
npm run eval -- --out=evals/results/run.json  # 冻结评估 + 红队探针

# M5 — 人工审核工作流(进行中;见 docs/m5-review-workflow.md)
npm run review -- --a=doc_securerate5_v1 --b=doc_indexflex_ul_v1 --case=DEMO-2026-003
npm run dev                 # /compare 送交审核 → /review 队列 → /review/<id> 决定 → 运行自动化
npm run eval:workflow -- --out=evals/results/m5-final.json   # 冻结工作流评估
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
