@echo off
cd /d "%~dp0.."
if not exist ".tools\voice\venv\Scripts\python.exe" (
  echo Voice setup is missing. Run Setup Voice.cmd first, or see docs\voice-setup.md.
  pause
  exit /b 1
)
".tools\voice\venv\Scripts\python.exe" "scripts\voice\launch.py" %*
if errorlevel 1 pause
