@echo off
cd /d "%~dp0"
".tools\voice\venv\Scripts\python.exe" "scripts\voice\launch.py" --stop
if errorlevel 1 pause
