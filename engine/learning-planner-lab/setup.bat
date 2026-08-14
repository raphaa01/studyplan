@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_BOOTSTRAP="
where py >nul 2>nul && set "PYTHON_BOOTSTRAP=py"
if not defined PYTHON_BOOTSTRAP if exist "..\..\.venv\Scripts\python.exe" set "PYTHON_BOOTSTRAP=%CD%\..\..\.venv\Scripts\python.exe"
if not defined PYTHON_BOOTSTRAP if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" set "PYTHON_BOOTSTRAP=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not defined PYTHON_BOOTSTRAP where python >nul 2>nul && python --version >nul 2>nul && set "PYTHON_BOOTSTRAP=python"

if not defined PYTHON_BOOTSTRAP (
  echo FEHLER: Python 3.11 oder neuer wurde nicht gefunden.
  echo Installiere Python von https://www.python.org/downloads/ und aktiviere "Add Python to PATH".
  goto :failed
)

set "ENV_PYTHON="
if exist ".venv\Scripts\python.exe" .venv\Scripts\python.exe -c "import torch, fastapi, uvicorn" >nul 2>nul && set "ENV_PYTHON=%CD%\.venv\Scripts\python.exe"
if not defined ENV_PYTHON if exist "..\..\.venv\Scripts\python.exe" ..\..\.venv\Scripts\python.exe -c "import torch, fastapi, uvicorn" >nul 2>nul && set "ENV_PYTHON=%CD%\..\..\.venv\Scripts\python.exe"
if not defined ENV_PYTHON if exist "%LOCALAPPDATA%\QECoreLab\venv\Scripts\python.exe" "%LOCALAPPDATA%\QECoreLab\venv\Scripts\python.exe" -c "import torch, fastapi, uvicorn" >nul 2>nul && set "ENV_PYTHON=%LOCALAPPDATA%\QECoreLab\venv\Scripts\python.exe"

if not defined ENV_PYTHON (
  set "LAB_ENV_DIR=%LOCALAPPDATA%\QECoreLab\venv"
  echo Erstelle Python-Umgebung unter %LOCALAPPDATA%\QECoreLab\venv...
  if /I "%PYTHON_BOOTSTRAP%"=="py" (
    py -3 -m venv "%LOCALAPPDATA%\QECoreLab\venv"
  ) else (
    "%PYTHON_BOOTSTRAP%" -m venv "%LOCALAPPDATA%\QECoreLab\venv"
  )
  if errorlevel 1 goto :failed
  set "ENV_PYTHON=%LOCALAPPDATA%\QECoreLab\venv\Scripts\python.exe"
)

echo Installiere lokale Python-Abhaengigkeiten...
"%ENV_PYTHON%" -m pip install --upgrade pip
if errorlevel 1 goto :failed
"%ENV_PYTHON%" -m pip install -r requirements-lock.txt
if errorlevel 1 goto :failed

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE (
  echo FEHLER: Node.js 20 oder neuer wurde nicht gefunden.
  echo Installiere Node.js von https://nodejs.org/
  goto :failed
)

echo Baue die lokale Web-Oberflaeche...
pushd frontend
if exist "..\..\..\node_modules\typescript\bin\tsc" if exist "..\..\..\node_modules\vite\bin\vite.js" (
  "%NODE_EXE%" "..\..\..\node_modules\typescript\bin\tsc" -b
  if errorlevel 1 goto :frontend_failed
  "%NODE_EXE%" "..\..\..\node_modules\vite\bin\vite.js" build
  if errorlevel 1 goto :frontend_failed
) else (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo FEHLER: npm wurde nicht gefunden. Installiere Node.js inklusive npm.
    goto :frontend_failed
  )
  call npm install
  if errorlevel 1 goto :frontend_failed
  call npm run build
  if errorlevel 1 goto :frontend_failed
)
popd

echo.
echo Setup abgeschlossen. Starte jetzt start.bat.
echo Danach im Browser: http://127.0.0.1:8000
pause
exit /b 0

:frontend_failed
popd
:failed
echo.
echo Das Setup ist fehlgeschlagen. Die Fehlermeldung steht direkt darueber.
pause
exit /b 1
