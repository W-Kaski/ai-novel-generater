@echo off
echo ========================================================
echo        Starting AI Novel Studio (Browser Mode)
echo ========================================================

echo [1/2] Launching Python FastAPI Backend Server...
start /b cmd /c ".venv\Scripts\python server.py"

echo Waiting for backend server to warm up (3 seconds)...
ping -n 4 127.0.0.1 >nul

echo [2/2] Launching Vite React Dev Server...
cd frontend
start /b cmd /c "npm run dev"

echo Waiting for Vite dev server to warm up (2 seconds)...
ping -n 3 127.0.0.1 >nul

echo Opening AI Novel Studio in your browser...
start http://localhost:5173

echo ========================================================
echo     AI Novel Studio is running! Please keep this window open.
echo     To stop the servers, just close this terminal window.
echo ========================================================
