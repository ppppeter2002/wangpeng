@echo off
cd /d "%~dp0"
echo ============================================
echo   smart-tutor Cloudflare Tunnel
echo ============================================
echo.
echo Starting tunnel - exposing http://localhost:3000
echo A https://xxxx.trycloudflare.com URL will appear below.
echo Close this window to stop the tunnel.
echo --------------------------------------------
echo.
cloudflared.exe tunnel --url http://localhost:3000
echo.
echo Tunnel stopped. Press any key to close.
pause >nul
