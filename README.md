# smart-tutor

K12 tutor platform with Node + Express + Prisma + SQLite backend and WeChat mini program frontend in `wxapp/`.

## Quick Start

```powershell
npm install
npm run typecheck
npm run build
npm run dev
```

Backend health:

```powershell
curl http://localhost:3000/api/health
```

## Mini Program

Import this directory into WeChat DevTools:

```text
D:\大鹏\smart-tutor\wxapp
```

Do not import the repository root.

## Tunnel Modes

- `tunnel.bat`: quick `trycloudflare` temporary public URL
- `run-tunnel.bat`: named tunnel for `https://api.bbbpeter2025.top`
- `install-tunnel-service.bat`: installs `cloudflared` as Windows service for autostart

## Handoff

Project workflow, worklog rules, and Trae/Codex dispatch format live in `HANDOFF.md`.
