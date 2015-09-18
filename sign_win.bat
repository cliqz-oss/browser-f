cd %CQZ_WORKSPACE%\mozilla-release\obj-firefox

set ff_version=''
set archivator_exe=c:\mozilla-build\7zip\7z.exe
for /F %%f in (..\browser\config\version.txt) do set ff_version=%%f
set ff_exe=%ff_version%.en-US
echo %ff_exe%
if NOT "%lang%" == "" set ff_exe=%ff_version%.%lang%
echo %ff_exe%
echo %lang%

%archivator_exe% x -opkg -y dist\install\sea\CLIQZ-%ff_exe%.win32.installer.exe

echo %CLZ_SIGNTOOL_PATH%

"%CLZ_SIGNTOOL_PATH%" sign /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% dist\*.mar
"%CLZ_SIGNTOOL_PATH%" sign /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% pkg\setup.exe
"%CLZ_SIGNTOOL_PATH%" sign /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% pkg\core\updater.exe
"%CLZ_SIGNTOOL_PATH%" sign /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% pkg\core\CLIQZ.exe

cd pkg

del installer.7z
%archivator_exe% a -r -t7z installer.7z -mx -m0=BCJ2 -m1=LZMA:d25 -m2=LZMA:d19 -m3=LZMA:d1 -mb0:1 -mb0s1:2 -mb0s2:3
cd ..
copy /b browser\installer\windows\instgen\7zSD.sfx + browser\installer\windows\instgen\app.tag + pkg\installer.7z dist\install\sea\CLIQZ-%ff_exe%.win32.installer.exe

"%CLZ_SIGNTOOL_PATH%" sign /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% dist\install\sea\CLIQZ-%ff_exe%.win32.installer.exe
