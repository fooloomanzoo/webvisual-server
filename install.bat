@echo off

echo NPM install. This can take a moment ...
cmd /C "cd %~dp0/ & npm.cmd update -g"
cmd /C "cd %~dp0/ & npm.cmd install"
cmd /C "cd %~dp0/ & bower.cmd update"
cmd /C "cd %~dp0/views & gulp"

pause
goto:eof

:END
