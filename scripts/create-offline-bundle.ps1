param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$BackupRoot = "D:\大鹏\smart-tutor-backups"
)

$ErrorActionPreference = "Stop"
$bundleDir = Join-Path $BackupRoot "bundles"
New-Item -ItemType Directory -Force -Path $bundleDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$bundlePath = Join-Path $bundleDir ("smart-tutor-$timestamp.bundle")

Push-Location $RepoRoot
try {
  git bundle create $bundlePath --all
  Write-Host "Bundle created: $bundlePath"
} finally {
  Pop-Location
}
