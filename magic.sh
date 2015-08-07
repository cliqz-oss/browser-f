#! /bin/bash
LANG='default'
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

git fetch cliqz
git checkout cliqz/mozilla-release
git branch -D build
git checkout -b build
git merge cliqz/branding --no-edit
git merge cliqz/repack --no-edit
git merge cliqz/build-automation --no-edit


cd mozilla-release

export MOZ_OBJDIR=obj-firefox
export MOZCONFIG=`pwd`/browser/config/mozconfig
export MOZ_AUTOMATION_UPLOAD=1
export BALROG_PATH=/c/mozilla-source/build-tools/scripts/updates
export BALROG_PATH=/src/luciancor/CLIQZfox/build-tools/scripts/updates
export S3_BUCKET=repository.cliqz.com
export S3_UPLOAD_PATH=pub/

if [ $IS_WIN ]; then
    echo "ac_add_options --enable-jemalloc" >> browser/config/mozconfig
    #be sure that exists
    export WIN32_REDIST_DIR="/c/Program Files (x86)/Microsoft Visual Studio 12.0/VC/redist/x86/Microsoft.VC120.CRT"
fi


#  for german builds
if [[ "$LANG" == 'de' ]]; then
    echo 'german'
    echo "ac_add_options --with-l10n-base=../../l10n" >> browser/config/mozconfig
    echo "ac_add_options --enable-ui-locale=de" >> browser/config/mozconfig
fi
./mach build
exit
#inject the repackaging
if [ $IS_MAC_OS ]; then
    cp -R ../repack/distribution ./obj-firefox/dist/CLIQZ.app/Contents/Resources/
else
    cp -R ../repack/distribution ./obj-firefox/dist/bin/
fi

# sign for MAC!!!

if [ $IS_MAC_OS ]; then
cd obj-firefox/dist/
mkdir CLIQZ.app/Contents/_CodeSignature
touch ./CLIQZ.app/Contents/_CodeSignature/CodeResources

codesign -s "George Corlaciu" -fv \
         --keychain /Users/georgeluciancorlaciu/Library/Keychains/login.keychain \
         --resource-rules ./CLIQZ.app/Contents/_CodeSignature/CodeResources \
         --requirements '=designated => identifier "org.mozilla.cliqz" and ( (anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.9] ) or (anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] and certificate leaf[field.1.2.840.113635.100.6.1.13] and certificate leaf[subject.OU] = "2UYYSSHVUH"))' \
         CLIQZ.app
cd ../..
fi


# for german builds
if [ $IS_MAC_OS ]; then
    mkdir obj-firefox/dist/CLIQZ.app/Contents/Resources/dictionaries; cp extensions/spellcheck/locales/en-US/hunspell/en-US.* obj-firefox/dist/CLIQZ.app/Contents/Resources/dictionaries
else
    mkdir obj-firefox/dist/bin/dictionaries; cp extensions/spellcheck/locales/en-US/hunspell/en-US.* obj-firefox/dist/bin/dictionaries
fi

#packaging
./mach package


# make sure you have working S3 credentials
if [ $IS_WIN ]; then
    echo 'Windows packaging: '
    ./mach build installer
    cd obj-firefox
    mozmake update-packaging
else
    echo 'Mac Linux packaging'
    cd obj-firefox
    make update-packaging
fi

#signing.
if [ $IS_WIN ]; then
    set CERTIFICATE_PATH=CodeSigning.p12
    set CERTIFICATE_PASSWORD=
    7z x -o./pkg dist/CLIQZ-39.0.en-US.win32.installer.exe
    #run this in Windwos SDK terminal
    exit
    signtool sign /f $CERTIFICATE_PATH /p $CERTIFICATE_PASSWORD pkg/setup.exe
    cd pkg; 7z a -r -t7z installer.7z -mx -m0=BCJ2 -m1=LZMA:d25 -m2=LZMA:d19 -m3=LZMA:d1 -mb0:1 -mb0s1:2 -mb0s2:3; cd ..
    cat browser/installer/windows/instgen/7zSD.sfx browser/installer/windows/instgen/app.tag pkg/installer.7z > dist/install/sea/CLIQZ-39.0.en-US.win32.installer.exe
fi



if [ $IS_WIN ]; then
    mozmake automation/build
else
    make automation/build
fi

../build/gen_build_properties.py
python $BALROG_PATH/balrog-submitter.py --credentials-file ../build/creds.txt --username balrogadmin --api-root http://balrog-admin.cliqz.com/api --build-properties build_properties.json
