# M5.1 — 审核后自动化 Post-Review Automation

一个产物、一张表、一个 n8n workflow、一个按钮。

```
人完成审核 → 出现自动化面板 → 点「运行自动化」→ 内部任务 → n8n / mock 结果
```

要证明的是 **AI 干活 → 人控制 → 安全自动化**;反面是"AI 自主给客户发建议"。

---

## 1. 唯一产物:内部任务

```ts
type TaskType = "internal_followup" | "internal_revision";
```

枚举里**没有** client-facing 值,payload 里**没有**收件人字段。所以"不会误发给
客户"不是一条要记得遵守的规则,而是**系统里不存在能发的东西**。Case C 因此不需要
任何特例分支——这是选这个产物最重要的原因。

## 2. 什么时候触发什么

| 审核状态 | 结果 |
|---|---|
| `approved` | `internal_followup`,action items = 审核者看到的核对清单 |
| `revision_requested` | `internal_revision`,带审核者**原话** |
| `rejected` | **不产生自动化,也不产生投递记录** |
| `pending_review` | 面板提示先完成人工审核 |
| `allow_checklist_only`(事实未核验) | `FACTS_UNVERIFIED`,拒绝(见 §7) |

`block_client_draft`(Case C)与普通批准得到**同一种内部任务**,只是 action items
来自 8 条替换核对项。

## 3. 幂等

```
idempotencyKey = reviewId:terminalEventId
```

终态事件 id 来自 append-only 日志,天然稳定唯一——比时间戳可靠。
`automation_runs.idempotency_key` 上的 **unique 索引就是那把锁**,不需要 advisory
lock,而且数据库会强制执行,不管调用方记不记得。

双击、重复 POST、并发请求 → 同一行记录,**n8n 永远不会为一次人类决定收到两个任务**。
已 `delivered` 的记录再点也不会二次投递。

## 4. 投递与失败

`pending` / `delivered` / `failed` / `mocked`。

- **`mocked` 不是 `delivered` 的一种**:什么都没发出去,界面就这么说。
- 非 2xx、超时、网络错误、**应答畸形(空 body / HTML / 字段不符)** 一律 `failed`。
  一个装着 HTML 错误页的 200 不是"workflow 跑过了"。
- **投递失败绝不回滚人类决定。**这是结构性的:两张表,且 `lib/automation` 里
  没有任何代码路径能写 `review_items`。

没有 RPC:webhook 是外部 HTTP,本来就进不了数据库事务,硬凑一个只会制造假的原子性。
诚实的形状是先落 `pending`,发完再回写。

## 5. 触发点:按钮,不自动

`POST /api/reviews/[id]/automation`,**请求体为空**。没有字段可以指定任务类型、
目的地、payload、状态或幂等键——服务端全部从存储的 review 与终态事件重建。

理由:① 绝不在数据库事务里发外部 HTTP;② 自动触发意味着演示时每点一次批准就真的
打一次外网;③ **"人点了才发"本身就是这个里程碑要证明的论点**。

重试没有引擎:同一个按钮再点一次,按幂等键找到既有行,`attemptCount += 1`,上限 3 次。
没有队列、没有 worker、没有退避策略。

## 6. n8n 与 mock fallback

`n8n/agentdesk-post-review-task.json`(已提交,不含任何 URL、凭据或密钥):

```
Webhook → 校验 schemaVersion 与 secret 头 → 映射为 demo 任务 → 返回 { accepted, taskId }
```

**没有** Gmail / Slack / CRM 节点。给 workflow 加一个对外渠道,等于把"只发内部任务"
这个设计消除掉的风险又装回去。

未配置 `N8N_WEBHOOK_URL` → 状态 `mocked`,界面明写「演示自动化已在本地完成,未调用
任何外部 n8n webhook」。**Demo 在没有任何外部基础设施时也能完整走通。**

密钥放 `X-AgentDesk-Webhook-Secret` 请求头,不进 URL(URL 会进日志和历史),
也不进浏览器。超时 10 秒——这是 webhook,不是生成任务,不用 M4 的 90 秒。

## 7. 已知限制

- **`allow_checklist_only` 在 M5 里仍可被人点"批准"**:状态机只看 `reviewState`。
  M5.1 不改 M5 语义,而是自己 fail closed —— 拒绝为它产生任何自动化
  (`FACTS_UNVERIFIED`)。
- **没有生产认证 / RBAC。**`"Demo Reviewer"` 是服务端写入的占位标识。
- **没有生产 PII 处理,也没有对外客户沟通能力。**payload 里的客户数据全部是合成的。
- **除 demo n8n 外没有真实外部集成。**无邮件、SMS、Slack、CRM。
- **重试策略刻意做到最小。**手动重试,上限 3 次,无自动重试与退避。

## 8. 验收

- 8 项确定性行为测试(`tests/automation/*`、`tests/database/automation.test.ts`),
  用**本地 mock webhook 服务器**,不依赖真实 n8n
- 12 项审核 UI 测试覆盖面板的每种状态
- 实机走通四个场景:批准 / 要求修改 / 已拒绝 / Case C
- 知识库 **3/20/45** 不变,`aut_test_*` 残留 0
