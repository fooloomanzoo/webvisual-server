@echo off

echo NPM install. This can take a moment ...

cmd /C "cd %~dp0/ & npm.cmd update -g"
cmd /C "cd %~dp0/ & npm.cmd install"
cmd /C "cd %~dp0/views & bower.cmd update"
cmd /C "cd %~dp0/views & npm.cmd install"

pause
goto:eof

:END
