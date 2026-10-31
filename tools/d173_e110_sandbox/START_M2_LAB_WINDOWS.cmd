@echo off
setlocal
title SUPRA D173 M2 LOCAL LAB ONLY
cd /d "%~dp0..\.."
where node >nul 2>nul || (
  echo [FAIL] Node.js 22+ chua duoc cai tren may test.
  echo Cai Node.js va chay lai. Khong ket noi he thong Production.
  pause
  exit /b 1
)
if not exist "service\node_modules\wrangler\bin\wrangler.js" (
  echo Cai dat tool local Wrangler, khong deploy provider...
  call npm install --prefix service --no-audit --no-fund
  if errorlevel 1 (echo [FAIL] Cai tool local khong thanh cong.&pause&exit /b 1)
)
echo -----------------------------------------------------------
echo SUPRA D173 M2 LAB - KHONG PRODUCTION
echo Web: http://127.0.0.1:9897
echo Backend: Durable Object SQLite chi trong local Wrangler
echo Dong cua so nay se dung LAB
echo -----------------------------------------------------------
start "" "http://127.0.0.1:9897"
node service\node_modules\wrangler\bin\wrangler.js dev --config tools\d173_e110_sandbox\wrangler.toml --local --ip 127.0.0.1 --port 9897
pause
