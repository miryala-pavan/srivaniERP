@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Srivani ERP — Deploy backend to Hetzner VPS
REM Run this from your PC whenever you want to push an update
REM Usage: deploy-to-server.bat
REM ─────────────────────────────────────────────────────────────────────────────

SET SERVER_IP=5.223.45.82
SET SERVER_USER=root
SET APP_DIR=/var/srivani/app

echo ============================================
echo  Deploying Srivani ERP to Hetzner VPS...
echo ============================================
echo.

echo [1/4] Uploading backend source...
scp -r backend %SERVER_USER%@%SERVER_IP%:%APP_DIR%/

echo [2/4] Uploading scripts and nginx config...
scp -r scripts %SERVER_USER%@%SERVER_IP%:%APP_DIR%/

echo [3/4] Building and restarting on server...
ssh %SERVER_USER%@%SERVER_IP% "cd %APP_DIR%/backend && npm install --omit=dev && npx prisma migrate deploy && npm run build && pm2 restart srivani-backend || pm2 start dist/main.js --name srivani-backend && pm2 save"

echo [4/4] Done!
echo.
echo ============================================
echo  Deployed! API: https://api.yourdomain.com
echo ============================================
pause
