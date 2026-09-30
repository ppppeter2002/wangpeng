# T-022-step2 上线准备指南

## 目标

在用户还未购买正式服务器和完成备案前，先把上线材料、部署模板和执行顺序准备齐，避免后续重复摸索。

## 推荐上线架构

- 服务器：1 台 Linux 云主机（推荐 Ubuntu 24.04 LTS）
- 进程管理：`pm2`
- 反向代理：`nginx`
- HTTPS：`Let's Encrypt`
- 数据库：当前可先保留 SQLite，正式长期运行建议迁移 Postgres
- 域名：1 个主域名，至少预留 `api.xxx.com`
- 小程序合法域名：使用备案后的 HTTPS API 域名

## 推荐购买规格

- CPU：2 核起步
- 内存：2 GB 起步，建议 4 GB
- 系统盘：40 GB SSD 起步
- 带宽：3 Mbps 起步
- 地域：优先中国大陆，便于微信小程序合法域名和备案

## 服务器购买时要确认

- 能拿到公网 IPv4
- 支持 80 / 443 / 3000 端口安全组配置
- 支持备案服务号或备案协助
- 可以绑定自有域名

## 域名与备案

### 备案前需要准备

- 域名实名认证
- 云服务器购买完成
- 主体资料
- 个人：身份证、手机号、邮箱
- 企业：营业执照、法人信息、管理员信息

### 备案时需要填写

- 网站 / 服务名称建议：`smart-tutor`
- 服务内容：K12 教辅、小程序后端服务、学习成绩与通知
- 部署地域、服务器 IP、接入商

### 备案完成后再做

- 域名解析到服务器公网 IP
- Nginx 反向代理
- HTTPS 证书
- 小程序服务器域名白名单

## 服务器部署顺序

1. 安装 Node.js LTS
2. 安装 `pm2`
3. 安装 `nginx`
4. 上传项目代码
5. 配置环境变量
6. 执行 `npm install`
7. 执行 `npm run build`
8. 用 `pm2` 启动服务
9. 配置 `nginx`
10. 配置 HTTPS
11. 打通微信小程序合法域名

## 当前环境变量清单

- `PORT=3000`
- `DATABASE_URL=file:./dev.db`
- `HUNYUAN_API_KEY`
- `HUNYUAN_BASE_URL=https://api.hotrouter.ai/v1`
- `HUNYUAN_MODEL=hy3`
- `HUNYUAN_MAX_TOKENS=4000`
- `WX_APPID`
- `WX_SECRET`

不要把真实值提交进仓库。

## 上线后验证

- `GET /api/health` 返回 200
- `GET /api/health/db` 返回数据库连通
- 服务重启后可自动拉起
- HTTPS 正常
- 小程序请求不再命中 `trycloudflare`
- 无 `HUNYUAN_API_KEY` 时 AI 题目仍能降级到题库

## 当前阻塞

- 服务器尚未购买
- 域名 / 备案主体尚未确认
- 微信服务号资质未落地

## Codex 已准备

- `tunnel.bat` 临时公网调试
- `HANDOFF.md` 统一交接规则
- Obsidian 控制台与 Trae 发单模板
- 本文件提供正式上线清单

