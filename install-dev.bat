@echo off

echo NPM install. This can take a moment ...
npm install
npm i -g bower
npm i -g eslint
npm i -g eslint-plugin-html
npm i -g polymer-cli
npm run build

pause
goto:eof

:END
