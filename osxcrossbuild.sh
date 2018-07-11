#/usr/bin/env bash
# FIXME: integrate with other build scripts
# simple script to cross build on osx

set -e -o pipefail

if [ -z $(which wget) ]; then
    echo "Install wget!"
fi

export MAKE=make
export MOZ_UPDATE_CHANNEL=beta
export SHELL=$SHELL

export CQZ_VERSION=$(cat ./mozilla-release/browser/config/version_display.txt)
export CQZ_BALROG_DOMAIN=balrog-admin.10e99.net
export BALROG_PATH=../build-tools/scripts/updates
export S3_BUCKET=repository.cliqz.com
export S3_BUCKET_SERVICE=cliqz-browser-data

# mozconfig, hardcoded
export MOZCONFIG=browser/config/cliqz-release-cross.mozconfig

# by default use beta update channel, except Release
if [ -z $CQZ_RELEASE_CHANNEL ]; then
    export CQZ_RELEASE_CHANNEL=beta
fi

# check CQZ_BUILD_ID and try to obtain, if not specified
if [ -z $CQZ_BUILD_ID ]; then
    export CQZ_BUILD_ID="$(wget -qO- https://$S3_BUCKET/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/lastbuildid)"
fi

if [ -z $CQZ_BUILD_ID ]; then
    echo "CQZ_BUILD_ID not specified and can not be obtain from "$S3_BUCKET
    exit 1
fi

# set our own BUILD_ID in new build system, must be specified in format %Y%m%d%H%M%S
export MOZ_BUILD_DATE=$CQZ_BUILD_ID

# set path on S3 with BUILD_ID. From this path we take *.xpi and upload
# build artifacts back (to locale folder, same as FF)
export S3_UPLOAD_PATH=$(echo dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$MOZ_BUILD_DATE)

# Generate buildsymbols for release and beta builds
if [ "$CQZ_RELEASE_CHANNEL" == "release" ] || [ "$CQZ_RELEASE_CHANNEL" == "beta" ] ; then
    export S3_UPLOAD_PATH_SERVICE=$(echo cliqzfox/buildsymbols/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$MOZ_BUILD_DATE)
fi

OBJ_DIR=$MOZ_OBJDIR
SRC_BASE=mozilla-release

# automatic forget tab - start
wget -O adult-domains.bin https://s3.amazonaws.com/cdn.cliqz.com/browser-f/APT/adult-domains.bin
export CQZ_AUTO_PRIVATE_TAB=1
export CQZ_ADULT_DOMAINS_BF=../adult-domains.bin
# automatic forget tab - end

export ROOT_PATH=$PWD

# Check if envs for cross build is set properly
# ${!NAME} will do $NAME and then lookup the variable at the value
# for e.g NAME=FIRST and FIRST=VALUE
# ${!NAME} will return VALUE
for e in "CC" "CXX" "CPP" "TOOLCHAIN_PREFIX" "LLVMCONFIG" "DSYMUTIL" "REAL_DSYMUTIL" "DMG_TOOL" "HFS_TOOL" "HOST_CC" "HOST_CPP" "HOST_CXX" "HOST_CPP" "CROSS_PRIVATE_FRAMEWORKS"; do
    if [ -z "${!e}" ]; then
        echo $e not set
        exit -1
    fi
done

# actual build process
cd $SRC_BASE

# set language
if [ -z "$LANG" ]; then
    LANG="en-US"
fi

# for localization repack
export L10NBASEDIR=$ROOT_PATH/l10n  # --with-l10n-base=...

# check for API key files
if [ ! -f $ROOT_PATH/mozilla-desktop-geoloc-api.key ]; then
    echo "mozilla-api-key-required" > $ROOT_PATH/mozilla-desktop-geoloc-api.key
fi
if [ ! -f $ROOT_PATH/google-desktop-api.key ]; then
    echo "google-api-key-required" > $ROOT_PATH/google-desktop-api.key
fi

echo '***** Building *****'
./mach build

echo '***** Packaging *****'
./mach package

echo '***** Prepare build symbols *****'
# try this anyway
if [ "$MOZ_UPDATE_CHANNEL" == "release" ] || [ "$MOZ_UPDATE_CHANNEL" == "beta" ]; then
        ./mach buildsymbols
fi

echo '***** Build DE language pack *****'
if [ "$CQZ_BUILD_DE_LOCALIZATION" == "1" ]; then
    ./mach build installers-de
fi

echo '***** Build & package finished successfully. *****'
cd $OLDPWD
