cd %CQZ_WORKSPACE%\obj

set ff_version=''
set archivator_exe=c:\mozilla-build\7zip\7z.exe
for /F %%f in (..\mozilla-release\browser\config\version.txt) do set ff_version=%%f
set ff_exe=%ff_version%.en-US
echo %ff_exe%
if NOT "%lang%" == "" set ff_exe=%ff_version%.%lang%
echo %ff_exe%
echo %lang%

set timestamp_server=http://timestamp.verisign.com/scripts/timstamp.dll

%archivator_exe% x -opkg -y dist\install\sea\CLIQZ-%ff_exe%.win32.installer.exe

echo %CLZ_SIGNTOOL_PATH%

for %%f in (
  pkg\core\CLIQZ.exe,
  pkg\core\crashreporter.exe,
  pkg\core\maintenanceservice.exe,
  pkg\core\maintenanceservice_installer.exe,
  pkg\core\plugin-container.exe,
  pkg\core\plugin-hang-ui.exe,
  pkg\core\uninstall\helper.exe,
  pkg\core\updater.exe,
  pkg\core\webapp-uninstaller.exe,
  pkg\core\webapprt-stub.exe,
  pkg\core\wow_helper.exe,
  pkg\setup.exe,
  pkg\core\AccessibleMarshal.dll,
  pkg\core\breakpadinjector.dll,
  pkg\core\browser\components\browsercomps.dll,
  pkg\core\freebl3.dll,
  pkg\core\gmp-clearkey\0.1\clearkey.dll,
  pkg\core\icudt52.dll,
  pkg\core\icuin52.dll,
  pkg\core\icuuc52.dll,
  pkg\core\libEGL.dll,
  pkg\core\libGLESv2.dll,
  pkg\core\mozalloc.dll,
  pkg\core\mozglue.dll,
  pkg\core\nss3.dll,
  pkg\core\nssckbi.dll,
  pkg\core\nssdbm3.dll,
  pkg\core\sandboxbroker.dll,
  pkg\core\softokn3.dll,
  pkg\core\xul.dll,
) do (
  "%CLZ_SIGNTOOL_PATH%" sign /t %timestamp_server% /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% %%f
  "%CLZ_SIGNTOOL_PATH%" verify /pa %%f
  if NOT %ERRORLEVEL%==0 exit /b 1
)

cd pkg

del installer.7z
%archivator_exe% a -r -t7z installer.7z -mx -m0=BCJ2 -m1=LZMA:d25 -m2=LZMA:d19 -m3=LZMA:d1 -mb0:1 -mb0s1:2 -mb0s2:3
cd ..
copy /b browser\installer\windows\instgen\7zSD.sfx + browser\installer\windows\instgen\app.tag + pkg\installer.7z dist\install\sea\CLIQZ-%ff_exe%.win32.installer.exe

"%CLZ_SIGNTOOL_PATH%" sign /t %timestamp_server% /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% dist\install\sea\CLIQZ-%ff_exe%.win32.installer.exe
"%CLZ_SIGNTOOL_PATH%" verify /pa dist\install\sea\CLIQZ-%ff_exe%.win32.installer.exe
exit /b %ERRORLEVEL%
