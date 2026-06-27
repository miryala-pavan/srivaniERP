@echo off
REM ===========================================================
REM  Srivani Stores ERP - Dev Startup
REM  Kills any existing processes on 4000/4001/4002, then
REM  starts Docker + Backend + ERP Frontend + Storefront
REM ===========================================================

title Srivani ERP Startup

REM --- Ensure Docker CLI is on PATH ---
set PATH=%PATH%;C:\Program Files\Docker\Docker\resources\bin

cd /d J:\SVN\SVN_26

echo.
echo  ==================================================
echo   Srivani Stores ERP - Development Servers
echo  ==================================================
echo.

REM --- Kill any process using ports 4000, 4001, 4002 ---
echo [0/4] Freeing ports 4000, 4001, 4002...
for %%P in (4000 4001 4002) do (
    for /f "tokens=5" %%I in ('netstat -aon ^| findstr ":%%P " ^| findstr "LISTENING"') do (
        echo   Killing PID %%I on port %%P
        taskkill /PID %%I /F >nul 2>&1
    )
)
timeout /t 2 /nobreak >nul

echo.
echo [1/4] Starting PostgreSQL and Redis containers...
docker compose up postgres redis -d
if errorlevel 1 (
    echo.
    echo  ERROR: Could not start Docker containers.
    echo  Make sure Docker Desktop is running, then re-run this file.
    echo.
    pause
    exit /b 1
)

echo.
echo [2/4] Opening Backend window  (NestJS, port 4001)...
start "Srivani ERP - Backend [4001]" powershell -NoExit -Command ^
  "Set-Location 'J:\SVN\SVN_26\backend'; Write-Host '--- Backend (NestJS, port 4001) ---' -ForegroundColor Cyan; npm run start:dev"

REM Give the backend a few seconds to bind before frontends launch
timeout /t 5 /nobreak >nul

echo [3/4] Opening ERP Frontend window (Next.js, port 4000)...
start "Srivani ERP - Frontend [4000]" powershell -NoExit -Command ^
  "Set-Location 'J:\SVN\SVN_26\frontend'; Write-Host '--- ERP Frontend (Next.js, port 4000) ---' -ForegroundColor Green; npm run dev"

timeout /t 2 /nobreak >nul

echo [4/4] Opening Storefront window (Online Portal, port 4002)...
start "Srivani Storefront - Online Portal [4002]" powershell -NoExit -Command ^
  "Set-Location 'J:\SVN\SVN_26\storefront'; Write-Host '--- Online Portal (Next.js, port 4002) ---' -ForegroundColor Magenta; npm run dev"

echo.
echo  ==================================================
echo   All services launching!
echo  ==================================================
echo    ERP Frontend  :  http://localhost:4000
echo    Backend API   :  http://localhost:4001
echo    Online Portal :  http://localhost:4002
echo    Postgres      :  localhost:4432
echo    Redis         :  localhost:4379
echo  ==================================================
echo.
echo  Each server runs in its own PowerShell window.
echo  Close that window (or press Ctrl+C in it) to stop it.
echo  This launcher window can be closed safely.
echo.
pause
