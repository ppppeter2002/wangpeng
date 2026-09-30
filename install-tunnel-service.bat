@echo off
setlocal
cd /d "%~dp0"

set "CF_HOME=%USERPROFILE%\.cloudflared"
set "SOURCE_CONFIG=%~dp0config.yml"
set "TARGET_CONFIG=%CF_HOME%\config.yml"
set "TARGET_CREDENTIALS=%CF_HOME%\smart-tutor.json"

echo ============================================
echo   smart-tutor cloudflared service install
echo ============================================
echo.

if not exist "%~dp0cloudflared.exe" (
  echo [ERROR] cloudflared.exe not found in project root.
  pause
  exit /b 1
)

if not exist "%SOURCE_CONFIG%" (
  echo [ERROR] config.yml not found in project root.
  pause
  exit /b 1
)

if not exist "%CF_HOME%" mkdir "%CF_HOME%"

copy /Y "%SOURCE_CONFIG%" "%TARGET_CONFIG%" >nul
echo Copied config template to: %TARGET_CONFIG%

if not exist "%TARGET_CREDENTIALS%" (
  echo [WARN] Expected tunnel credentials JSON not found:
  echo        %TARGET_CREDENTIALS%
  echo.
  echo Edit %TARGET_CONFIG% if your credentials filename differs.
  echo Then place the JSON file under %CF_HOME% before rerunning.
  pause
)

echo Installing Windows service...
"%~dp0cloudflared.exe" service install
if errorlevel 1 (
  echo [ERROR] cloudflared service install failed.
  pause
  exit /b 1
)

echo.
echo Service installed. Verify with:
echo   sc query Cloudflared
echo   start https://api.bbbpeter2025.top/api/health
echo.
pause

