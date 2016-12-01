@echo off

echo Build Polymer Project ...
cmd /C "cd %~dp0/views & gulp"

echo Wait for Change
timeout /t 10

cmd /C "cd %~dp0/views & gulp \"watch\""

pause
goto:eof

:END
