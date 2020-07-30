#! /bin/bash

# Optional ENVs:
#  CQZ_BUILD_ID - specify special build timestamp or use latest one (depend on channel)
#  CQZ_RELEASE_CHANNEL - specify special build channel (beta by default)
#  CQZ_BUILD_DE_LOCALIZATION - for build DE localization
#  CQZ_INJECT_LOGGING - whether we have to inject logging or not;

set -e
set -x

source cliqz_env.sh
cd $SRC_BASE

if $CLOBBER; then
  if [ "$IS_WIN" == "true" ]; then
    rm -rf $MOZ_OBJDIR
  else
    ./mach clobber
  fi
fi

if $BUILD_DE; then
  CQZ_BUILD_DE_LOCALIZATION=1
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

# https://hg.mozilla.org/mozreview/gecko/rev/011224b42a6659b8374bd64cbab411f4ef6bed92#index_header
# We need to export MOZ_CHROME_MULTILOCALE because that will be used for
# generating multilocale.txt file (./toolkit/mozapps/installer/packager.mk);
# Then ./intl/locale/LocaleService.cpp service takes advantage of that (reads multilocale.txt)
# to define languages put into Services.locale.packagedLocales.
#export MOZ_CHROME_MULTILOCALE=`ls -1 ../l10n/ | tr "\n" " " | sed 's/ $//g'`
#for AB_CD in $MOZ_CHROME_MULTILOCALE; do
#  ./mach build chrome-$AB_CD
#done

if [ "$IS_WIN" == "true" ]; then
  NODE=$MOZ_FETCHES_DIR/node/node.exe
elif [ -f "$MOZ_FETCHES_DIR/node/bin/node" ]; then
  NODE=$MOZ_FETCHES_DIR/node/bin/node
elif [ -f "$TOOLCHAIN/node/bin/node" ]; then
  NODE=$TOOLCHAIN/node/bin/node
else
  NODE=node
fi

if [ "$CQZ_INJECT_LOGGING" == "true" ]; then
  echo '***** Injecting Logs Before Build *****'
  cd $OLDPWD
  $NODE -v
  $NODE cliqz-logger.js --config cliqz-logger-config.json
  cd $SRC_BASE
fi

echo '***** Building *****'
./mach build

if $CQZ_BUILD_TESTS; then
  echo '***** Building tests *****'
  ./mach build package-tests
fi

echo '***** Packaging *****'
./mach package

if $CQZ_BUILD_SYMBOLS; then
  echo '***** Prepare build symbols *****'
  # Because of Rust problem with dsymutil on Mac (stylo) - only for Windows or mac cross builds
  if [[ $IS_WIN==true || $OSX_CROSS_BUILD==true ]]; then
    if [ "$MOZ_UPDATE_CHANNEL" == "release" ] || [ "$MOZ_UPDATE_CHANNEL" == "beta" ]; then
      ./mach buildsymbols
    fi
  fi
fi

echo '***** Build DE language pack *****'
if [ "$CQZ_BUILD_DE_LOCALIZATION" == "1" ]; then
  ./mach build installers-de
fi

if [ "$CQZ_INJECT_LOGGING" == "true" ]; then
  echo '***** Clear Injecting Logs After Build *****'
  cd $OLDPWD
  $NODE cliqz-logger.js --clear --config cliqz-logger-config.json
  cd $SRC_BASE
fi

echo '***** Build & package finished successfully. *****'
cd $OLDPWD
