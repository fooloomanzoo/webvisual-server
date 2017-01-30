@echo off

echo Build Polymer Project ...
cmd /C "cd %~dp0/views & npm run build"

pause
goto:eof

:END
