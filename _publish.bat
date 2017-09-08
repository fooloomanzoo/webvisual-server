@echo off

echo Publish Webvisual-Server ...
npm run build
_push
npm publish

pause
goto:eof

:END
