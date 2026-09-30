param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$RemoteName = "localbackup"
)

$ErrorActionPreference = "Stop"
Push-Location $RepoRoot
try {
  $branch = git branch --show-current
  if (-not $branch) {
    throw "Cannot detect current branch"
  }

  git push $RemoteName $branch
  git push $RemoteName --tags
  Write-Host "Local backup push complete"
  Write-Host "Branch: $branch"
  git log -1 --oneline
} finally {
  Pop-Location
}
