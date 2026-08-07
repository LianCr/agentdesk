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

## 当前状态 Current status: M1 — 数据合同与 PDF 生成 ✅

| Milestone | 内容 | 状态 |
|---|---|---|
| M1 | 数据合同、虚构产品 PDF 生成与自动验证 | ✅ 完成 |
| M2 | Ingestion 与 pgvector | ⬜ |
| M3 | 双语 RAG、引用与拒答 | ⬜ |
| M4 | 产品比较草稿 | ⬜ |
| M5 | Guardrails、人审与 n8n | ⬜ |
| M6 | Evaluation(≥25 题) | ⬜ |
| M7 | Vercel 部署与交付物 | ⬜ |

## M1 使用方法 M1 usage

```bash
npm install
npx playwright install chromium

npm run validate:data       # 校验 products.json / cases / manifests(zod)
npm run generate:pdfs       # products.json → HTML → PDF(含溢出检查)
npm run generate:manifest   # 由 products.json + 实际 PDF 生成 manifest.json
npm run validate:pdfs       # SPEC §12 全部验收检查
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
