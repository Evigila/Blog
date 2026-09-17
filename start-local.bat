@echo off
setlocal

set "PROJECT_DIR=%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%script\start-local.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo Local preview failed with exit code %EXIT_CODE%.
    pause
)

endlocal & exit /b %EXIT_CODE%
