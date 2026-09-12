@echo off
cd /d "%~dp0"
call npm.cmd ci
if errorlevel 1 goto failed
node scripts\provision_runtime.mjs
if errorlevel 1 goto failed
if not exist public\avatars mkdir public\avatars
if exist assets\avatars\ene.vrm copy /y assets\avatars\ene.vrm public\avatars\ene.vrm >nul
call npm.cmd run build
if errorlevel 1 goto failed
echo Setup complete. Open Start VModel.cmd.
exit /b 0
:failed
echo Setup did not complete. See the error above.
pause
exit /b 1
