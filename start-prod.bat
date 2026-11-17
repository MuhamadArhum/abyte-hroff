@echo off
cd /d "%~dp0"
title Abyte-EMS (Production/LAN)
set NODE_ENV=production

if not exist "server\.env" (
  echo [ERROR] server\.env is missing. Copy server\.env.example and set a strong JWT_SECRET.
  goto :error
)
findstr /I /C:"JWT_SECRET=" server\.env >nul
if errorlevel 1 (
  echo [ERROR] JWT_SECRET is not set in server\.env.
  goto :error
)
if not exist "server\prisma\dev.db" (
  echo [WARN] Database not found; run: cd server ^&^& npm run prisma:push
)

echo [INFO] Building client...
cd /d "%~dp0client"
call npm run build || goto :error

echo [INFO] Building server...
cd /d "%~dp0server"
call npm run build || goto :error

echo.
echo Starting Abyte-EMS server...
echo - Open on this PC: http://localhost:4000
echo - Open from LAN:   http://YOUR_PC_IP:4000 (same network)
echo - Press Ctrl+C to stop
echo.
node dist/index.js
if errorlevel 1 goto :error
goto :eof

:error
echo.
echo Startup/build failed. Check the errors above and your server\.env configuration.
pause
exit /b 1
