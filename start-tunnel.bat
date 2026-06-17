@echo off
echo ============================================
echo  Srivani ERP - Cloudflare Tunnel Launcher
echo ============================================
echo.
echo Starting NestJS backend first...
start "Backend" cmd /k "cd /d J:\SVN\SVN_26\backend && npm run start:dev"

echo Waiting 10 seconds for backend to start...
timeout /t 10 /nobreak >nul

echo.
echo Starting Cloudflare Tunnel on port 4001...
echo.
echo ============================================
echo  COPY THE https://xxxxx.trycloudflare.com
echo  URL below and set it in Vercel env vars:
echo
echo  NEXT_PUBLIC_API_URL = https://xxxx.../api
echo  NEXT_PUBLIC_WS_URL  = https://xxxx.../events
echo ============================================
echo.
npx cloudflared tunnel --url http://localhost:4001
