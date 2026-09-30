<#
  workbuddy-audit.ps1
  Read-only local audit script.
  Rules: do not write files, do not mutate DB, do not print secret values.
#>

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "===== [1/7] Environment ====="
Write-Host "Node: $(node -v 2>$null)"
Write-Host "NPM:  $(npm -v 2>$null)"
Write-Host "Path: $root"

Write-Host "`n===== [2/7] Key files ====="
$files = @(
  ".env",
  "src\server.ts",
  "src\routes\notification.ts",
  "src\routes\wx.ts",
  "src\lib\notification.ts",
  "src\lib\wechat-official.ts",
  "prisma\schema.prisma",
  "worklog\status.json"
)
foreach ($f in $files) {
  $p = Join-Path $root $f
  if (Test-Path $p) { Write-Host "  [OK]  $f" } else { Write-Host "  [MISSING] $f" }
}

Write-Host "`n===== [3/7] .env field presence only ====="
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  foreach ($l in Get-Content $envFile) {
    if ($l -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=") {
      $name = $matches[1]
      if ($name -match "KEY|SECRET|TOKEN|PASSWORD") { Write-Host "  [secret present, hidden] $name=***" }
      else { Write-Host "  [config] $name" }
    }
  }
} else {
  Write-Host "  [MISSING] .env"
}

Write-Host "`n===== [4/7] Prisma models ====="
$schema = Join-Path $root "prisma\schema.prisma"
if (Test-Path $schema) {
  $content = Get-Content $schema -Raw
  $models = [regex]::Matches($content, "model\s+(\w+)\s*\{")
  foreach ($m in $models) { Write-Host "  model $($m.Groups[1].Value)" }
}

Write-Host "`n===== [5/7] Dependencies ====="
if (Test-Path (Join-Path $root "node_modules")) { Write-Host "  [OK] node_modules exists" }
else { Write-Host "  [MISSING] node_modules -- run npm install" }
if (Test-Path (Join-Path $root "node_modules\openai")) { Write-Host "  [OK] openai installed" }
else { Write-Host "  [MISSING] openai not installed" }

Write-Host "`n===== [6/7] Build and typecheck ====="
npm run build 2>&1 | Select-Object -Last 5
npm run typecheck 2>&1 | Select-Object -Last 5

Write-Host "`n===== [7/7] Local health probes ====="
$ports = @(3000)
foreach ($p in $ports) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$p/api/health" -TimeoutSec 2 -UseBasicParsing
    Write-Host "  [UP] port $p -> $($r.StatusCode)"
  } catch {
    Write-Host "  [DOWN] port $p"
  }
}

Write-Host "`n===== DONE ====="
Write-Host "Read-only audit finished. No files or data were modified by this script."
