@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM Srivani ERP — Deploy to Hetzner VPS
REM Build locally first, then rsync only changed files (fast incremental deploys).
REM Usage: deploy-to-server.bat
REM ─────────────────────────────────────────────────────────────────────────────

SET SERVER=root@5.223.45.82
SET APP=/var/srivani/app

echo ============================================
echo  Deploying Srivani ERP to Hetzner VPS
echo ============================================
echo.

echo [1/5] Building backend...
cd backend
call npm run build
if errorlevel 1 ( echo BUILD FAILED & pause & exit /b 1 )
cd ..

echo [2/5] Building frontend...
cd frontend
call npm run build
if errorlevel 1 ( echo BUILD FAILED & pause & exit /b 1 )
cd ..

echo [3/5] Syncing backend dist (rsync)...
rsync -az --delete backend/dist/ %SERVER%:%APP%/backend/dist/
rsync -az backend/prisma/schema.prisma %SERVER%:%APP%/backend/prisma/

echo [4/5] Syncing frontend build (rsync — only changed files)...
rsync -az --delete frontend/.next/ %SERVER%:%APP%/frontend/.next/
rsync -az frontend/public/ %SERVER%:%APP%/frontend/public/

echo [5/5] Restarting services on server...
ssh %SERVER% "cd %APP%/backend && ./node_modules/.bin/prisma generate && pm2 restart srivani-backend && pm2 restart srivani-frontend && pm2 save && pm2 list"

echo.
echo ============================================
echo  Deploy complete!
echo  ERP:  https://erp.srivani.com
echo  API:  https://api.srivani.com
echo ============================================
pause
