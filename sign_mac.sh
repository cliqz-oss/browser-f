#!/bin/bash

set -e
set -x

echo "***** MAC SIGNING *****"

PKG_DIR=obj/pkg

mkdir $PKG_DIR
for DMG in obj/i386/dist/*.dmg
do
  echo "Processing $DMG..."
  hdiutil attach -nobrowse $DMG
  cp -r /Volumes/CLIQZ/*.app $PKG_DIR
  xattr -rc $PKG_DIR

  for app in $PKG_DIR/*.app
  do
    codesign -s $CQZ_CERT_NAME --force --deep $app
  done
  hdiutil detach /Volumes/CLIQZ
  SIGNED_DMG="${DMG%.dmg}-signed.dmg"
  appdmg CLIQZ-dmg.json $SIGNED_DMG
  cp $SIGNED_DMG $DMG
done
