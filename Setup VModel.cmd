@echo off
cd /d "%~dp0"
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js from nodejs.org, which includes npm,
  echo then run this again. Nothing has been changed.
  pause
  exit /b 1
)
call npm.cmd ci
if errorlevel 1 goto failed
node scripts\provision_runtime.mjs
if errorlevel 1 goto failed
if not exist public\avatars mkdir public\avatars
if exist assets\avatars\ene.vrm copy /y assets\avatars\ene.vrm public\avatars\ene.vrm >nul
call npm.cmd run build
if errorlevel 1 goto failed
echo Setup complete. Open Start VModel.cmd.
echo For the character voice, run Setup Voice.cmd as well.
exit /b 0
:failed
echo Setup did not complete. See the error above.
pause
exit /b 1
