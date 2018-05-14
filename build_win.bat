::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
:: The main build script for CLIQZfox
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

ECHO [%TIME%] BUILD.CMD STARTS =========

::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
:: BUILD PARAMETERS
::
:: All parameters are optional (with some default vaules)
::  CQZ_BUILD_ID - Timestamp in format YYYYMMDDHHMMSS. Internally used by Firefox
::                 as MOZ_BUILD_DATE. In Cliqz browser on build process downloading
::                 an extensions from predefined path, which based on this timestamp.
::                 Default: will be taken last build id from repository.cliqz.com.
::                 It must be not possible to upload files from developer machine to S3 bucket)
::
::  CQZ_WORKSPACE - path to source code.
::                  Default: a folder from where this script will be running
::
::  CQZ_BUILD_64BIT_WINDOWS - flag to build 64-bit browser.
::                            Default: not specified.
::
::  CLZ_CERTIFICATE_PATH - path to certificate for digital signing
::                         Default: not specified, signing and futher steps will not procceed
::  CLZ_CERTIFICATE_PWD  - password for certificate
::                         Default: not specified, signing and futher steps will not procceed
::
::  CQZ_RELEASE_CHANNEL - which version to build
::                        Default: beta
::
::  CQZ_BUILD_DE_LOCALIZATION - flag to build DE localization together with en-US
::                              Default: not specified
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
IF "%CQZ_WORKSPACE%"=="" SET CQZ_WORKSPACE=%cd%
SET LANG=en-US
SET CQZ_CERT_DB_PATH=C:\certdb
SET BUILD_SHELL=c:\mozilla-build\start-shell.bat
SET CLZ_SIGNTOOL_PATH=C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe

:::::::::::::::::::::::::::::::::::
:: Information about build
:::::::::::::::::::::::::::::::::::
SET LOCALIZATION_INFO=Localization: en-US
IF "%CQZ_BUILD_DE_LOCALIZATION%"=="1" (
  SET LOCALIZATION_INFO=%LOCALIZATION_INFO%, de
)
IF "%CQZ_BUILD_64BIT_WINDOWS%"=="1" (
  SET PLATFORM_INFO=64 bit
) ELSE (
  SET PLATFORM_INFO=32 bit
)
IF "%CQZ_RELEASE_CHANNEL%"=="" (
  SET CHANNEL_INFO=beta
) ELSE (
  SET CHANNEL_INFO=%CQZ_RELEASE_CHANNEL%
)
ECHO INFO: Build configuration - %CHANNEL_INFO% channel, %PLATFORM_INFO% (%LOCALIZATION_INFO%)

:::::::::::::::::::::::::::::::::::
:: CERTIFICATE DB SETUP
:::::::::::::::::::::::::::::::::::
ECHO INFO: Setting up cert db

MD %CQZ_CERT_DB_PATH%
C:
CD C:\nss
certutil -N -d %CQZ_CERT_DB_PATH% -f emptypw.txt
@pk12util -i %CLZ_CERTIFICATE_PATH% -W %CLZ_CERTIFICATE_PWD% -d %CQZ_CERT_DB_PATH%

:::::::::::::::::::::::::::::::::::
:: BOOTSTRAP
:::::::::::::::::::::::::::::::::::
ECHO [%TIME%] INFO: Launch bootstrap stage

ECHO cd $CQZ_WORKSPACE ^^^&^^^& ./download_windows_artifacts.sh | call %BUILD_SHELL%

SET RUSTC=c:\build\rustc\bin\rustc
SET CARGO=c:\build\rustc\bin\cargo
SET LLVM_CONFIG=c:\build\clang\bin\llvm-config
IF "%CQZ_BUILD_64BIT_WINDOWS%"=="1" (
  SET WIN32_REDIST_DIR=c:\build\redist\msvc\x64\
  SET WIN_UCRT_REDIST_DIR=c:\build\redist\ucrt\DLLs\x64\
) ELSE (
  SET WIN32_REDIST_DIR=c:\build\redist\msvc\x86\
  SET WIN_UCRT_REDIST_DIR=c:\build\redist\ucrt\DLLs\x86\
)

:::::::::::::::::::::::::::::::::::
:: BUILD
:::::::::::::::::::::::::::::::::::
ECHO [%TIME%] INFO: Starting build
ECHO cd $CQZ_WORKSPACE ^^^&^^^& ./magic_build_and_package.sh --clobber | call %BUILD_SHELL%

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Build failed! Exiting.
  EXIT 1
)

:::::::::::::::::::::::::::::::::::
:: SIGNING
:::::::::::::::::::::::::::::::::::
ECHO [%TIME%] INFO: Build successful. Signing...
CD %CQZ_WORKSPACE%
CALL sign_win.bat

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Signing failed! Exiting.
  EXIT 1
)

SET OLD_LANG=%LANG%
SET LANG=de
IF "%CQZ_BUILD_DE_LOCALIZATION%"=="1" (
  CD %CQZ_WORKSPACE%
  CALL sign_win.bat

  IF ERRORLEVEL 1 (
    ECHO [%TIME%] ERROR: Signing DE failed! Exiting.
    EXIT 1
  )
)
SET LANG=%OLD_LANG%

::::::::::::::::::::::::::::::::::::::::
:: SIGNING STUB INSTALLER, only 32-bit
::::::::::::::::::::::::::::::::::::::::
IF "%CQZ_BUILD_64BIT_WINDOWS%"=="1" GOTO inject_tag_area

ECHO [%TIME%] INFO: Build successful. Signing...
CD %CQZ_WORKSPACE%
set STUB_PREFIX=-stub
CALL sign_win.bat

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Signing failed! Exiting.
  EXIT 1
)

SET OLD_LANG=%LANG%
SET LANG=de
IF "%CQZ_BUILD_DE_LOCALIZATION%"=="1" (
  CD %CQZ_WORKSPACE%
  CALL sign_win.bat

  IF ERRORLEVEL 1 (
    ECHO [%TIME%] ERROR: Signing DE failed! Exiting.
    EXIT 1
  )
)
SET LANG=%OLD_LANG%
set STUB_PREFIX=

:::::::::::::::::::::::::::::::::::
:: INJECT TAG AREA
:::::::::::::::::::::::::::::::::::
:inject_tag_area
ECHO [%TIME%] INFO: Signing complete successful. Inject tagged area...
SET GOROOT=C:\Go
CD %CQZ_WORKSPACE%
CALL inject_tag_info.bat

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Inject tag area failed! Exiting.
  EXIT 1
)

SET OLD_LANG=%LANG%
SET LANG=de
IF "%CQZ_BUILD_DE_LOCALIZATION%"=="1" (
  CD %CQZ_WORKSPACE%
  CALL inject_tag_info.bat

  IF ERRORLEVEL 1 (
    ECHO [%TIME%] ERROR: Inject tag area into DE failed! Exiting.
    EXIT 1
  )
)
SET LANG=%OLD_LANG%

:::::::::::::::::::::::::::::::::::
:: UPLOAD AND SUBMIT
:::::::::::::::::::::::::::::::::::
ECHO [%TIME%] INFO: Injected tag area successful. Uploading...
ECHO cd $CQZ_WORKSPACE ^^^&^^^& ./magic_upload_files.sh | call %BUILD_SHELL%
IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Upload failed! Exiting.
  EXIT 1
)

ECHO [%TIME%] INFO: Upload successful. We are done here, thanks for watching.
