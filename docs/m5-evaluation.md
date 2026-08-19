# M5 评估 — 人工审核工作流 Human Review Workflow

**结论:41 例冻结工作流用例全部通过,19 项确定性硬门全部为 0,21 项变异测试
证明评估器能够失败。M5 的核心验收完全不依赖模型行为。**

产物:`evals/results/m5-baseline.json`(修复前)与 `evals/results/m5-final.json`。

---

## 1. M5 要解决的问题

M4 结束时,"需要审核"只是一个徽章。它恒为真,不携带信息,也没有任何人可以对它
做点什么。M5 把它变成一件**办得完、查得到**的事:

```
比较草稿
  → 确定性路由(能走到哪一步 + 需要多高的人类权限)
  → 审核项(服务端重建 + 不可变快照)
  → 人
  → 批准 / 拒绝 / 要求修改
  → append-only 审计轨迹
```

**人**做决定。系统只负责把决定所需的事实、理由与出处摆到人面前,并让这个决定
在半年后仍然指向当时被看到的那张表。

---

## 2. 四轴分离

CLAUDE.md §4 开宗明义:不得把风险、内部可用性、对外可发送性混为一个字段。M5
把它落成四个互不替代的轴:

| 轴 | 问题 | 谁决定 |
|---|---|---|
| `comparisonStatus` | 事实**可不可信** | 代码(M4) |
| `workflowDecision` | 这份东西**能走到哪一步** | 代码(`lib/guardrails/rules.ts`) |
| `requiredApprovalLevel` | 需要**多高的人类权限** | 代码(同上) |
| `reviewState` | 这件事**办到哪一步** | **人** |

典型组合:`complete` + `block_client_draft` + `licensed_agent_required` +
`pending_review` —— 事实全部核实无误,但按本 Demo 规则不得对外,必须持牌经纪人
过目,现在还没人看。把这四件事压成一个"高风险"徽章,审核者就无法行动。

评估把"轴塌陷"当作硬门:**每个字段只能取自己词表里的值**。这比"三个值必须互不
相同"正确——`comparisonStatus="blocked"` 与 `requiredApprovalLevel="blocked"`
合法地共用一个词(见 §9)。

---

## 3. 不可变快照

审核者必须审阅一个**稳定物件**。创建时服务端把确定性内核整份存进 `jsonb`:
两个产品、客户上下文、13 个维度(含逐格引用与派生溯源)、观察项、缺失信息、
比较状态、审核标记、免责声明、引擎版本。

**刻意排除**可选叙述(模型产物,不是被审对象)与单次运行的延迟/模型名(那是一次
执行的属性,不是这份物件的属性)。

哈希对**规范化 JSON**(键名递归排序)计算,因为 `jsonb` 不保留键顺序,往返之后
按原样序列化会得到不同哈希。数据库触发器拒绝任何对快照、哈希、来源键与路由
字段的 UPDATE。

---

## 4. 原子创建

`create_review_item` RPC 在一个事务里完成:advisory lock → 事务内 recheck →
插入条目 → 插入 `REVIEW_CREATED`。不存在"条目已建但没有创建事件"的窗口。

M5-A 最初是两条独立语句。硬门写着"决定缺失审计事件 = 0",创建理应享有同样的
保证,所以在 M5-B 把它并进一个事务。

---

## 5. 原子人类决定

`decide_review_item` RPC 同样在一个事务里做**比较并设置**:调用者声明它以为
自己在操作的状态,状态不符就返回 `conflict`,一个字段都不改,一条事件都不追加。

两个标签页的竞态因此有确定答案:先到者的决定成立,后到者得到 409,审计表里只有
一条终态事件。

---

## 6. 审计事件模型

四种事件:`REVIEW_CREATED` / `APPROVED` / `REJECTED` / `REVISION_REQUESTED`。
append-only:触发器拒绝一切 UPDATE,只对 `rev_test_` 前缀放行 DELETE。

