cd %CQZ_WORKSPACE%\obj

set ff_version=''
for /F %%f in (..\mozilla-release\browser\config\version_display.txt) do set ff_version=%%f
set ff_exe=%ff_version%.en-US
echo %ff_exe%
if NOT "%lang%" == "" set ff_exe=%ff_version%.%lang%
echo %ff_exe%
echo %lang%

set installer=dist\install\sea\CLIQZ-%ff_exe%.win32.installer.exe
set tmp_installer=dist\install\sea\CLIQZ-%ff_exe%.win32.installer_tmp.exe

rem Add tagged area to installer
"%GOROOT%\bin\go.exe" run ..\cliqz-helpers\certificate_tag.go -set-superfluous-cert-tag=Gact2.0Omaha -padded-length=8206 -out %tmp_installer% %installer%
del %installer%

rem inject template information
..\cliqz-helpers\ApplyTag.exe %tmp_installer% %installer% "brand=XXXXXXXXXX"
del %tmp_installer%

rem check installer still exist
if not exist %installer% set ERRORLEVEL=1

exit /b %ERRORLEVEL%
