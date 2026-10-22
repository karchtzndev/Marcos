@echo off
chcp 65001 >nul
title Diagnostico - O Markin
setlocal EnableDelayedExpansion

REM Junta num lugar so tudo que decide se a impressao funciona. Nao muda nada:
REM so le e mostra. No fim copia o relatorio para a area de transferencia, para
REM poder colar numa conversa sem ninguem precisar digitar nada.
REM
REM A SENHA NUNCA APARECE AQUI. O config.json tem a senha da conta da
REM impressora, e este relatorio vai parar em conversa de WhatsApp.

set "REL=%TEMP%\markin-diagnostico.txt"
if exist "%REL%" del "%REL%"

call :diz "===== DIAGNOSTICO O MARKIN ====="
call :diz "data: %DATE% %TIME%"
call :diz "computador: %COMPUTERNAME%  usuario: %USERNAME%"
call :diz ""

call :diz "----- 1. Node -----"
where node >nul 2>&1
if errorlevel 1 (
  call :diz "[X] Node NAO instalado. O agente nao roda sem ele."
) else (
  for /f "delims=" %%N in ('where node') do call :diz "[ok] %%N"
  for /f "delims=" %%V in ('node -v') do call :diz "[ok] versao %%V"
)
call :diz ""

call :diz "----- 2. Impressoras no Windows -----"
powershell -NoProfile -Command "try{ Get-Printer | Select-Object Name,DriverName,Shared,ShareName,PortName | Format-Table -AutoSize | Out-String -Width 200 }catch{ 'nao consegui listar: ' + $_.Exception.Message }" >> "%REL%" 2>&1
call :diz ""

call :diz "----- 3. Portas USB vistas -----"
powershell -NoProfile -Command "try{ $p=@(Get-PrinterPort | Where-Object {$_.Name -like 'USB*'} | Select-Object -ExpandProperty Name); if($p.Count -eq 0){ '[X] nenhuma porta USB. Impressora desligada ou cabo fora?' } else { $p -join ', ' } }catch{ $_.Exception.Message }" >> "%REL%" 2>&1
call :diz ""

call :diz "----- 4. Agentes instalados -----"
set "BASE=%USERPROFILE%\markin-agentes"
if not exist "%BASE%" (
  call :diz "[X] a pasta %BASE% nao existe. O instalador nao chegou ate o fim."
  goto :tarefas
)
for /d %%D in ("%BASE%\agente-*") do (
  call :diz ""
  call :diz "  >> %%~nxD"
  if exist "%%D\config.json" (
    REM Mostra o config SEM a senha: troca o valor por asteriscos antes de imprimir.
    powershell -NoProfile -Command "$c=Get-Content -Raw '%%D\config.json' | ConvertFrom-Json; $c.senha='(ocultada)'; if($c.firebase){$c.firebase='(padrao)'}; $c | ConvertTo-Json -Compress" >> "%REL%" 2>&1
  ) else (
    call :diz "     [X] sem config.json"
  )
  if exist "%%D\node_modules" (call :diz "     [ok] dependencias instaladas") else (call :diz "     [X] faltou o npm install")
  if exist "%%D\agente.log" (
    call :diz "     ---- ultimas 25 linhas do agente.log ----"
    powershell -NoProfile -Command "Get-Content -Tail 25 '%%D\agente.log'" >> "%REL%" 2>&1
  ) else (
    call :diz "     [X] sem agente.log: o agente nunca chegou a rodar."
  )
)

:tarefas
call :diz ""
call :diz "----- 5. Tarefas agendadas -----"
powershell -NoProfile -Command "$t=@(Get-ScheduledTask | Where-Object {$_.TaskName -like 'Markin*'}); if($t.Count -eq 0){ '[X] nenhuma tarefa Markin registrada' } else { $t | ForEach-Object { $i=$_ | Get-ScheduledTaskInfo; '{0} | estado {1} | ultimo resultado {2} | rodou em {3}' -f $_.TaskName,$_.State,$i.LastTaskResult,$i.LastRunTime } }" >> "%REL%" 2>&1
call :diz ""

call :diz "----- 6. Node rodando agora -----"
powershell -NoProfile -Command "$p=@(Get-Process node -ErrorAction SilentlyContinue); if($p.Count -eq 0){ '[X] nenhum processo node. Os agentes nao estao de pe.' } else { ('[ok] ' + $p.Count + ' processo(s) node') }" >> "%REL%" 2>&1
call :diz ""

call :diz "----- 7. Internet -----"
powershell -NoProfile -Command "foreach($h in @('firestore.googleapis.com','identitytoolkit.googleapis.com','raw.githubusercontent.com')){ try{ $r=Invoke-WebRequest -Uri ('https://'+$h) -Method Head -TimeoutSec 8 -UseBasicParsing; '[ok] '+$h }catch{ if($_.Exception.Response){ '[ok] '+$h+' (respondeu)' } else { '[X] '+$h+' nao respondeu' } } }" >> "%REL%" 2>&1

call :diz ""
call :diz "===== FIM ====="

type "%REL%"
powershell -NoProfile -Command "Get-Content -Raw '%REL%' | Set-Clipboard" >nul 2>&1
echo.
echo   O relatorio acima foi copiado. Cole na conversa.
echo   Ele tambem esta salvo em: %REL%
echo.
pause
exit /b

:diz
echo %~1
echo %~1>> "%REL%"
exit /b
