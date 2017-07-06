@echo off

echo Publish to github. This can take a moment ...
git submodule foreach "git add ."
git add .
echo.
echo Enter a Message for the Commit
set /p CommitMessage=
echo.
git submodule foreach "git commit -m '%CommitMessage%'"
git commit -m "%CommitMessage%"
echo.
_increm_version.bat
npm publish
git push --recurse-submodules=on-demand

pause
goto:eof

:END
