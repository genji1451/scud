@echo off
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\automation\install_daily_task.ps1"
echo.
if errorlevel 1 (
  echo Task installation failed. Read the error above.
) else (
  echo Daily automatic update is configured.
)
pause
