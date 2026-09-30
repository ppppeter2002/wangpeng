param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$worklogDir = Join-Path $RepoRoot "worklog"
$obsidianDir = Join-Path $RepoRoot "obsidian"
$generatedDir = Join-Path $obsidianDir "generated"
$statusPath = Join-Path $worklogDir "status.json"

if (-not (Test-Path $statusPath)) {
  throw "Missing status.json: $statusPath"
}

New-Item -ItemType Directory -Path $generatedDir -Force | Out-Null

$status = Get-Content $statusPath -Encoding UTF8 -Raw | ConvertFrom-Json
$latestCompletedFile = Get-ChildItem $worklogDir -Filter "T-*.completed.json" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$latestCompleted = $null
if ($latestCompletedFile) {
  $latestCompleted = Get-Content $latestCompletedFile.FullName -Encoding UTF8 -Raw | ConvertFrom-Json
}

$currentStatus = @()
$currentStatus += "# Current Status"
$currentStatus += ""
$currentStatus += "- Project: ``$($status.project)``"
$currentStatus += "- Last completed: ``$($status.lastCompleted)``"
$currentStatus += "- Next ticket: ``$($status.nextTicket)``"
$currentStatus += "- Last updated: ``$($status.lastUpdated)``"
if ($status.devServer) {
  $currentStatus += "- Dev server: running=``$($status.devServer.running)`` port=``$($status.devServer.port)``"
}
$currentStatus += ""
$currentStatus += "## Completed Tickets"
$currentStatus += ""
foreach ($ticket in $status.completedTickets) {
  $currentStatus += "- ``$ticket``"
}

if ($latestCompleted) {
  $currentStatus += ""
  $currentStatus += "## Latest Completion"
  $currentStatus += ""
  $currentStatus += "- Ticket: ``$($latestCompleted.ticketId)``"
  $currentStatus += "- Title: $($latestCompleted.title)"
  $currentStatus += "- Completed at: ``$($latestCompleted.completedAt)``"
  if ($latestCompleted.nextSuggestion) {
    $currentStatus += "- Next suggestion: $($latestCompleted.nextSuggestion)"
  }
}

Set-Content -Path (Join-Path $generatedDir "00-current-status.md") -Value ($currentStatus -join "`r`n") -Encoding UTF8

$dispatch = @()
$dispatch += "# Trae Dispatch"
$dispatch += ""
$dispatch += "## Dispatch Rules"
$dispatch += ""
$dispatch += "- One ticket at a time"
$dispatch += "- Keep backend/frontend/schema scope explicit"
$dispatch += "- Require PASS lines + worklog updates"
$dispatch += "- Do not touch secrets in ``.env``"
$dispatch += ""
$dispatch += "## Ready For Dispatch"
$dispatch += ""
$dispatch += "- Suggested next: ``$($status.nextTicket)``"
if ($latestCompleted -and $latestCompleted.nextSuggestion) {
  $dispatch += "- From latest completed file: $($latestCompleted.nextSuggestion)"
}
$dispatch += ""
$dispatch += "## External Actions"
$dispatch += ""
$dispatch += "- Mini program upload needs WeChat DevTools login"
$dispatch += "- ICP needs legal identity and hosting/domain purchase"
$dispatch += "- Service account messaging needs official account qualification"

Set-Content -Path (Join-Path $generatedDir "01-trae-dispatch.md") -Value ($dispatch -join "`r`n") -Encoding UTF8

Write-Output "Updated Obsidian dashboard:"
Write-Output (Join-Path $generatedDir "00-current-status.md")
Write-Output (Join-Path $generatedDir "01-trae-dispatch.md")
