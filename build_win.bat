::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
:: The main build script for CLIQZfox
::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

ECHO [%TIME%] BUILD.CMD STARTS =========

:::::::::::::::::::::::::::::::::::
:: BUILD PARAMETERS
::
:: Parameters must be set outside this script:
::  CQZ_BUILD_ID
::  CQZ_WORKSPACE - path to source code
::  CLZ_CERTIFICATE_PATH - path to certificate for digital signing
::  CLZ_CERTIFICATE_PWD - password for certificate
::  CQZ_GOOGLE_API_KEY - Google API key
::  MOZ_MOZILLA_API_KEY - Mozilla API key
::
:: Optional parameters:
::  CQZ_RELEASE_CHANNEL - if not set will be set to "beta"
::  CQZ_BUILD_DE_LOCALIZATION - set it to 1 if you need DE localization together with en-US
:::::::::::::::::::::::::::::::::::
IF "%CQZ_BUILD_ID%"=="" (
  ECHO "CQZ_BUILD_ID must be specified. Format YYYYMMDDHHMMSS, like 20160705124211"
  EXIT 1
)
IF "%CQZ_WORKSPACE%"=="" (
  ECHO "CQZ_WORKSPACE must be specified"
  EXIT 1
)

SET LANG=en-US
IF "%CQZ_RELEASE_CHANNEL%" == "" SET CQZ_RELEASE_CHANNEL=beta

SET CQZ_CERT_DB_PATH=C:\certdb
SET WIN32_REDIST_DIR=C:\Program Files (x86)\Microsoft Visual Studio 14.0\VC\redist\x86\Microsoft.VC140.CRT\
SET CLZ_SIGNTOOL_PATH=C:\Program Files (x86)\Windows Kits\10\bin\x64\signtool.exe

ECHO INFO: Build configuration - %CQZ_RELEASE_CHANNEL% win32 (Localization: %CQZ_BUILD_DE_LOCALIZATION%)

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
:: BUILD
:::::::::::::::::::::::::::::::::::
ECHO [%TIME%] INFO: Starting build
ECHO cd $CQZ_WORKSPACE ^^^&^^^& ./magic_build_and_package.sh --clobber | call C:\mozilla-build\start-shell-msvc2015.bat

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
exit

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Signing failed! Exiting.
  EXIT 1
)

IF DEFINED CQZ_BUILD_DE_LOCALIZATION (
  SET OLD_LANG=%LANG%
  SET LANG=de
  CD %CQZ_WORKSPACE%
  CALL sign_win.bat
  SET LANG=%OLD_LANG%

  IF ERRORLEVEL 1 (
    ECHO [%TIME%] ERROR: Signing DE failed! Exiting.
    EXIT 1
  )
)

:::::::::::::::::::::::::::::::::::
:: INJECT TAG AREA
:::::::::::::::::::::::::::::::::::
ECHO [%TIME%] INFO: Signing complete successful. Inject tagged area...
SET GOROOT=C:\Go
CD %CQZ_WORKSPACE%
CALL inject_tag_info.bat

IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Inject tag area failed! Exiting.
  EXIT 1
)

IF DEFINED CQZ_BUILD_DE_LOCALIZATION (
  SET OLD_LANG=%LANG%
  SET LANG=de
  CD %CQZ_WORKSPACE%
  CALL inject_tag_info.bat
  SET LANG=%OLD_LANG%

  IF ERRORLEVEL 1 (
    ECHO [%TIME%] ERROR: Inject tag area into DE failed! Exiting.
    EXIT 1
  )
)

:::::::::::::::::::::::::::::::::::
:: UPLOAD AND SUBMIT
:::::::::::::::::::::::::::::::::::
ECHO [%TIME%] INFO: Injected tag area successful. Uploading...
ECHO cd $CQZ_WORKSPACE ^^^&^^^& ./magic_upload_files.sh | call C:\mozilla-build\start-shell-msvc2015.bat
IF ERRORLEVEL 1 (
  ECHO [%TIME%] ERROR: Upload failed! Exiting.
  EXIT 1
)

ECHO [%TIME%] INFO: Upload successful. We are done here, thanks for watching.
