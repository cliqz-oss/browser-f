#! /bin/bash

# Required ENVs:
# * WIN32_REDIST_DIR

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

echo "Starting build on with language $LANG and VERBOSE=$VERBOSE"

cd mozilla-release

export CQZ_VERSION=$(awk -F "=" '/version/ {print $2}' ../repack/distribution/distribution.ini | head -n1)
export CQZ_UI_LOCALE=`echo $LANG`
export MOZ_OBJDIR=obj-firefox
export MOZCONFIG=`pwd`/browser/config/mozconfig
export MOZ_AUTOMATION_UPLOAD=1

./mach clobber

# Clean old compiled python files
# Can be removed after merge with Firefox 43
# Fixed by https://bugzilla.mozilla.org/show_bug.cgi?id=1184696
find . -name \*.pyc -delete

if [ $CQZ_GOOGLE_API_KEY ]; then
  echo $CQZ_GOOGLE_API_KEY > ../google-api-key
  echo "ac_add_options --with-google-api-keyfile=\"$PWD/../google-api-key\"" >> $MOZCONFIG
fi

if [ $IS_WIN ]; then
    echo "ac_add_options --enable-jemalloc" >> $MOZCONFIG
fi

if [ -z $CQZ_RELEASE_CHANNEL ]; then
  export CQZ_RELEASE_CHANNEL=release
fi

echo "ac_add_options --enable-update-channel=$CQZ_RELEASE_CHANNEL" >> $MOZCONFIG

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
if [[ "$CQZ_RELEASE_CHANNEL" == 'release' ]]; then
  wget --output-document cliqz@cliqz.com.xpi http://cdn2.cliqz.com/update/browser/Cliqz.1.0.54.xpi
else
  wget --output-document cliqz@cliqz.com.xpi http://cdn2.cliqz.com/update/beta/Cliqz.1.2.0.1b0.xpi
fi

echo '***** Inject the repackaging *****'
if [ $IS_MAC_OS ]; then
    cp -R ../repack/distribution ./obj-firefox/dist/CLIQZ.app/Contents/Resources/
    cp -R ../cliqz.cfg ./obj-firefox/dist/CLIQZ.app/Contents/Resources/
    cp -R cliqz@cliqz.com.xpi ./obj-firefox/dist/CLIQZ.app/Contents/Resources/distribution/extensions/
else
    cp -R ../repack/distribution ./obj-firefox/dist/bin/
    cp -R ../cliqz.cfg ./obj-firefox/dist/bin/
    cp -R cliqz@cliqz.com.xpi ./obj-firefox/dist/bin/distribution/extensions/
fi

rm cliqz@cliqz.com.xpi

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
    cd ..
else
    echo '***** Mac & Linux packaging *****'
    cd obj-firefox
    make update-packaging
    cd ..
fi

if [ $CQZ_CERT_DB_PATH ]; then
    echo '***** Signing mar *****'
    cd obj-firefox/dist/update
    MAR_FILE=`ls *.mar | head -n 1`
    cd ../bin
    ./signmar -d $CQZ_CERT_DB_PATH -n "Cliqz GmbH's DigiCert Inc ID" -s ../update/$MAR_FILE ../update/out.mar
    mv ../update/out.mar ../update/$MAR_FILE
    cd ../../..
fi

echo '***** Build & package finished successfully. *****'
