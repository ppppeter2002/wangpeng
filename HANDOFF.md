# smart-tutor 项目交接包（Handoff Pack）

## 0. 一句话定位

中小学 K12 辅导平台：老师发教案/作业 -> 学生做作业/晋级/PK -> AI（腾讯混元 Hy3）按弱项出题 -> 每月赛季结算 -> 王者前 3 名线下发奖金 -> 家长微信端看成绩/通知。

技术栈：Node + Express + Prisma + SQLite（上线可换 Postgres）+ 微信小程序（`wxapp/`）+ 腾讯混元 Hy3（OpenAI 兼容）。

## 1. 目录约定（重要）

- 后端项目根目录：`D:\大鹏\smart-tutor`
- 微信小程序必须导入：`D:\大鹏\smart-tutor\wxapp`
- `worklog/`
- `worklog/status.json`：整体进度、`lastCompleted`、`nextTicket`
- `worklog/T-XXX.completed.json`：单个工单验收产物
- Trae 不会自动读 `worklog`；必须由 Codex/人工把工单文本贴进去并允许执行。

## 2. 当前完成情况

已完成：

- `T-008b` 佣金钱包（首充+月活返佣）
- `T-008c` 钱包初始化（家长注册送 + 虚拟充值）
- `T-009` 教案互动修改
- `T-010` 教案市场+佣金消费
- `T-011` 热门推荐+区市级空间
- `T-012` 学生绑定家长
- `T-013` 微信通知系统（落库+日志，未接真服务号）
- `T-014` 作业与成绩
- `T-015` 学生晋级系统（8 级段位）
- `T-016` PK 匹配对战（限时+抢答，胜方+20 积分）
- `T-017` 赛季制+王者奖励+拍照上传
- `T-018` AI 出题接入混元 Hy3（`hotrouter.ai` 代理，`model=hy3`）
- `T-020a` 小程序骨架 + `wx.login`
- `T-020b` 学生端：AI 辅导多轮 / 晋级测试 / PK 大厅
- `T-020c` 家长端 + 老师端页面
- `T-021` 题库汇聚：教案拆题 + 作业同步入库 + `txt/md` 拆题 + `hash` 去重
- `T-022-prep` 本机 + Cloudflare Tunnel 临时公网化
- `T-022-step3` 自有域名 + cloudflared Windows 服务开机自启
- `T-021b` `pdf/docx/OCR` 拆题

当前：

- `lastCompleted = T-008c`
- `nextTicket = T-019 (微信服务号资质，等待公众号资质) / T-022-step2 (买服务器+备案指引，用户手动)`

## 3. 产品需求（核心）

三角色：

- 老师：建教案 -> 上架市场 -> 建班级 -> 布置作业 -> 批改 -> 看销量
- 学生：绑家长 -> 做作业 -> 晋级测试（AI 弱项题）-> PK -> 冲段位 -> 赛季争王者
- 家长：绑学生 -> 买教案（佣金不可提现）-> 看成绩 -> 收通知 -> 领奖上传照片

段位链：黑铁 / 青铜 / 白银 / 黄金 / 铂金 / 钻石 / 大师 / 王者（每级 100 名，王者无上限）

PK：同区县 + 段位相近匹配，限时答题 + 抢答，胜 +20

赛季：每月 1 个，王者前 3：1000 / 300 / 100 元线下，拍照 + 大人联系方式

AI 出题：有 `HUNYUAN_API_KEY` 走混元；无 Key 自动降级题库（`source=bank`）

## 4. 环境变量（绝不写进仓库）

- `HUNYUAN_API_KEY`
- `HUNYUAN_BASE_URL=https://api.hotrouter.ai/v1`
- `HUNYUAN_MODEL=hy3`
- `HUNYUAN_MAX_TOKENS=4000`
- `WX_APPID`
- `WX_SECRET`
- `PORT=3000`
- `DATABASE_URL=file:./dev.db`

只走进程环境变量，不提交 `.env` 真值。

## 5. 发单格式（给 Trae / Codex 用）

每次只做一个 `T-XXX`，结构固定：

1. 目标
2. 后端改哪些文件 / 新建哪些 route
3. 前端改哪些页面（小程序在 `wxapp/pages/...`）
4. schema 是否改（改了必须写 `npx prisma db push`）
5. 验收清单（PASS/FAIL 可机器判断）
6. 不做哪些事（防止范围膨胀）
7. 完成后生成 `worklog/T-XXX.completed.json` 并更新 `status.json`

示例开头：

`在 D:\大鹏\smart-tutor 实现 T-022-prep：...`

## 6. 验收 / 检查格式

每个工单结尾必须能打出：

- `PASS 0 dev server health`
- `PASS 1 ...`
- `PASS N ...`

并且：

- `npx tsc --noEmit` 通过
- `npm run build` 通过
- Prisma 变更已 `db push`
- 生成 `worklog/T-XXX.completed.json`
- `status.json` 的 `lastCompleted` 更新

## 7. 新 AI 接手时先做什么（LOAD -> REPORT -> ASK）

LOAD：

- 读 `worklog/status.json`
- 读最近一个 `worklog/T-*.completed.json`
- 读 `src/server.ts`、`prisma/schema.prisma`、`wxapp/app.json`

REPORT：

- 用 5 行说明：现在做到哪、下一步工单、是否有阻塞

ASK：

- 只问阻塞项（如：有没有服务器 / 服务号资质 / 真支付）

## 8. 下一步候选工单

- `T-022-step2`：买 Linux 服务器 + 备案指引 + Nginx/HTTPS/pm2 方案（需要用户购买和实名）
- `T-019`：微信服务号模板消息（等公众号资质）
- 钱包初始化（已完成）：家长注册送 / 充值虚拟佣金，已打通 `market buy`

## 9. 硬规矩

- 不碰 `.env` 文件内容，只走进程环境变量
- 小程序导入 `wxapp/`，不是根目录
- AI 出题必须有降级，无 Key 不能崩
- 佣金只进不出、不可提现
- 个人敏感信息（孩子姓名 / 手机号 / `AppSecret`）别写进仓库和工单正文

## 10. Codex 接管规则

- Codex 负责读取 `worklog`、判定 `nextTicket`、整理 Trae 发单文本
- Obsidian 作为总控台：看板、阻塞项、外部动作清单都记录在 `obsidian/`
- Trae 只接收单个、边界清晰、可验收的工单
- 小程序上传、ICP备案、服务号资质、服务器购买等需要账号 / 法务 / 实名动作的事项，Codex 负责生成材料和清单，但用户本人执行最终确认
