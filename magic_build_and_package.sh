#! /bin/bash

# Optional ENVs:
#  CQZ_BUILD_ID - specify special build timestamp or use latest one (depend on channel)
#  CQZ_RELEASE_CHANNEL - specify special build channel (beta by default)
#  CQZ_BUILD_DE_LOCALIZATION - for build DE localization

set -e
set -x

# check if dependencies are installed.
for prog in "wget" "rustc" "zip" "unzip" "yasm"; do
    if [ -z $(which $prog) ]; then
       echo "couldnot find build dependency: $prog"
       exit 1
    fi
done

source cliqz_env.sh

cd $SRC_BASE

if $CLOBBER; then
  ./mach clobber
fi

if [ -z "$LANG" ]; then
  LANG='en-US'
fi

# for localization repack
export L10NBASEDIR=../l10n  # --with-l10n-base=...

# check for API key files
if [ ! -f ../mozilla-desktop-geoloc-api.key ]; then
  echo "mozilla-api-key-required" > ../mozilla-desktop-geoloc-api.key
fi
if [ ! -f ../google-desktop-api.key ]; then
  echo "google-api-key-required" > ../google-desktop-api.key
fi

echo '***** Building *****'
./mach build

if [ $IS_WIN ]; then
  echo '***** Windows build installer *****'
  ./mach build installer
fi

echo '***** Packaging *****'
./mach package

echo '***** Prepare build symbols *****'
# Because of Rust problem with dsymutil on Mac (stylo) - only for Windows platform
if [ $IS_WIN ]; then
  if [ "$MOZ_UPDATE_CHANNEL" == "release" ] || [ "$MOZ_UPDATE_CHANNEL" == "beta" ]; then
    ./mach buildsymbols
  fi
fi

echo '***** Build DE language pack *****'
if [ "$CQZ_BUILD_DE_LOCALIZATION" == "1" ]; then
  cd $OLDPWD
  cd $SRC_BASE/$MOZ_OBJDIR/browser/locales
  $MAKE merge-de LOCALE_MERGEDIR=$(pwd)/mergedir
  $MAKE installers-de LOCALE_MERGEDIR=$(pwd)/mergedir
fi

echo '***** Build & package finished successfully. *****'
cd $OLDPWD
