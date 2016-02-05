#! /bin/bash

# set -u
set -e
set -x

if [ -z "$LANG" ]; then
  LANG='en-US'
fi
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

export MOZ_OBJDIR=../obj
export MOZCONFIG=browser/config/cliqz-release.mozconfig
export CQZ_VERSION=$(awk -F "=" '/version/ {print $2}' ./repack/distribution/distribution.ini | head -n1)
export CQZ_UI_LOCALE=`echo $LANG`
export MOZ_AUTOMATION_UPLOAD=1
export CQZ_BALROG_DOMAIN=balrog-admin.10e99.net
export BALROG_PATH=../build-tools/scripts/updates
export S3_BUCKET=repository.cliqz.com
if [ $CQZ_RELEASE_CHANNEL ]; then
  export S3_UPLOAD_PATH=`echo dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/${LANG:0:2}`
else
  export S3_UPLOAD_PATH=`echo dist/release/$CQZ_VERSION/${LANG:0:2}`
fi

cd obj

echo '***** Uploading MAR and package files *****'
if [ $IS_WIN ]; then
    mozmake automation/build
else
    make automation/build
fi

echo '***** Genereting build_properties.json *****'
../mozilla-release/build/gen_build_properties.py


echo '***** Submiting to Balrog *****'
python ../build-tools/scripts/updates/balrog-submitter.py --credentials-file ../mozilla-release/build/creds.txt --username balrogadmin --api-root http://$CQZ_BALROG_DOMAIN/api --build-properties build_properties.json
