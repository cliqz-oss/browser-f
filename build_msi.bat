cd /d %CQZ_WORKSPACE%\obj

set ff_version=''
for /F %%f in (..\mozilla-release\browser\config\version_display.txt) do set ff_version=%%f
set ff_exe=%ff_version%.en-US
echo %ff_exe%
if NOT "%lang%" == "" set ff_exe=%ff_version%.%lang%
echo %ff_exe%
echo %lang%

set timestamp_server_sha1=http://timestamp.verisign.com/scripts/timstamp.dll
echo %CLZ_SIGNTOOL_PATH%

IF "%CQZ_BUILD_64BIT_WINDOWS%"=="1" (
  SET platform_prefix=win64
  SET arch=x86_64
) ELSE (
  SET platform_prefix=win32
  SET arch=x86
)

set installer_msi=.\dist\install\sea\cliqz-%ff_exe%.%platform_prefix%.installer_msi.exe
set msi_package=.\dist\install\sea\cliqz-%ff_exe%.%platform_prefix%.installer.msi

ECHO cd $CQZ_WORKSPACE/mozilla-release ^^^&^^^& ./mach repackage msi --wsx browser/installer/windows/msi/installer.wxs --version $FF_VERSION --locale $LANG --arch $ARCH --candle $TOOLTOOL_DIR/wix311-binaries/candle.exe --light $TOOLTOOL_DIR/wix311-binaries/light.exe --setupexe ../obj/$INSTALLER_MSI --output ../obj/$MSI_PACKAGE  | call %BUILD_SHELL%

"%CLZ_SIGNTOOL_PATH%" sign /t %timestamp_server_sha1% /f %WIN_CERT% /p %WIN_CERT_PASS% %msi_package%
"%CLZ_SIGNTOOL_PATH%" verify /pa %msi_package%
if ERRORLEVEL 1 (goto :error)

del %installer_msi%

goto :eof

:error
exit /b 1
