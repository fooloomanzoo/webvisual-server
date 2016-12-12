@echo off

echo Build Polymer Project ...
cmd /C "cd %~dp0/views & node.exe index.js build"

pause
goto:eof

:END
