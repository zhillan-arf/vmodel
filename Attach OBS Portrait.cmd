@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Run Setup VModel.cmd first.
  pause
  exit /b 1
)
node scripts\configure_obs.mjs --attach --portrait
pause
