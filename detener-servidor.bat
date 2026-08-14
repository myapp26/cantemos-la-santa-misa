@echo off
echo Buscando proceso en el puerto 5500 ...

set PID=
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5500" ^| findstr "LISTENING"') do set PID=%%p

if "%PID%"=="" (
    echo No se encontro ningun proceso escuchando en el puerto 5500.
) else (
    echo Encontrado proceso PID %PID%. Terminando...
    taskkill /PID %PID% /F
    echo Listo.
)

pause
