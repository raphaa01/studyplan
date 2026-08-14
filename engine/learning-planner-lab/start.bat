@echo off
setlocal
cd /d "%~dp0"
set "ENV_PYTHON="
if exist ".venv\Scripts\python.exe" .venv\Scripts\python.exe -c "import torch, fastapi, uvicorn" >nul 2>nul && set "ENV_PYTHON=%CD%\.venv\Scripts\python.exe"
if not defined ENV_PYTHON if exist "..\..\.venv\Scripts\python.exe" ..\..\.venv\Scripts\python.exe -c "import torch, fastapi, uvicorn" >nul 2>nul && set "ENV_PYTHON=%CD%\..\..\.venv\Scripts\python.exe"
if not defined ENV_PYTHON if exist "%LOCALAPPDATA%\QECoreLab\venv\Scripts\python.exe" "%LOCALAPPDATA%\QECoreLab\venv\Scripts\python.exe" -c "import torch, fastapi, uvicorn" >nul 2>nul && set "ENV_PYTHON=%LOCALAPPDATA%\QECoreLab\venv\Scripts\python.exe"
if not defined ENV_PYTHON (
  echo Local environment missing. Run setup.bat first.
  pause
  exit /b 1
)
if not exist frontend\dist\index.html (
  echo Frontend build missing. Run setup.bat first.
  pause
  exit /b 1
)
echo Learning Planner Lab is starting at http://127.0.0.1:8000
echo Press Ctrl+C to stop it cleanly.
"%ENV_PYTHON%" -m uvicorn learning_lab.api:app --app-dir backend --host 127.0.0.1 --port 8000
