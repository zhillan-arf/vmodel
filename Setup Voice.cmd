@echo off
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 (
  echo Python was not found. Install Python 3.10 or newer, then run this again.
  echo See docs\voice-setup.md.
  pause
  exit /b 1
)
echo Setting up the local character voice. This downloads pinned public inputs and
echo may take several minutes the first time. An internet connection is needed.
echo.
python "scripts\voice\provision.py" %*
if errorlevel 1 goto failed
echo.
echo Voice setup complete. Open Start Voice Auditions.cmd to compare the voices.
exit /b 0
:failed
echo.
echo Voice setup did not complete. See the error above and docs\voice-setup.md.
pause
exit /b 1
