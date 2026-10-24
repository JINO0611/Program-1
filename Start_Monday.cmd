@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto neednode
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
if errorlevel 1 goto neednode
start "REVODIX Monday Server" cmd /k node server.cjs
powershell -NoProfile -Command "for($i=0;$i -lt 20;$i++){try{Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8731/api/session' -TimeoutSec 1 | Out-Null; exit 0}catch{Start-Sleep -Milliseconds 500}}; exit 1"
if errorlevel 1 (
 echo Server did not start. Check the REVODIX Monday Server window.
 pause
 exit /b 1
)
start "" http://127.0.0.1:8731
exit /b 0
:neednode
echo Install Node.js 22 or later LTS from https://nodejs.org/ and run this file again.
pause
exit /b 1
