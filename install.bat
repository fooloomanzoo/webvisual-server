@echo off

echo NPM install. This can take a moment ...
taskkill /F /IM electron.exe /T
cmd /C "cd %~dp0/ & npm.cmd update -g"
cmd /C "cd %~dp0/ & npm.cmd install"
cmd /C "cd %~dp0/views & bower.cmd update"

pause
goto:eof

:END
