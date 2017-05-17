@echo off

echo NPM install. This can take a moment ...
cmd /C "cd %~dp0/ & npm.cmd install"

pause
goto:eof

:END
