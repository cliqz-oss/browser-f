cd %CQZ_WORKSPACE%\obj

set ff_version=''
set archivator_exe=c:\mozilla-build\7zip\7z.exe
for /F %%f in (..\mozilla-release\browser\config\version_display.txt) do set ff_version=%%f
set ff_exe=%ff_version%.en-US
echo %ff_exe%
if NOT "%lang%" == "" set ff_exe=%ff_version%.%lang%
echo %ff_exe%
echo %lang%

set timestamp_server_sha1=http://timestamp.verisign.com/scripts/timstamp.dll
set timestamp_server_sha256=http://sha256timestamp.ws.symantec.com/sha256/timestamp
echo %CLZ_SIGNTOOL_PATH%

if exist ./pkg%STUB_PREFIX%_%lang% rmdir /q /s "pkg%STUB_PREFIX%_%lang%"
%archivator_exe% l dist\install\sea\cliqz-%ff_exe%.win32.installer%STUB_PREFIX%.exe
%archivator_exe% x -opkg%STUB_PREFIX%_%lang% -y dist\install\sea\cliqz-%ff_exe%.win32.installer%STUB_PREFIX%.exe
if not exist ./pkg%STUB_PREFIX%_%lang% (goto :error)
cd pkg%STUB_PREFIX%_%lang%
for /R %%f in (
  *.exe *.dll
) do (
  rem Check does file already have a digital sign. If not - try to create one
  echo Check and sign %%f
  "%CLZ_SIGNTOOL_PATH%" verify /pa %%f
  if ERRORLEVEL 1 (
    "%CLZ_SIGNTOOL_PATH%" sign /t %timestamp_server_sha1% /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% %%f
    "%CLZ_SIGNTOOL_PATH%" sign /fd sha256 /tr %timestamp_server_sha256% /td sha256 /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% /as %%f
    "%CLZ_SIGNTOOL_PATH%" verify /pa %%f
  )
  if ERRORLEVEL 1 (goto :error)
)

if defined STUB_PREFIX goto prepare_stub_installer
rem Prepare usual installer
del installer.7z
%archivator_exe% a -r -t7z installer.7z -mx -m0=BCJ2 -m1=LZMA:d25 -m2=LZMA:d19 -m3=LZMA:d1 -mb0:1 -mb0s1:2 -mb0s2:3
cd ..
copy /b browser\installer\windows\instgen\7zSD.sfx + browser\installer\windows\instgen\app.tag + pkg_%lang%\installer.7z dist\install\sea\cliqz-%ff_exe%.win32.installer.exe
goto sign_installer

:prepare_stub_installer
del stub.7z
%archivator_exe% a -t7z stub.7z setup-stub.exe -mx -m0=BCJ2 -m1=LZMA:d21 -m2=LZMA:d17 -m3=LZMA:d17 -mb0:1 -mb0s1:2 -mb0s2:3
cd ..
copy /b browser\installer\windows\instgen\7zSD.sfx + browser\installer\windows\instgen\stub.tag + pkg%STUB_PREFIX%_%lang%\stub.7z dist\install\sea\cliqz-%ff_exe%.win32.installer-stub.exe

:sign_installer
"%CLZ_SIGNTOOL_PATH%" sign /t %timestamp_server_sha1% /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% dist\install\sea\cliqz-%ff_exe%.win32.installer%STUB_PREFIX%.exe
"%CLZ_SIGNTOOL_PATH%" sign /fd sha256 /tr %timestamp_server_sha256% /td sha256 /f %CLZ_CERTIFICATE_PATH% /p %CLZ_CERTIFICATE_PWD% /as dist\install\sea\cliqz-%ff_exe%.win32.installer%STUB_PREFIX%.exe
"%CLZ_SIGNTOOL_PATH%" verify /pa dist\install\sea\cliqz-%ff_exe%.win32.installer%STUB_PREFIX%.exe
if ERRORLEVEL 1 (goto :error)

goto :eof

:error
exit /b 1
