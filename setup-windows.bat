@echo off
setlocal
cd /d "%~dp0"
title SMH Collections - First-time Setup

echo ==============================================
echo         SMH COLLECTIONS - SETUP
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js 22.16+ or Node.js 24 LTS, then run this file again.
  echo https://nodejs.org/
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found. Reinstall Node.js with npm included.
  pause
  exit /b 1
)

echo Node version:
node --version
echo npm version:
npm --version
echo.

if not exist ".env" (
  copy ".env.example" ".env" >nul
  if errorlevel 1 (
    echo ERROR: Could not create .env from .env.example.
    pause
    exit /b 1
  )
  echo Created the private .env file.
) else (
  echo An existing .env file was found; it will not be overwritten.
)

node -e "const fs=require('fs');const crypto=require('crypto');const p='.env';const marker='REPLACE_WITH_64_HEX_CHARACTERS_FROM_CRYPTO_RANDOMBYTES';let s=fs.readFileSync(p,'utf8');if(s.includes(marker)){s=s.replace(marker,crypto.randomBytes(32).toString('hex'));fs.writeFileSync(p,s);console.log('Generated a fresh session secret in .env.');}else{console.log('Keeping the existing session secret.');}"
if errorlevel 1 (
  echo ERROR: Failed while preparing the environment file.
  pause
  exit /b 1
)

echo.
echo Installing dependencies. An internet connection is required.
echo.
npm install
if errorlevel 1 (
  echo.
  echo ERROR: npm install did not finish successfully.
  echo Check your internet connection and the npm error above, then rerun setup.
  pause
  exit /b 1
)

echo.
echo Setup complete. Run start-windows.bat to launch the site.
echo.
pause
