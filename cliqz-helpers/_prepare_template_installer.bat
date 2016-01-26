@echo off
rem Batch file for create tagged area in signed binary file
rem Two parameters:
rem  - signed installer in which we want to inject data (without .exe extension)
rem  - data for injecting in next format "key1=value1&key2=value&..."
rem GO must be installed and path placed into GOROOT env. settings

set _argcActual=0
for %%i in (%*) do set /A _argcActual+=1
if %_argcActual% NEQ 2 (
  echo Two params, please
  goto :eof
)

rem create intermediate version, with tag zone but without data
rem information about using could be found in omaha project, omaha_builders.py file
set GOROOT=c:\utils\omaha\go
"%GOROOT%\bin\go.exe" run certificate_tag.go -set-superfluous-cert-tag=Gact2.0Omaha -padded-length=8206 -out %1_intermediate.exe %1.exe

rem put information
ApplyTag.exe %1_intermediate.exe %1_tagged.exe %2
