@echo off

echo Build Polymer Project ...
cmd /C "cd %~dp0/views & node.exe build"

pause
goto:eof

:END
