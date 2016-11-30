@echo off

echo NPM install. This can take a moment ...
cmd /C "cd %~dp0/src & npm.cmd update -g"
cmd /C "cd %~dp0/src & npm.cmd install"
cmd /C "cd %~dp0/src & bower.cmd update"

goto:eof

:END
