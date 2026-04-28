@echo off
cd /d "%~dp0"
echo.
echo BOM Compare Tool - One-click install and run
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-and-run.ps1"
if errorlevel 1 pause
