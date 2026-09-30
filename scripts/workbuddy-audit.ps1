<#
  workbuddy-audit.ps1
  用途：WorkBuddy 只读巡检脚本。
  规则：不写文件、不改库、不碰 .env 值、不打印密钥明文。
  用法：powershell -ExecutionPolicy Bypass -File scripts/workbuddy-audit.ps1
#>

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Write-Host "===== [1/7] 环境 ====="
Write-Host "Node: $(node -v 2>$null)"
Write-Host "NPM:  $(npm -v 2>$null)"
Write-Host "路径: $root"

Write-Host "`n===== [2/7] 关键文件存在性 ====="
$files = @(
  ".env",
  "src\server.ts",
  "src\lib\openai-client.ts",
  "src\lib\text-brain.ts",
  "src\lib\vision.ts",
  "src\lib\asr.ts",
  "src\lib\tts.ts",
  "src\lib\planner.ts",
  "src\lib\report-generator.ts",
  "src\routes\chat.ts",
  "src\routes\voice.ts",
  "src\routes\photo.ts",
  "src\routes\plan.ts",
  "src\routes\billing.ts",
  "src\routes\report.ts",
  "prisma\schema.prisma"
)
foreach ($f in $files) {
  $p = Join-Path $root $f
  if (Test-Path $p) { Write-Host "  [OK]  $f" }
  else { Write-Host "  [MISSING] $f" }
}

Write-Host "`n===== [3/7] .env 安全性（只检查字段是否存在，不打印值） ====="
$envFile = Join-Path $root ".env"
if (Test-Path $envFile) {
  $lines = Get-Content $envFile
  foreach ($l in $lines) {
    if ($l -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=") {
      $name = $matches[1]
      if ($name -match "KEY|SECRET|TOKEN|PASSWORD") {
        Write-Host "  [secret present, hidden] $name=***"
      } else {
        Write-Host "  [config] $name"
      }
    }
  }
} else { Write-Host "  [MISSING] .env" }

Write-Host "`n===== [4/7] Prisma schema 模型 ====="
$schema = Join-Path $root "prisma\schema.prisma"
if (Test-Path $schema) {
  $content = Get-Content $schema -Raw
  $models = [regex]::Matches($content, "model\s+(\w+)\s*\{")
  foreach ($m in $models) { Write-Host "  model $($m.Groups[1].Value)" }
}

Write-Host "`n===== [5/7] 依赖 ====="
if (Test-Path (Join-Path $root "node_modules")) { Write-Host "  [OK] node_modules exists" }
else { Write-Host "  [MISSING] node_modules — run npm install" }
if (Test-Path (Join-Path $root "node_modules\openai")) { Write-Host "  [OK] openai installed" }
else { Write-Host "  [MISSING] openai not installed" }

Write-Host "`n===== [6/7] 构建 & 类型检查 ====="
npm run build 2>&1 | Select-Object -Last 5
npm run typecheck 2>&1 | Select-Object -Last 5

Write-Host "`n===== [7/7] 服务存活探测（仅本地） ====="
$ports = @(3000, 3005, 3006)
foreach ($p in $ports) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:$p/api/health" -TimeoutSec 2 -UseBasicParsing
    Write-Host "  [UP] port $p -> $($r.StatusCode)"
  } catch {
    Write-Host "  [DOWN] port $p"
  }
}

Write-Host "`n===== DONE ====="
Write-Host "本脚本不读写数据库内容、不打印密钥明文、不修改任何文件。"
