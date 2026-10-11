@echo off
setlocal
cd /d "%~dp0"
title SMH Collections - Development Server

if not exist ".env" (
  echo ERROR: .env is missing. Run setup-windows.bat first.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo ERROR: Dependencies are missing. Run setup-windows.bat first.
  pause
  exit /b 1
)

echo Starting SMH Collections...
echo Open http://localhost:3000/ after the server starts.
echo Keep this window open while using the website.
echo Press Ctrl+C to stop the server.
echo.
npm run dev
pause
