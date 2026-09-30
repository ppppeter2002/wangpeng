# smart-tutor 部署模板

这个目录放正式服务器部署所需模板。

- `bootstrap.sh`：Ubuntu 服务器首次初始化模板
- `ecosystem.config.cjs`：PM2 生产进程配置模板
- `smart-tutor.env.example`：服务器环境变量模板（复制后填写真实值）
- `nginx.smart-tutor.conf`：Nginx 反向代理模板
- `post-deploy-check.sh`：部署后烟雾检查
- `smart-tutor.service`：不用 PM2 时的 systemd 兜底模板

推荐顺序：

1. 运行 `bootstrap.sh`
2. 上传代码到服务器
3. 填写 `/etc/smart-tutor.env`
4. `npm install && npm run build`
5. `pm2 start ecosystem.config.cjs --env production && pm2 save`
6. 配置 `nginx`
7. 备案完成后申请 HTTPS
8. 跑 `post-deploy-check.sh`
