param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$TicketId = "",
  [string]$Title = "",
  [string]$Goal = "Complete one bounded ticket only. Do not expand scope.",
  [string]$BackendFiles = "",
  [string]$FrontendPages = "",
  [string]$SchemaChange = "No, unless the ticket explicitly requires it.",
  [string]$Acceptance = "PASS 0 dev server health; npx tsc --noEmit; npm run build; update worklog",
  [string]$OutOfScope = "Do not touch .env secrets; do not do unassigned tickets; do not handle external qualification steps"
)

$ErrorActionPreference = "Stop"
$statusPath = Join-Path $RepoRoot "worklog\status.json"
if (-not (Test-Path $statusPath)) {
  throw "Missing status.json: $statusPath"
}

$status = Get-Content $statusPath -Encoding UTF8 -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($TicketId)) {
  $TicketId = ($status.nextTicket -split "[ /(]")[0]
}
if ([string]::IsNullOrWhiteSpace($Title)) {
  $Title = "TODO title"
}

$outputDir = Join-Path $RepoRoot "obsidian\generated"
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
$outputPath = Join-Path $outputDir ("trae-ticket-" + $TicketId + ".md")

$content = @"
Implement $TicketId in D:\大鹏\smart-tutor: $Title

1. Goal
- $Goal

2. Backend files / routes
- $BackendFiles

3. Frontend pages (mini program under wxapp/pages/...)
- $FrontendPages

4. Schema change
- $SchemaChange

5. Acceptance
- $Acceptance

6. Out of scope
- $OutOfScope

7. Must output
- worklog/$TicketId.completed.json
- update worklog/status.json
"@

Set-Content -Path $outputPath -Value $content -Encoding UTF8
Write-Output $content
Write-Output ""
Write-Output "Saved to: $outputPath"
