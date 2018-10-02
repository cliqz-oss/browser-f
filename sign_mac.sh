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
  cp -r /Volumes/cliqz/*.app $PKG_DIR
  xattr -rc $PKG_DIR/
  hdiutil detach /Volumes/cliqz
  for app in $PKG_DIR/*.app
  do
    codesign -s $MAC_CERT_NAME --force --deep $app

    # copy back to dist folder a signed app (for generating an update package(s) later)
    if [[ $DMG == *"de.mac.dmg"* ]]; then
      cp -r $app obj/dist/l10n-stage/cliqz
    fi
    if [[ $DMG == *"en-US.mac.dmg"* ]]; then
      cp -r $app obj/dist/cliqz
    fi
  done

  SIGNED_DMG="${DMG%.dmg}-signed.dmg"
  if [ -f $SIGNED_DMG ]; then
      echo "File ${SIGNED_DMG} exists. Removing to continue"
      rm $SIGNED_DMG
  fi

  appdmg -v cliqz-dmg.json $SIGNED_DMG
  cp $SIGNED_DMG $DMG
done
