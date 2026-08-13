@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Local environment missing. Run setup.bat first.
  exit /b 1
)
start "Learning Lab Backend" /D "%CD%" .venv\Scripts\python.exe -m uvicorn learning_lab.api:app --app-dir backend --reload --host 127.0.0.1 --port 8000
start "Learning Lab Frontend" /D "%CD%\frontend" npm run dev
echo Development servers started. Open http://127.0.0.1:5173
