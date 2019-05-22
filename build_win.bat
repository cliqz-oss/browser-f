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
::  WIN_CERT - path to certificate for digital signing (path to cert)
::             Default: not specified, signing and futher steps will not procceed
::  WIN_CERT_PASS  - password for udpate certificate
::                   Default: not specified, signing and futher steps will not procceed
::
::  MAR_CERT - path to certificate for signing the update package (path to cert)
::             Default: not specified, signing and futher steps will not procceed
::  MAR_CERT_PASS  - password for udpate certificate
::                   Default: not specified, signing and futher steps will not procceed
::
::  CQZ_RELEASE_CHANNEL - which version to build
::                        Default: beta
::
::  CQZ_BUILD_DE_LOCALIZATION - flag to build DE localization together with en-US
::                              Default: not specified
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
IF "%CQZ_WORKSPACE%"=="" SET CQZ_WORKSPACE=%CD%
SET LANG=en-US
SET CQZ_CERT_DB_PATH=c:\certdb
SET BUILD_SHELL=c:\mozilla-build\start-shell.bat
:: Paths for build tools
SET TOOLTOOL_DIR=c:\build
SET CLZ_SIGNTOOL_PATH=%TOOLTOOL_DIR%\vs2017_15.9.10\SDK\bin\10.0.17763.0\x64\signtool.exe

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
CD /D C:\nss
certutil -N -d %CQZ_CERT_DB_PATH% -f emptypw.txt
@pk12util -i %MAR_CERT% -W %MAR_CERT_PASS% -d %CQZ_CERT_DB_PATH%

:::::::::::::::::::::::::::::::::::
:: Check and download build tools
:::::::::::::::::::::::::::::::::::
ECHO [%TIME%] INFO: Download build tools stage
ECHO cd $CQZ_WORKSPACE ^^^&^^^& ./download_windows_artifacts.sh | call %BUILD_SHELL%

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Build failed! Exiting.
  EXIT 1
)

:::::::::::::::::::::::::::::::::::
:: BUILD
:::::::::::::::::::::::::::::::::::
ECHO [%TIME%] INFO: Starting build
ECHO cd $CQZ_WORKSPACE ^^^&^^^& ./magic_build_and_package.sh --clobber --tests --symbols | call %BUILD_SHELL%

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Build failed! Exiting.
  EXIT 1
)

:::::::::::::::::::::::::::::::::::
:: SIGNING
:::::::::::::::::::::::::::::::::::
ECHO [%TIME%] INFO: Build successful. Signing...
CD /D %CQZ_WORKSPACE%
CALL sign_win.bat

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Signing failed! Exiting.
  EXIT 1
)

SET OLD_LANG=%LANG%
SET LANG=de
IF "%CQZ_BUILD_DE_LOCALIZATION%"=="1" (
  CD /D %CQZ_WORKSPACE%
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
CD /D %CQZ_WORKSPACE%
set STUB_PREFIX=-stub
CALL sign_win.bat

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Signing failed! Exiting.
  EXIT 1
)

SET OLD_LANG=%LANG%
SET LANG=de
IF "%CQZ_BUILD_DE_LOCALIZATION%"=="1" (
  CD /D %CQZ_WORKSPACE%
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
ECHO [%TIME%] INFO: Signing complete successful. Inject tagged area...
SET GOROOT=C:\Go
CD /D %CQZ_WORKSPACE%
CALL inject_tag_info.bat

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Inject tag area failed! Exiting.
  EXIT 1
)

SET OLD_LANG=%LANG%
SET LANG=de
IF "%CQZ_BUILD_DE_LOCALIZATION%"=="1" (
  CD /D %CQZ_WORKSPACE%
  CALL inject_tag_info.bat

  IF ERRORLEVEL 1 (
    ECHO [%TIME%] ERROR: Inject tag area into DE failed! Exiting.
    EXIT 1
  )
)
SET LANG=%OLD_LANG%

::::::::::::::::::::::::::::::::::::::::::::
:: Create and sign MSI installer (MSI0002)
::::::::::::::::::::::::::::::::::::::::::::

ECHO [%TIME%] INFO: Create and sign MSI package(s)
CD /D %CQZ_WORKSPACE%
CALL build_msi.bat

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Create MSI failed! Exiting.
  EXIT 1
)

SET OLD_LANG=%LANG%
SET LANG=de
IF "%CQZ_BUILD_DE_LOCALIZATION%"=="1" (
  CD /D %CQZ_WORKSPACE%
  CALL build_msi.bat

  IF ERRORLEVEL 1 (
    ECHO [%TIME%] ERROR: Create MSI failed! Exiting.
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
