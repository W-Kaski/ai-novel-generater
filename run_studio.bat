@echo off
title AI Novel Studio Launcher
echo ========================================================
echo        🚀 Starting AI Novel Studio Suite 🚀
echo ========================================================

echo [1/2] Launching Python FastAPI Backend Server...
start /b cmd /c ".venv\Scripts\python server.py"

echo Waiting for backend server to warm up (3 seconds)...
timeout /t 3 /nobreak >nul

echo [2/2] Launching Tauri v2 Desktop Interface...
cd frontend
npm run tauri dev

echo ========================================================
echo           AI Novel Studio has exited.
echo ========================================================
pause
