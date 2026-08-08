# M5 — 人工审核工作流 Human Review Workflow

状态:**进行中**。M5-A(契约、路由规则、持久化、原子决定)与 M5-B(审核项创建、
不可变快照、确定性核对清单、CLI)已实现;M5-C(网页)与 M5-D(评估收口)未开始。
本文只描述**已经存在的代码**。

## 1. 四个互不替代的轴

CLAUDE.md §4 要求不得把风险、内部可用性、对外可发送性混为一个字段。M5 落实为四轴:

| 轴 | 取值 | 谁决定 |
|---|---|---|
| `comparisonStatus` | `complete` / `partial` / `blocked` | 代码(M4)——**事实**是否可信 |
| `workflowDecision` | `allow_internal_draft` / `allow_checklist_only` / `block_client_draft` | 代码(`lib/guardrails/rules.ts`)——能走到哪一步 |
| `requiredApprovalLevel` | 五值(CLAUDE.md §4.3) | 代码(同上)——需要多高的人类权限 |
| `reviewState` | `pending_review` / `approved` / `rejected` / `revision_requested` | **人** |

四轴永不合并。典型组合:`complete` + `block_client_draft` +
`licensed_agent_required` + `pending_review` —— 事实全部核实无误,但按本 Demo 规则
不得对外,必须持牌经纪人过目,现在还没人看。`comparisonStatus=blocked`
**永远不会**变成"被审核者拒绝"——那是事实层的问题,与人无关。

## 2. 路由规则(`lib/guardrails/rules.ts`)

纯函数,零 IO,零模型。输入是 M4 已经算好的 `ReviewFlag[]`,**不新建第四套词表**。
优先级自上而下,第一条命中即返回:

| 条件 | workflowDecision | requiredApprovalLevel |
|---|---|---|
| `comparisonStatus === "blocked"` | `allow_checklist_only` | `blocked` |
| `REPLACEMENT_CONTEXT` 或 `AGE_65_PLUS` | `block_client_draft` | `licensed_agent_required` |
| `NON_GUARANTEED_ELEMENTS` / `ILLUSTRATION_REQUIRED` / `SPECIFIC_VALUE_REQUEST` | `allow_internal_draft` | `enhanced_review` |
| 其余 | `allow_internal_draft` | `standard_approval` |

模型输出不是这个函数的输入,因此**无法**改变路由结果(CLAUDE.md M5 验收第 4 条)。

## 3. 创建审核项:服务端重建,浏览器只送标识符

`lib/reviews/create-review.ts` 的入参 schema 是 `.strict()` 的,只接受
`productAId` / `productBId` / `clientCaseId`。事实、引用、flags、路由、清单全部由服务端
用已提交的数据重建。客户端不可能提交伪造的事实单元格、伪造的引用或伪造的
`workflowDecision`——这些字段根本不在任何请求 schema 里。

### 幂等键 `sourceKey`

```
comparison_draft:<两个 documentId 排序后>+<...>:<caseId 或 no_client>
```

产品顺序是**呈现**,不是事实(M4 已证明事实对称),因此调换 A/B 两列不会产生第二个
待审项。部分唯一索引 `review_items_open_source_idx` 保证同一 `sourceKey` 同时最多
一个 `pending_review`;重复创建返回既有条目(`action: "existing_pending"`)。
快照仍保留第一位调用者选择的列顺序。

### 原子创建

`create_review_item` RPC 在**一个事务**内完成 `pg_advisory_xact_lock` → 事务内 recheck →
插入条目 → 插入 `REVIEW_CREATED` 事件。不存在"条目已建但没有创建事件"的窗口。
这是仓库既有 idiom(`ingest_replace_document`、`decide_review_item`)的第三次应用。

## 4. 不可变快照

审核者必须审阅一个**稳定物件**。`lib/reviews/snapshot.ts` 冻结确定性内核:两个产品、
客户上下文、13 个维度(含逐格引用与派生溯源)、观察项、缺失信息、`comparisonStatus`、
审核标记、免责声明、引擎版本号。

