@echo off
cd /d "%~dp0"
if not exist ".tools\voice\venv\Scripts\python.exe" (
  echo Voice setup is missing, so there is no voice service to stop.
  pause
  exit /b 0
)
".tools\voice\venv\Scripts\python.exe" "scripts\voice\launch.py" --stop
if errorlevel 1 pause
