@echo off
cd /d "%~dp0"
echo ============================================
echo   smart-tutor Cloudflare Tunnel (named)
echo   Domain: api.bbbpeter2025.top
echo ============================================
echo.
echo Starting named tunnel - exposing localhost:3000
echo Public URL: https://api.bbbpeter2025.top
echo Config file: %USERPROFILE%\.cloudflared\config.yml
echo Tip: run install-tunnel-service.bat once to enable autostart.
echo Close this window to stop the tunnel.
echo --------------------------------------------
echo.
cloudflared.exe tunnel run smart-tutor
echo.
echo Tunnel stopped. Press any key to close.
pause >nul
