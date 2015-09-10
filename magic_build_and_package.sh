#! /bin/bash

# Required ENVs:
# * GIT_WIN_PATH
# * WIN32_REDIST_DIR

# set -u
set -e
set -x

LANG='en-US'
VERBOSE=false #TODO

while [[ $# > 1 ]]
do
    key="$1"

    case $key in
        -lang|--language)
        LANG="$2"
        shift # past argument
        ;;
        -v|--verbose)
        VERBOSE=true
        ;;
        *)
        echo "unknown option $key"
        exit
        ;;
    esac
    shift # past argument or value
done

if [[ "$OSTYPE" == "linux-gnu" ]]; then
    export IS_LINUX=true
    echo 'Linux OS detected'
elif [[ "$OSTYPE" == "darwin"* ]]; then
    export IS_MAC_OS=true
    echo 'MAC OS detected'
elif [[ "$OSTYPE" == "cygwin" ]]; then
    export IS_WIN=true
    echo 'WINDOWS OS detected'
elif [[ "$OSTYPE" == "msys" ]]; then
    export IS_WIN=true
    echo 'WINDOWS OS detected'
else
    echo 'Unknow OS -`$OSTYPE`'
fi

echo "Starting build on with language $LANG and VERBOSE=$VERBOSE"

cd mozilla-release
export CQZ_VERSION=$(awk -F "=" '/version/ {print $2}' ../repack/distribution/distribution.ini | head -n1)

export CQZ_UI_LOCALE=`echo $LANG`
export MOZ_OBJDIR=obj-firefox
export MOZCONFIG=`pwd`/browser/config/mozconfig
export MOZ_AUTOMATION_UPLOAD=1
export BALROG_PATH=`pwd`/../build-tools/scripts/updates
export S3_BUCKET=repository.cliqz.com
export S3_UPLOAD_PATH=`echo test/$CQZ_VERSION/${LANG:0:2}`
#export GIT_WIN_PATH="/c/Program Files (x86)/Git/cmd/git.exe"

./mach clobber

# Fixing git Windows-style line endings.
#if [ $IS_WIN ]; then
#    echo '***** Fixing git Windows-style line endings. *****'
#    "${GIT_WIN_PATH}" --version
#    "${GIT_WIN_PATH}" config core.autocrlf false
#    "${GIT_WIN_PATH}" config core.eof lf
#    "${GIT_WIN_PATH}" rm --cached -r .
#    "${GIT_WIN_PATH}" reset --hard
#fi

if [ $IS_WIN ]; then
    echo "ac_add_options --enable-jemalloc" >> browser/config/mozconfig
    #be sure that exists
    #export WIN32_REDIST_DIR="/c/Program Files (x86)/Microsoft Visual Studio 12.0/VC/redist/x86/Microsoft.VC120.CRT"
fi


#  for german builds
if [[ "$LANG" == 'de' ]]; then
    echo 'german'
    echo "ac_add_options --with-l10n-base=../../l10n" >> browser/config/mozconfig
    echo "ac_add_options --enable-ui-locale=de" >> browser/config/mozconfig
    export IS_DE=true
    echo '***** German builds detected *****'
fi

echo '***** Building *****'
./mach build

#inject the repackaging
echo '***** Inject the repackaging *****'
if [ $IS_MAC_OS ]; then
    cp -R ../repack/distribution ./obj-firefox/dist/CLIQZ.app/Contents/Resources/
    cp -R ../cliqz.cfg ./obj-firefox/dist/CLIQZ.app/Contents/Resources/
else
    cp -R ../repack/distribution ./obj-firefox/dist/bin/
    cp -R ../cliqz.cfg ./obj-firefox/dist/bin/
fi

# for German builds
if [ $IS_DE ]; then
    echo '***** Copying dictionaries for German builds *****'
    if [ $IS_MAC_OS ]; then
        mkdir -p obj-firefox/dist/CLIQZ.app/Contents/Resources/dictionaries; cp extensions/spellcheck/locales/en-US/hunspell/en-US.* obj-firefox/dist/CLIQZ.app/Contents/Resources/dictionaries
    else
        mkdir -p obj-firefox/dist/bin/dictionaries; cp extensions/spellcheck/locales/en-US/hunspell/en-US.* obj-firefox/dist/bin/dictionaries
    fi
fi

#packaging
echo '***** Packaging *****'
./mach package

if [ $IS_WIN ]; then
    echo '***** Windows packaging: *****'
    ./mach build installer
    cd obj-firefox
    mozmake update-packaging
else
    echo '***** Mac & Linux packaging *****'
    cd obj-firefox
    make update-packaging
fi

echo '***** Build & package finished successfully. *****'