评估对每个决定用例断言:创建事件在最前,之后**恰好一条**终态事件,且终态事件
的类型等于条目最终的 `reviewState`。

---

## 7. 幂等

来源键把两个 documentId 排序后拼接:

```
comparison_draft:<排序后的两个 documentId>:<caseId 或 no_client>
```

产品顺序是**呈现**,M4 已经证明事实对称,所以调换 A/B 两列不是新工作。部分唯一
索引保证同一来源键同时最多一个 `pending_review`;重复创建返回既有条目
(`existing_pending`,HTTP 200)。**这不是冲突**——正确的响应是把审核者送到已经
存在的那件工作上。

条目一旦终态,同一来源可以被重新审核,产生一个新条目:唯一性约束管的是**未完成
的工作**,不是历史。

---

## 8. Case C 旗舰流程

Demo Client C(67 岁、2021 年年金、退保期至 2028)+ SecureRate 5 × IndexFlex UL:

```
comparisonStatus       complete
workflowDecision       block_client_draft
requiredApprovalLevel  licensed_agent_required
reviewState            pending_review
```

审核理由 8 条(其中 `AGE_65_PLUS` 与 `REPLACEMENT_CONTEXT` 各自独立触发持牌
经纪人规则),核对清单包含 fixture 声明的全部 8 条替换核对项,**逐字取自
fixture,没有发明任何法规条目**。

关键边界:`block_client_draft` **不隐藏比较表**。内部审阅正是这份草稿存在的
目的;界面标注的是"不得直接对外",并明写这是**本演示项目的业务政策,不是普遍
法律义务**。它也**不等于**"被审核者拒绝"——那是另一个轴上的另一件事。

---

## 9. 冻结评估

`evals/workflow-cases.json`,**41 例,在评估器写完之前冻结**,期望值来自
synthetic fixtures、M4 比较语义、M5 路由表与状态机,不来自当前输出。

| 类别 | 例数 | 覆盖 |
|---|---|---|
| routing | 9 | Case A 基线 / Case A 运行时配对 / Case B 基线与运行时 / Case C 基线与运行时 / 无客户 / blocked / partial |
| creation | 5 | 全新、重复待审、反序重复、终态后重建、并发 |
| decision | 5 | 批准、拒绝、要求修改、陈旧双标签页、重复批准 |
| transition | 6 | 合法转出 + 五种非法(含三个终态互转与自转) |
| trust_boundary | 7 | 伪造快照 / flags / 路由 / 审批级别 / 幂等键 / reviewer / actor |
| input_validation | 9 | 空、单空格、多空格、换行、制表符,拒绝与要求修改两侧 |

**结构优先。**每一条判定读的都是持久化字段、事件列表、路由值或 schema 结果。
自由文本只在一处被检查——审核者自己写下的话是否被原样存下。这是 M3 的教训:
自由文本正则做主判据会同时产生误报和漏报。

破坏性场景跑在**真实持久化**上,用 `rev_test_` / `evt_test_` 行与 `test_` 前缀
的来源键,因此真正走过触发器、advisory lock 与 compare-and-set,而不是模拟它们。
清理只删测试前缀行,非测试历史一行不碰。

---

## 10. 硬门(19 项,全部为 0)

```
wrong workflow routing                      0
wrong approval level                        0
invalid state transitions accepted          0
duplicate terminal decisions                0
decisions missing audit event               0
creation missing REVIEW_CREATED             0
duplicate pending review items              0
reverse-order duplicate pending items       0
snapshot mutation                           0
snapshot hash mismatch                      0
client-forged verified data accepted        0
client-forged routing accepted              0
client-forged reviewer/actor accepted       0
stale concurrent decisions accepted         0
Case C client-facing block bypass           0
blank decision reasons accepted             0
knowledge-base mutation                     0
four-axis collapse                          0
invented checklist requirement              0
```

没有模型参与,因此没有可以争论的容差带。

---

## 11. 变异测试(21 项)

