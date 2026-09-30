@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   smart-tutor cloudflared service uninstall
echo ============================================
echo.

if not exist "%~dp0cloudflared.exe" (
  echo [ERROR] cloudflared.exe not found in project root.
  pause
  exit /b 1
)

"%~dp0cloudflared.exe" service uninstall
if errorlevel 1 (
  echo [ERROR] cloudflared service uninstall failed.
  pause
  exit /b 1
)

echo Service removed.
pause

