@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
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
.venv\Scripts\python.exe -m uvicorn learning_lab.api:app --app-dir backend --host 127.0.0.1 --port 8000
