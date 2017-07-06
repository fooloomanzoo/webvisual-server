@echo off

echo NPM install. This can take a moment ...
npm install
npm i -g polymer-cli
npm i -g bower
npm run build

pause
goto:eof

:END