`tests/reviews/workflow-mutation.test.ts`。只会通过的测试什么也证明不了,所以
每一项注入一个缺陷,断言本该抓住它的检查确实抓住了:错误路由、错误审批级别、
轴塌陷、重复终态事件、缺失审计事件、缺失创建事件、快照被改(单元格/页码/引文)、
哈希不符、伪造 flags / 路由 / actor / 幂等键、陈旧转换被接受、Case C 阻断被移除、
空白拒绝被接受、重复待审、反序产生第二个待审项。

两处刻意的"反向"断言:
- 移除 `REPLACEMENT_CONTEXT` 与 `AGE_65_PLUS` 后阻断**必须消失**,否则"阻断是
  这两个 flag 造成的"就是不可证伪的
- 去掉多余字段后同一请求**必须合法**,否则那些 400 可能只是请求本身畸形

---

## 12. 实机 QA 发现的空白理由缺陷(真实缺陷,如实记录)

**M5-C 开发不是零缺陷的。**

实机探测向拒绝接口提交了纯空白的理由。原 schema 是:

```ts
reason: z.string().min(1)
```

空白**有长度**,于是它通过了。结果是数据库里多了一条**真实的**拒绝记录,理由栏
什么也没说——恰恰是"拒绝必须写原因"这条规则要防的东西。

两件事同时发生,它们正好说明为什么这套设计是这样的:

1. **不可变性挡住了掩盖。**`assertTestReviewId` 对非 `rev_test_` 前缀硬失败,
   append-only 触发器也拒绝删除。没有任何代码路径能抹掉那条记录。它还在,
   `GET /api/reviews?state=rejected` 查得到。
2. **补救走正常路径。**该来源已终态,于是**新建**了一条待审项。审计历史因此
   记录了发生过的全部事情,而不是我们希望发生的事情。

修复:文本先 `trim` 再判长度。同时更正了一条我自己写的 M5-A 断言——它把这个
bug 断言成了正确行为,还配了句"trimmed server-side"的注释,而服务端根本没有
trim。M5-D 把 6 种空白输入 × 2 个字段冻结成 9 条回归用例。

> `append-only 审计历史 + 实机 QA` 的价值不是"不出错",而是**出错时看得见、
> 改不掉、必须承认**。

---

## 13. Case A:基线与运行时是两个问题

Case A 的 fixture 声明 `standard_approval`,而它与 IUL 实际配对时得到
`enhanced_review`。这一度被记为"硬门未满足"。它不是。

```
运行时路由 = 已验证的 case 信号 + 已验证的产品对 flags
```

fixture 的期望值是**客户基线**:这个客户情形本身要求多高的审批。运行时是基线
**加上所选产品的已验证 flags**。IUL 确实带有非保证要素与 illustration 要求,
这是**文档事实**,不是客户属性。低风险客户配上它需要强化审核 —— 规则在正常
工作。

评估把两者分成不同的用例,并冻结三条性质:

- 基线对照**自身声明的** ground-truth flags 必须对得上(A/B/C 三例)
- 运行时**绝不低于**基线(全 case × 全产品对)
- 升级**必须可归因**:去掉产品 flags 后级别必须真的降下来,否则"它升级了"
  不可证伪

不修改 fixture、不伪造第二款定期寿险产品、不压制 IUL flags、不开特例。

---

## 14. 基线与最终结果

`m5-baseline.json`(39 例)有 **2 例失败,两例都是评估器缺陷,不是系统缺陷**:

| 失败 | 类别 | 原因 |
|---|---|---|
| `routing_case_c_block_client_draft` | evaluator defect | 我在冻结用例里把三条 fixture 清单键抄错了(多加了连字符/词) |
| `routing_blocked_facts_outrank_everything` | evaluator defect | 轴塌陷检查要求"三个值互不相同",但 `blocked` 合法地同时属于两个词表 |

修复的是评估器:清单键按 fixture 原文更正,轴检查改为**每个字段只能取自己词表
里的值**。两者都没有改动生产逻辑。

