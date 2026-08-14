@echo off
cd /d "%~dp0"
echo Iniciando servidor local en http://localhost:5500 ...
npx serve -l 5500 .
pause
