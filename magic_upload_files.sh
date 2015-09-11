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

export CQZ_VERSION=$(awk -F "=" '/version/ {print $2}' ../repack/distribution/distribution.ini | head -n1)
export CQZ_UI_LOCALE=`echo $LANG`
export MOZ_AUTOMATION_UPLOAD=1
export BALROG_PATH=/c/jenkins/workspace/cliqzfox-build/cliqzfox-build/build-tools/scripts/updates
export S3_BUCKET=repository.cliqz.com
if [ $CQZ_RELEASE_CHANNEL ]; then
  export S3_UPLOAD_PATH=`echo $CQZ_RELEASE_CHANNEL/$CQZ_VERSION/${LANG:0:2}`
else
  export S3_UPLOAD_PATH=`echo pub/$CQZ_VERSION/${LANG:0:2}`
fi

cd obj-firefox

echo '***** Uploading MAR and package files *****'
if [ $IS_WIN ]; then
    mozmake automation/build
else
    make automation/build
fi

echo '***** Genereting build_properties.json *****'
../build/gen_build_properties.py


echo '***** Submiting to Balrog *****'
python ../../build-tools/scripts/updates/balrog-submitter.py --credentials-file ../build/creds.txt --username balrogadmin --api-root http://balrog-admin.cliqz.com/api --build-properties build_properties.json
