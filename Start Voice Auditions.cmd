@echo off
cd /d "%~dp0"
if not exist ".tools\voice\venv\Scripts\python.exe" (
  echo Voice setup is missing. See docs\voice-setup.md.
  pause
  exit /b 1
)
echo Opening the voice listening room in your browser.
echo Leave this window open while you compare the voices; press Ctrl+C here when you are done.
start "" "http://127.0.0.1:5081/"
".tools\voice\venv\Scripts\python.exe" "scripts\voice\serve_auditions.py" %*
if errorlevel 1 pause
