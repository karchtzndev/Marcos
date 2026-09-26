@echo off
title Agente de impressao - O Markin
cd /d "%~dp0"
if not exist node_modules (
  echo Primeira vez: instalando...
  call npm install
)
:loop
node agente.js
echo.
echo O agente parou. Reiniciando em 10 segundos...
timeout /t 10 /nobreak >nul
goto loop
