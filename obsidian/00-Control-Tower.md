# Smart Tutor Control Tower

## 当前定位

- 项目：`smart-tutor`
- 当前阶段：`T-022-prep` 已完成，进入上线前外部动作期
- 指挥方式：Codex 负责读 `worklog`、整理任务、生成 Trae 工单；Obsidian 负责总览

## 开工顺序

1. 运行 `scripts/export-obsidian-dashboard.ps1`
2. 查看 `generated/00-current-status.md`
3. 判断下一个动作是：
   - 继续本地代码工单
   - 给 Trae 派单
   - 推进外部人工事项
4. 如需派单，运行 `scripts/new-trae-ticket.ps1`

## Codex 负责

- 读取 `worklog/status.json`
- 读取最近一个 `worklog/T-*.completed.json`
- 生成结构化工单文本
- 把需要人工配合的事项收口成清单
- 持续维护 `HANDOFF.md`

## Trae 负责

- 接收单个 `T-XXX` 工单
- 只做指定范围内的后端 / 前端 / schema 变更
- 输出 PASS/FAIL 验收结果

## 人工必须确认

- 微信小程序上传与提审
- ICP 备案实名与材料提交
- 服务器购买 / 域名购买 / SSL / 合法域名配置
- 微信服务号 / 模板消息资质

## 今日建议

- 优先推进 `T-022-step2` 的上线材料准备
- 并行准备 `T-019` 的资质依赖清单
- 若继续开发能力项，排 `T-021b` 或钱包初始化

