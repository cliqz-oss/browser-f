#!/bin/bash

set -e
set -x

echo "***** MAC SIGNING *****"

PKG_DIR=obj/pkg

for DMG in obj/dist/*.dmg
do
  echo "Processing $DMG..."
  rm -f -rf $PKG_DIR
  mkdir $PKG_DIR
  hdiutil attach -nobrowse $DMG
  cp -r /Volumes/ghostery/*.app $PKG_DIR
  xattr -rc $PKG_DIR/
  hdiutil detach /Volumes/ghostery
  for app in $PKG_DIR/*.app
  do
    codesign -s $CQZ_CERT_NAME --force --deep $app

    # copy back to dist folder a signed app (for generating an update package(s) later)
    if [[ $DMG == *"de.mac.dmg"* ]]; then
      cp -r $app obj/dist/l10n-stage/ghostery
    fi
    if [[ $DMG == *"en-US.mac.dmg"* ]]; then
      cp -r $app obj/dist/ghostery
    fi
  done

  SIGNED_DMG="${DMG%.dmg}-signed.dmg"
  if [ -f $SIGNED_DMG ]; then
      echo "File ${SIGNED_DMG} exists. Removing to continue"
      rm $SIGNED_DMG
  fi

  appdmg -v ghostery-dmg.json $SIGNED_DMG
  cp $SIGNED_DMG $DMG
done
