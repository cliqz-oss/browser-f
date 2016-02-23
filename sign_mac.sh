#!/bin/bash

set -e
set -x

echo "***** MAC SIGNING *****"

OBJ_DIR=obj
PKG_DIR=$OBJ_DIR/pkg

mkdir $PKG_DIR
for DMG in $OBJ_DIR/i386/dist/*.dmg
do
  echo "Processing $DMG..."
  hdiutil attach -nobrowse $DMG
  cp -r /Volumes/CLIQZ/*.app $PKG_DIR
  for app in $PKG_DIR/*.app
  do
    codesign -s $CQZ_CERT_NAME --force --deep $app
  done
  hdiutil detach /Volumes/CLIQZ
  SIGNED_DMG="${DMG%.dmg}-signed.dmg"
  appdmg CLIQZ-dmg.json $SIGNED_DMG
  cp $SIGNED_DMG $DMG
done

cd $OLDPWD
