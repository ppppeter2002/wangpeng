param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$TicketId = "",
  [string]$Title = "",
  [string]$Goal = "按 HANDOFF.md 规范完成单个工单，不擅自扩大范围。",
  [string]$BackendFiles = "",
  [string]$FrontendPages = "",
  [string]$SchemaChange = "否，除非本工单明确要求",
  [string]$Acceptance = "PASS 0 dev server health；npx tsc --noEmit；npm run build；更新 worklog",
  [string]$OutOfScope = "不碰 .env 真值；不做未指派工单；不改外部资质事项"
)

$statusPath = Join-Path $RepoRoot "worklog\status.json"
if (-not (Test-Path $statusPath)) {
  throw "Missing status.json: $statusPath"
}

$status = Get-Content $statusPath -Raw | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($TicketId)) {
  $TicketId = ($status.nextTicket -split "[ /\(]")[0]
}

if ([string]::IsNullOrWhiteSpace($Title)) {
  $Title = "待补充标题"
}

$outputDir = Join-Path $RepoRoot "obsidian\generated"
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$outputPath = Join-Path $outputDir ("trae-ticket-" + $TicketId + ".md")

$content = @"
在 D:\大鹏\smart-tutor 实现 $TicketId：$Title

1. 目标
- $Goal

2. 后端改哪些文件 / 新建哪些 route
- $BackendFiles

3. 前端改哪些页面（小程序在 wxapp/pages/...）
- $FrontendPages

4. schema 是否改（改了必须写 npx prisma db push）
- $SchemaChange

5. 验收清单（PASS/FAIL 可机器判断）
- $Acceptance

6. 不做哪些事（防止范围膨胀）
- $OutOfScope

7. 完成后生成 worklog/$TicketId.completed.json 并更新 status.json
"@

Set-Content -Path $outputPath -Value $content -Encoding UTF8
Write-Output $content
Write-Output ""
Write-Output "Saved to: $outputPath"
