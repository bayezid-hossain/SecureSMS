@echo off
set "CONFIG_FILE=connect_config.txt"
set "ADB_EXE=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

:: Default values
set "LAST_IP=192.168.0.204"
set "LAST_PORT=39135"

:: Read config if exists
if exist "%CONFIG_FILE%" (
    for /f "tokens=1,2 delims=:" %%a in (%CONFIG_FILE%) do (
        set "LAST_IP=%%a"
        set "LAST_PORT=%%b"
    )
)

echo --- ADB Wireless Connection ---
set /p "DEVICE_IP=Enter Device IP [Default: %LAST_IP%]: "
if "%DEVICE_IP%" == "" set "DEVICE_IP=%LAST_IP%"

set /p "DEVICE_PORT=Enter Device Port [Default: %LAST_PORT%]: "
if "%DEVICE_PORT%" == "" set "DEVICE_PORT=%LAST_PORT%"

:: Save config
echo %DEVICE_IP%:%DEVICE_PORT%> "%CONFIG_FILE%"

set "DEVICE_ADDRESS=%DEVICE_IP%:%DEVICE_PORT%"

if "%1" == "--pair" (
    echo Pairing with %DEVICE_ADDRESS%...
    "%ADB_EXE%" pair %DEVICE_ADDRESS%
    if %errorlevel% neq 0 (
        echo Pairing failed.
        pause
        exit /b %errorlevel%
    )
    echo Pairing successful.
)

echo Starting ADB Connection to %DEVICE_ADDRESS%...

:: kill-server if needed (optional, but reference had it)
"%ADB_EXE%" kill-server
"%ADB_EXE%" start-server

echo Attempting to connect...
"%ADB_EXE%" connect %DEVICE_ADDRESS%

echo.
echo Current Devices:
"%ADB_EXE%" devices
echo.

pause
