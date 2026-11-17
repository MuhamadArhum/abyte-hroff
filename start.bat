@echo off
cd /d "%~dp0"
title Abyte-EMS (Development)

if not exist "server\.env" (
  echo [ERROR] server\.env is missing. Copy server\.env.example and set a strong JWT_SECRET.
  pause
  exit /b 1
)
if not exist "server\node_modules" (
  echo [INFO] Installing server dependencies...
  pushd "%~dp0server" && call npm install && popd || goto :error
)
if not exist "client\node_modules" (
  echo [INFO] Installing client dependencies...
  pushd "%~dp0client" && call npm install && popd || goto :error
)

echo Starting Abyte-EMS (server + client)...
echo Local: http://localhost:3001
echo LAN:   open http://YOUR_PC_IP:3001 from the same network (DB stays on this PC)
echo.

start "Abyte-EMS API" /D "%~dp0server" /min cmd /c "npm run dev"
cd /d "%~dp0client"
npm run dev
exit /b %ERRORLEVEL%

:error
echo.
echo Could not start Abyte-EMS. Check the errors above.
pause
exit /b 1
