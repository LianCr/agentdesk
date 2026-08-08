# M5 — 人工审核工作流 Human Review Workflow

状态:**进行中**。M5-A(契约、路由规则、持久化、原子决定)、M5-B(审核项创建、
不可变快照、确定性核对清单、CLI)与 M5-C(API 与网页)已实现;M5-D(评估收口)未开始。
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
| Client A + TermPlus × IndexFlex | `allow_internal_draft` + `enhanced_review`(**预期升级**,见下) |
| Client B + TermPlus × IndexFlex | `allow_internal_draft` + `enhanced_review` |
| Client C + SecureRate × IndexFlex | `block_client_draft` + `licensed_agent_required` + 8 条替换清单 |
| 无客户 + TermPlus × IndexFlex | 正常创建,清单为空 |
| 重复创建 / 调换 A B | 均返回同一个 `existing_pending` 条目 |

### 基线与运行时是两个问题

fixture 的 `expected.reviewStatus` 是**客户基线**:这个客户情形本身要求多高的审批。
运行时路由是基线**加上所选产品对的已验证 flags**:

```
运行时路由 = 已验证的 case 信号 + 已验证的产品对 flags
```

因此 Case A(基线 `standard_approval`)配上 IUL 得到 `enhanced_review` 是**规则在正常工作**——
IUL 确实带有非保证要素与 illustration 要求,这是**文档事实**,不是客户属性。

真正的硬要求是三条,都有测试:

- 路由**绝不忽略**已验证的产品对 flags(去掉那两个 flag,级别必须真的降下来)
- 路由**绝不低于**客户基线(对全部 case × 全部产品对做单调性断言)
- fixture 基线对照**自身声明的** ground-truth flags 时必须对得上

不修改 fixture、不伪造第二款定期寿险产品、不压制 IUL flags、不为 DEMO-2026-001 开特例。

`annuity_suitability` 在 `ReviewFlag` 词表中没有对应项,作为**已知缺口**记录,
不硬凑映射。

## 7. 测试数据与残留

- `review_id` 前缀 `rev_test_`、`event_id` 前缀 `evt_test_`;非该前缀的删除操作硬失败。
- 集成测试的 `sourceKey` 带 `test_` 前缀,与真实演示行完全隔离——否则一次 CLI 运行
  留下的 pending 条目会让下一次测试拿到它。
- `npm run validate:ingestion` 增加只读检查:两张表不得有 `rev_test_*` / `evt_test_*`
  残留。知识库三元组 **3/20/45** 不受影响(审核表与知识库无外键、无交集)。

## 8. 开发期产生的审核记录

Gate B 的四个规范场景在真实数据库里留下了 4 条 `rev_<uuid>` 待审条目与 4 条事件
(Case A / B / C 各一,加一条无客户)。这些是**有效的审计历史,不是测试残留**:

- 不删除、不禁用触发器、不加生产删除后门。`assertTestReviewId` 对非 `rev_test_`
  前缀硬失败,这正是设计意图。
- 残留检查只管 `rev_test_*` / `evt_test_*`,因此这四条不会被报为残留。
- M5-C 必须把它们当作正常应用状态渲染:对这些产品对再次"送交审核"会返回
  `existing_pending` 并打开既有条目。这是**幂等性的可见演示**,不是错误。
- 需要"全新创建"的验收场景时,选一个当前没有待审条目的来源组合。

## 9. M5-C:可点击的人审闭环

```
/compare → 送交审核 → 审核队列 → 审核详情 → 批准/拒绝/要求修改 → 审计记录
```

### API(四个端点,无通用 CRUD)

| 端点 | 成功 | 说明 |
|---|---|---|
| `POST /api/reviews` | 201 `created` / 200 `existing_pending` | 只收三个标识符;**重复创建不是 409** |
| `GET /api/reviews?state=` | 200 摘要数组 | 五个取值的白名单,不暴露任意 DB filter |
| `GET /api/reviews/[id]` | 200 详情 | 返回**存储的快照原样** |
| `POST /api/reviews/[id]/decision` | 200 / **409 `REVIEW_STATE_CONFLICT`** | actor 由服务端写入 |

队列端点**不选取快照**:客户名与产品名由数据库从 jsonb 取出
(`snapshot->productA->>productName`),所以队列不会为渲染一张表搬运几 MB。

### 渲染的是快照,不是重算

审核详情页从不调用 `/api/compare`。UI 测试用一条**当前产品资料不可能产生**的
值(`ARCHIVED-ONLY VALUE 1997-A`)作为快照 fixture:一旦页面改成重算,那个字符串
就会消失,测试即失败。同一测试还断言比较端点的调用次数为 0。

### 四轴 UX

横幅把四个问题分成四栏,不合并成一个"高风险"徽章:

```
产品事实  比较完整 Comparison: Complete
工作流    不得用于对外文案 Client-facing use blocked
所需审核  需持牌经纪人审核 Licensed agent review required
人工进度  待审核 Pending review
```

`block_client_draft` 时额外说明:比较**仍可内部审阅**,只是在审核完成前不得对外,
并明确标注这是本演示的业务政策而非普遍法律义务。

### 批准的语义边界(代码拥有,模型不参与)

> 本演示工作流内已批准 · Approved in this demo workflow

并明写它**不**表示:产品适合性、保险公司核准、合规或法律批准、报价有效性、购买建议。

### 幂等在 UI 上是可见的正常结果

对已有待审项的产品对再次"送交审核",返回 `existing_pending`、跳转到既有条目,
并在目标页显示「已存在对应的待审核项,已为你打开」。结果通过 query 参数传到目标页——
留在 `/compare` 上的提示会被紧接着的跳转卸载掉。

### 陈旧标签页

第二个标签页提交决定时收到 409,页面显示「该审核项已在其他会话中被处理,请刷新」,
并**直接采用**响应里的最新状态。先做出的决定不会被覆盖,也不会产生第二条终态事件。

### 核对清单不做勾选框

后端不存勾选状态。一个刷新就忘记的勾选框看起来像记录,却不是记录——比没有更糟。
本阶段清单是决策辅助。

## 10. 审核者身份

v1 固定为 `"Demo Reviewer"`,由服务端写入。**本演示没有登录**,`reviewer` 只是占位标识,
不构成任何身份保证。真实认证 / RBAC 属于非目标。