**刻意排除**:可选叙述(模型产物,不是被审对象)、单次运行的延迟与模型名(不是这份
物件的属性)。

`snapshotSha256` 对**规范化 JSON**(键名递归排序)取 sha256,因为 `jsonb` 不保留键顺序,
往返之后按原样序列化会得到不同哈希。数据库触发器
`review_items_freeze_artifact()` 拒绝任何对 `snapshot` / `snapshot_sha256` /
`source_type` / `source_key` / `workflow_decision` / `required_approval_level` /
`review_reasons` / `checklist` / `created_at` 的 UPDATE。

## 5. 确定性核对清单(`lib/reviews/checklist.ts`)

- **替换情形**(`replacementContext === true` 且 `block_client_draft`):**逐字**取自
  Case C fixture 的 8 条 `requiredChecklistItems`。不引入任何来自通用知识的法规条目。
- **其余**:由 `missingClientInformation` 生成,复用 UI 已有的字段中英文案。
- 重复项折叠:`currentSurrenderCharge` 等四个缺失字段与对应的替换清单项是同一件事,
  只出现一次。
- 无客户上下文 → 空清单(不为没有客户的比较发明客户问题)。

每条带 `sourceKind`(`fixture_checklist` / `missing_client_info` / `review_flag`),
便于 M5-D 评估分辨条目来源。

## 6. CLI(Gate B 验收工具)

```bash
npm run review -- --a=doc_securerate5_v1 --b=doc_indexflex_ul_v1 --case=DEMO-2026-003
```

打印 action / reviewId / sourceKey / 产品 / 客户 / comparisonStatus /
workflowDecision / requiredApprovalLevel / reviewState / 触发理由 / 核对清单 /
快照 SHA-256 / 审计事件。不调用模型。不打印原始快照(`--debug` 也只给结构摘要)。

### 已验证的规范场景

| 场景 | 结果 |
|---|---|
| Client A + TermPlus × IndexFlex | `allow_internal_draft` + `enhanced_review`(见下方已知偏差) |
| Client B + TermPlus × IndexFlex | `allow_internal_draft` + `enhanced_review` |
| Client C + SecureRate × IndexFlex | `block_client_draft` + `licensed_agent_required` + 8 条替换清单 |
| 无客户 + TermPlus × IndexFlex | 正常创建,清单为空 |
| 重复创建 / 调换 A B | 均返回同一个 `existing_pending` 条目 |

**已知偏差(fixture 张力,非缺陷)**:Case A fixture 声明
`expected.reviewStatus = standard_approval` 且 `productCategories: ["term_life"]`,
但本 Demo 只有一款定期寿险产品,任何**产品对**都必然引入 IUL 或年金,从而带来
`NON_GUARANTEED_ELEMENTS` 与 `ILLUSTRATION_REQUIRED` 两个**文档事实**标记 →
`enhanced_review`。路由函数对 Case A **自身声明的** `requiredRiskFlags` 的判定与
fixture 一致;差异完全来自配对产品,不是规则错误。修改 fixture 需要新增产品数据,
超出 M5 范围,因此记录在此而非强行凑数。

`annuity_suitability` 在 `ReviewFlag` 词表中没有对应项,作为**已知缺口**记录,
不硬凑映射。

## 7. 测试数据与残留

- `review_id` 前缀 `rev_test_`、`event_id` 前缀 `evt_test_`;非该前缀的删除操作硬失败。
- 集成测试的 `sourceKey` 带 `test_` 前缀,与真实演示行完全隔离——否则一次 CLI 运行
  留下的 pending 条目会让下一次测试拿到它。
- `npm run validate:ingestion` 增加只读检查:两张表不得有 `rev_test_*` / `evt_test_*`
  残留。知识库三元组 **3/20/45** 不受影响(审核表与知识库无外键、无交集)。

## 8. 审核者身份

v1 固定为 `"Demo Reviewer"`,由服务端写入。**本演示没有登录**,`reviewer` 只是占位标识,
不构成任何身份保证。真实认证 / RBAC 属于非目标。
