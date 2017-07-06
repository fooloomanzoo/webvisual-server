@echo off

for /f %%a in ('git describe --tags --abbrev^=0 origin/master') do set version=%%a

for /F "tokens=1,2,3 delims=." %%a in ("%VERSION%") do (
   set Major=%%a
   set Minor=%%b
   set Revision=%%c
)

set /A Revision=%Revision%+1

set VERSION=%Major%.%Minor%.%Revision%
echo Version: %VERSION%

for /f %%a in ('git log -1') do set LOG=%%a
echo Message: %LOG%

git tag %VERSION% -m "%LOG%"

pause
goto:eof

:END