变异测试随后又抓到第三个评估器缺陷:`baselineFor` 的 fixture 词表映射用的是我
臆想的名字(`replacement`),而 fixture 实际写的是 `replacement_of_existing_policy`。
后果是 Case B/C 的基线**静悄悄地**退化成 `standard_approval`,让"绝不低于基线"
这条检查变得比设计意图更弱。更正映射后补了 Case B/C 两条基线对账用例,用例数
从 39 增至 41。

`m5-final.json`:**41/41 通过,19 项硬门全部为 0,测试残留 0。**

失败分类使用:routing / approval-level / state-machine / creation-atomicity /
decision-atomicity / idempotency / snapshot-integrity / audit-event /
trust-boundary / input-validation / checklist / UI-workflow / **evaluator** /
fixture-vocabulary-gap / infrastructure-flake。**不为评估器自身的问题去调生产
逻辑。**

---

## 15. 已知缺口与限制(不粉饰)

- **`annuity_suitability` 在 `ReviewFlag` 词表中没有对应项。**它是 Case C
  fixture 声明的风险标记之一。硬凑到一个语义不同的 flag 上只会让指标好看,
  所以它被记为词表缺口,并有一条变异测试盯着它别被偷偷映射掉。
- **没有认证。**`"Demo Reviewer"` 是服务端写入的**占位标识**,不是身份保证。
  硬门只保证浏览器**无法**提交或覆盖 reviewer / actor。真实认证与 RBAC 在
  backlog。
- **要求修改不会自动重新生成草稿。**v1 记录指令并转入终态。价值在于这条指令
  可以追溯到人、时间与具体快照。
- **核对清单不记录勾选状态。**后端不存。清单可以逐条展开与勾选,但勾选只活在
  当前标签页,刷新即清空,不随决定提交,也不改变批准 / 拒绝控件——它是本次查看的
  临时标记,不是记录。
- **INFRA-01:**M5-B 期间观察到一次未复现的 DB 套件部分失败。两次针对性复现
  尝试均全绿,**根因未知,不编造**。非阻塞,复现则重启调查。
- **审批不是适合性判断。**"本演示工作流内已批准"只表示审核者认可了本演示工作流
  中的一个内部步骤。它**不**表示产品适合该客户、承保方核准、合规或法律批准、
  报价有效,也不构成购买建议。这段文字由代码拥有,模型不参与生成或改写。
- **规则不是法律结论。**年龄阈值、replacement review、annuity suitability
  都是本 Demo 的业务政策与虚构产品规则。真实生产使用前必须由公司合规人员、
  持牌经纪人及适用法规共同确认。

---

## 16. 开发期产生的真实审核历史

实机验收在真实数据库里留下了 8 条 `rev_<uuid>` 审核记录(4 待审、2 已批准、
1 已拒绝、1 要求修改),其中包含 §12 那条空白理由的拒绝记录。

它们是**有效的审计历史,不是测试残留**:不删除、不禁用触发器、不加生产删除
后门。评估器只把它们当作观测项报告,从不作为通过条件;所有破坏性场景使用
`rev_test_` 前缀的隔离行,跑完清理为 0。

---

## 17. M5 / M5.1 边界

M5 的终点是**记录下人类决定并留下审计轨迹**。原 M5 交付物里的 n8n webhook 与
follow-up task **没有被取消**,而是显式移入 **M5.1 — Post-Review Automation**
(CLAUDE.md §12 已同步修改)。

理由:M5 的价值在于"谁、在什么时候、基于哪份快照、做了什么决定"这条链路可查
可证;把对外投递混进来,会让这条链路的验收同时依赖一个外部系统的可用性。

M5.1 消费 M5 已经暴露的干净状态与事件,不重新定义它们:

```
approved / revision_requested 事件
  → 确定性对外 payload(代码构造:URL、动作名、收件人、字段一律不由模型决定)
  → n8n 受控 webhook
  → follow-up task / draft
  → n8n 不可用时的明确 mock fallback
```

**M5 不触发任何外部自动化。**
