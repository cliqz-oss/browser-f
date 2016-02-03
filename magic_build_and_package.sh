#! /bin/bash

# Copyright (c) 2016 Cliqz GmbH. All rights reserved.
# Authors: Lucian Corlaciu <lucian@cliqz.com>
#          Max Breev <maxim@cliqz.com>

# Required ENVs:
# WIN32_REDIST_DIR
# CQZ_GOOGLE_API_KEY or MOZ_GOOGLE_API_KEY
# CQZ_RELEASE_CHANNEL or MOZ_UPDATE_CHANNEL
# CQZ_CERT_DB_PATH
# MOZ_UI_LOCALE

set -e
set -x

VERBOSE=false
CLOBBER=false

while [[ $# > 0 ]]
do
  key="$1"

  case $key in
    -lang|--language)
    LANG="$2"
    shift # Consume additional argument
    ;;

    -v|--verbose)
    VERBOSE=true
    ;;

    --clobber)
    CLOBBER=true
    ;;

    *)
    echo "WARNING: Unknown option $key"
    ;;
  esac
  shift # Consume current argument
done

if [[ "$OSTYPE" == "linux-gnu" ]]; then
  IS_LINUX=true
  echo 'Linux OS detected'
elif [[ "$OSTYPE" == "darwin"* ]]; then
  IS_MAC_OS=true
  echo 'Mac OS detected'
elif [[ "$OSTYPE" == "cygwin" || "$OSTYPE" == "msys" ]]; then
  IS_WIN=true
  echo 'Windows OS detected'
else
  echo 'Unknow OS -`$OSTYPE`'
fi

cd mozilla-release

export MOZCONFIG=browser/config/cliqz-release.mozconfig
export MOZ_OBJDIR=../obj
I386DIR=$MOZ_OBJDIR/i386
X86_64DIR=$MOZ_OBJDIR/X86_64

if $CLOBBER; then
  ./mach clobber
fi

# TODO: Use MOZ_GOOGLE_API_KEY directly instead of CQZ_GOOGLE_API_KEY.
if [ $CQZ_GOOGLE_API_KEY ]; then
  export MOZ_GOOGLE_API_KEY=$CQZ_GOOGLE_API_KEY  # --with-google-api-keyfile=...
fi

if [ $IS_WIN ]; then
  export MOZ_MEMORY=1  # --enable-jemalloc
fi

# TODO: Use MOZ_UPDATE_CHANNEL directly instead of CQZ_RELEASE_CHANNEL.
# --enable-update-channel=...
if [ -z $CQZ_RELEASE_CHANNEL ]; then
  export MOZ_UPDATE_CHANNEL=release
else
  export MOZ_UPDATE_CHANNEL=$CQZ_RELEASE_CHANNEL
fi

if [ -z "$LANG" ]; then
  LANG='en-US'
fi

#  for german builds
# TODO: Use MOZ_UI_LOCALE directly.
if [[ "$LANG" == 'de' ]]; then
echo '***** German builds detected *****'
  IS_DE=true
  if [[ $IS_MAC_OS ]]; then
    export L10NBASEDIR=../../l10n  # --with-l10n-base=...
  else
    export L10NBASEDIR=../l10n  # --with-l10n-base=...
  fi
  export MOZ_UI_LOCALE=de  # --enable-ui-locale=...
fi

echo '***** Building *****'
./mach build

echo '***** Packaging *****'
if [[ $IS_MAC_OS ]]; then
  MOZ_OBJDIR_BACKUP=$MOZ_OBJDIR
  unset MOZ_OBJDIR  # Otherwise some python script throws. Good job, Mozilla!
  make -C $I386DIR package
  export MOZ_OBJDIR=$MOZ_OBJDIR_BACKUP
else
  ./mach package
fi

if [ $IS_WIN ]; then
  echo '***** Windows packaging: *****'
  ./mach build installer
  cd $MOZ_OBJDIR
  mozmake update-packaging
  cd $OLDPWD
elif [ $IS_MAC_OS ]; then
  echo '***** Mac packaging *****'
  make -C $I386DIR update-packaging
else
  echo '***** Linux packaging *****'
  make -C $MOZ_OBJDIR update-packaging
fi

if [ $CQZ_CERT_DB_PATH ]; then
  echo '***** Signing mar *****'
  cd $I386DIR/dist/update
  MAR_FILE=`ls *.mar | head -n 1`
  $X86_64DIR/dist/bin/signmar -d $CQZ_CERT_DB_PATH -n "Cliqz GmbH's DigiCert Inc ID" -s $MAR_FILE out.mar
  mv out.mar $MAR_FILE
  cd $OLDPWD
fi

echo '***** Build & package finished successfully. *****'
