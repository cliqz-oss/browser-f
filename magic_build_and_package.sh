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

source cliqz_env.sh

cd $SRC_BASE

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
# Don't forget to update magic_upload_files.sh along with this one.
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
  # Restore still useful variable we unset before.
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
  # TODO: Specify certificate name by env var.
  if [ -z "$MAR_CERT_NAME" ]; then
    MAR_CERT_NAME="Cliqz GmbH's DigiCert Inc ID"
  fi
  echo '***** Signing mar *****'
  MAR_FILE=`ls $I386DIR/dist/update/*.mar | head -n 1`
  # signmar is somehow dependent on its execution path. It refuses to work when
  # launched using relative paths, and gives unrelated error:
  # "Could not initialize NSS". BEWARE!
  SIMGNMAR_ABS_DIR=$(cd $X86_64DIR/dist/bin/; pwd)
  $SIMGNMAR_ABS_DIR/signmar -d $CQZ_CERT_DB_PATH -n "$MAR_CERT_NAME" \
    -s $MAR_FILE $MAR_FILE.signed
  mv $MAR_FILE.signed $MAR_FILE
fi

echo '***** Build & package finished successfully. *****'
cd $OLDPWD
