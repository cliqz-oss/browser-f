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

if [ $IS_WIN ]; then
  echo '***** Windows build installer *****'
  ./mach build installer
fi

echo '***** Packaging *****'

if [[ $IS_MAC_OS ]]; then
  MOZ_OBJDIR_BACKUP=$MOZ_OBJDIR
  unset MOZ_OBJDIR  # Otherwise some python script throws. Good job, Mozilla!
  make -C $OBJ_DIR package
  # Restore still useful variable we unset before.
  export MOZ_OBJDIR=$MOZ_OBJDIR_BACKUP
else
  ./mach package
fi

echo '***** Build & package finished successfully. *****'
cd $OLDPWD
