# smart-tutor Obsidian 控制台

这个目录可以直接作为 Obsidian Vault 打开，也可以作为现有 Vault 的子目录挂进去。

建议使用方式：

1. 在 Obsidian 里打开 `D:\大鹏\smart-tutor\obsidian`
2. 固定阅读 `00-Control-Tower.md`
3. 每次开工前先运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-obsidian-dashboard.ps1
```

4. 需要给 Trae 发单时运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\new-trae-ticket.ps1
```

目录说明：

- `00-Control-Tower.md`：项目总控台
- `10-External-Actions.md`：外部必须人工确认的事项
- `templates/`：Trae 发单模板、阻塞模板
- `generated/`：脚本自动生成的最新状态，不建议手改

这套连接的核心不是“直接控制 Trae/Obsidian 软件本体”，而是把项目状态、派工文本和外部阻塞统一沉淀到一个可被 Codex 持续维护的知识面板里。

