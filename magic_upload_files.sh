#! /bin/bash

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

if [ $IS_WIN ]; then
    echo 'kk'
fi

echo "Starting build on with language $LANG and VERBOSE=$VERBOSE"

cd mozilla-release

export MOZ_OBJDIR=obj-firefox
export MOZCONFIG=`pwd`/browser/config/mozconfig
export MOZ_AUTOMATION_UPLOAD=1
export BALROG_PATH=/c/jenkins/workspace/cliqzfox-build/cliqzfox-build/build-tools/scripts/updates
export S3_BUCKET=repository.cliqz.com
export S3_UPLOAD_PATH=test/
export GIT_WIN_PATH="/c/Program Files (x86)/Git/cmd/git.exe"


cd obj-firefox

echo '***** Uploading MAR and package files *****'
if [ $IS_WIN ]; then
    mozmake automation/build
else
    make automation/build
fi
