# 部署 Deployment

Live demo: **https://agentdesk-acme307.vercel.app**

Vercel project `acme307/agentdesk`。Next.js 被自动识别,**不需要 `vercel.json`**,
仓库里也没有。

## 环境变量 Environment variables

全部服务端注入,**不进浏览器**——本项目没有任何 `NEXT_PUBLIC_*`。

### 核心 Demo 必需 Required

| 变量 | 用途 |
|---|---|
| `OPENAI_API_KEY` | 回答生成、embedding **与语音转写**(语音输入复用同一个服务端凭据) |
| `SUPABASE_URL` | 项目 URL |
| `SUPABASE_SECRET_KEY` | `sb_secret_*`,服务端唯一接受的变量名 |

### 可选 Optional(n8n 实机投递)

| 变量 | 缺失时的行为 |
|---|---|
| `N8N_WEBHOOK_URL` | 未设置 → 审核后自动化落 `mocked`,界面明写「未调用任何外部 n8n webhook」 |
| `N8N_WEBHOOK_SECRET` | 未设置 → 不发送 secret 请求头 |

`ANSWER_MODEL` 可选,默认 `gpt-5-mini`。
`SUPABASE_DB_URL` **只**给 `npm run db:push` 用,运行时不需要,**不要**配到 Vercel。

## PDF 资产

`public/documents/` 是构建产物(已 gitignore)。`prebuild` 钩子运行
`scripts/sync-public-pdfs.ts`,把 `data/fictional-products/generated/` 里**已提交**
的三份 PDF 复制过去,因此 Vercel 构建时自动生成,无需额外配置。

## 数据库

migrations 已应用于同一个 Supabase 项目;部署**不会**自动执行 migration,
新增 migration 后需本地跑 `npm run db:push`。生产与本地**共用同一个数据库**——
这是 Demo 取舍,不是生产架构。

## 部署踩过的坑(值得记下来)

**Vercel Deployment Protection 默认开启。**首次部署后每个 URL 都 302 到
`vercel.com/sso-api`,包括 PDF。于是 `curl -L` 对所有页面**都返回 200**——但返回的
是 Vercel 登录页,不是应用。一个看起来全绿、却从未碰到应用的冒烟测试。

露馅的是 PDF:它返回 `text/html` 而不是 `application/pdf`。

关闭方式:

```bash
vercel project protection disable agentdesk --sso
```

## 已知边界

- **无登录。**任何拿到 URL 的人都能调用 `/api/answer` 与 `/api/transcribe`,
  两者都消耗 OpenAI 额度。**建议在 OpenAI 后台设置月度支出上限。**
- 麦克风需要 HTTPS(Vercel 已满足)与浏览器授权;不支持或被拒绝时按钮会给出
  明确的行内提示,页面照常可用。
- 回答延迟约 15–40 秒,由推理型回答模型主导(见 `docs/backlog.md`)。
