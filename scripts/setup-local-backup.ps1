param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$BackupRoot = "D:\大鹏\smart-tutor-backups",
  [string]$RemoteName = "localbackup"
)

$ErrorActionPreference = "Stop"
$gitMirror = Join-Path $BackupRoot "git\smart-tutor.git"
$bundleDir = Join-Path $BackupRoot "bundles"

New-Item -ItemType Directory -Force -Path $BackupRoot, $bundleDir, (Split-Path $gitMirror -Parent) | Out-Null

Push-Location $RepoRoot
try {
  if (-not (Test-Path $gitMirror)) {
    git init --bare $gitMirror | Out-Null
  }

  $remoteNames = git remote
  if ($remoteNames -notcontains $RemoteName) {
    git remote add $RemoteName $gitMirror
  } else {
    git remote set-url $RemoteName $gitMirror
  }

  Write-Host "Local backup remote ready"
  Write-Host "RemoteName : $RemoteName"
  Write-Host "MirrorPath : $gitMirror"
  Write-Host "BundleDir  : $bundleDir"
  git remote -v
} finally {
  Pop-Location
}
