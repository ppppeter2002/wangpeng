# T-022-step3 自有域名 + 开机自启

## 目标

把 `smart-tutor` 从临时 `trycloudflare` 隧道切到命名隧道，并补齐 Windows 开机自启脚本。

## 当前约定

- 命名 tunnel：`smart-tutor`
- 自有域名：`api.bbbpeter2025.top`
- 本地服务：`http://localhost:3000`
- 小程序 API：`https://api.bbbpeter2025.top/api`

## 本次落地内容

- `config.yml`：项目内提供 named tunnel 模板
- `run-tunnel.bat`：本地手动运行命名 tunnel
- `install-tunnel-service.bat`：把 `cloudflared` 安装成 Windows 服务
- `uninstall-tunnel-service.bat`：移除 Windows 服务

## 手动执行步骤

1. 确保 `cloudflared.exe` 已放在项目根目录
2. 把命名 tunnel 的 credentials JSON 放到：
   - `%USERPROFILE%\.cloudflared\smart-tutor.json`
3. 检查 `%USERPROFILE%\.cloudflared\config.yml`
   - `hostname` 必须是 `api.bbbpeter2025.top`
   - `service` 必须是 `http://localhost:3000`
4. 以管理员身份运行：
   - `install-tunnel-service.bat`
5. 验证服务：
   - `sc query Cloudflared`
6. 验证公网：
   - `https://api.bbbpeter2025.top/api/health`
7. 小程序固定走：
   - `https://api.bbbpeter2025.top/api`

## 常见问题

### 服务安装成功但无法访问

- 检查本地 `npm run dev` 或正式服务是否在 `3000` 端口
- 检查域名 CNAME 是否已指向 Cloudflare Tunnel
- 检查 tunnel credentials JSON 是否与 tunnel 名匹配

### 需要临时手动运行

- 双击 `run-tunnel.bat`

### 需要回退

- 运行 `uninstall-tunnel-service.bat`
- 临时改回 `tunnel.bat`

