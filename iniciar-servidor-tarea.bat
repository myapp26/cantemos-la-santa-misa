@echo off
cd /d "%~dp0"
set LOGFILE=%~dp0logs\servidor.log

echo. >> "%LOGFILE%"
echo [%date% %time%] === Tarea programada: iniciando servidor === >> "%LOGFILE%"
echo [%date% %time%] Usuario: %USERNAME%  PATH: %PATH% >> "%LOGFILE%"

call npx --yes serve -l 5500 . >> "%LOGFILE%" 2>&1
set EXITCODE=%ERRORLEVEL%

echo [%date% %time%] npx serve termino con codigo %EXITCODE% >> "%LOGFILE%"
