@echo off
echo Start Simple HTTP Server in /src/server/views ...

start chrome --new-window http://localhost:8000/src/demo
cmd /C "cd %~dp0/views & python -m SimpleHTTPServer 8000"
cmd /C "cd %~dp0/views & python -m http.server 8000"

pause
