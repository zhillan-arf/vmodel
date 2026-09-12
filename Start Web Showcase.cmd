@echo off
cd /d "%~dp0"
if not exist "node_modules\vite" (
  echo Project setup is missing. Run Setup VModel.cmd first.
  pause
  exit /b 1
)
if not exist "web-showcase\public\ene\manifest.json" (
  echo The website media package is missing. See docs\web-showcase.md.
  pause
  exit /b 1
)
echo Opening the Ene website showcase in your browser.
echo Leave this window open while you use the page; press Ctrl+C here when you are done.
start "" "http://127.0.0.1:5180/"
call npm run web:dev
if errorlevel 1 pause
