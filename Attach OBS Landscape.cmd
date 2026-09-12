@echo off
cd /d "%~dp0"
node scripts\configure_obs.mjs --attach
pause
