@echo off

echo Build Polymer Project ...
cmd /C "cd %~dp0/views & npm run generate build bundled"

pause
goto:eof

:END
