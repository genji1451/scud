@echo off
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\automation\update_scud_data.ps1"
echo.
if errorlevel 1 (
  echo Update failed. Read the error above.
) else (
  echo Update completed successfully.
)
pause
