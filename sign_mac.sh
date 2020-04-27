#!/bin/bash

set -e
set -x

echo "***** MAC SIGNING AND NOTARY *****"

PKG_DIR=obj/pkg
SIGN_ARGS=(-s "$MAC_CERT_NAME" -fv --requirement "=designated => ( (anchor apple generic and certificate leaf[field.1.2.840.113635.100.6.1.9] ) or (anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] and certificate leaf[field.1.2.840.113635.100.6.1.13] and certificate leaf[subject.OU] = \"${MAC_CERT_NAME}\"))" -o "runtime" --entitlements "mozilla-release/security/mac/hardenedruntime/production.entitlements.xml")

for DMG in obj/dist/*.dmg
do
  echo "Processing $DMG..."
  rm -f -rf $PKG_DIR
  mkdir $PKG_DIR
  mozilla-release/build/package/mac_osx/unpack-diskimage $DMG /Volumes/Cliqz $PKG_DIR
  xattr -cr $PKG_DIR/Cliqz.app
  xattr -cr $PKG_DIR/Cliqz.app/Contents/MacOS/plugin-container.app
  xattr -cr $PKG_DIR/Cliqz.app/Contents/MacOS/crashreporter.app
  xattr -cr $PKG_DIR/Cliqz.app/Contents/MacOS/updater.app

  security unlock-keychain -p cliqz cliqz

  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/plugin-container.app
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/pingsender
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/libfreebl3.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/libgraphitewasm.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/cliqz-bin
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/liblgpllibs.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/libplugin_child_interpose.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/libsoftokn3.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/XUL
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/libosclientcerts.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/libmozavutil.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/libmozglue.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/libmozavcodec.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/libnssckbi.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/libnss3.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/minidump-analyzer
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/crashreporter.app
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/crashreporter.app/Contents/MacOS/crashreporter
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/updater.app
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/MacOS/updater.app/Contents/MacOS/org.mozilla.updater
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/Library/LaunchServices/org.mozilla.updater
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app/Contents/Resources/gmp-clearkey/0.1/libclearkey.dylib
  codesign "${SIGN_ARGS[@]}" $PKG_DIR/Cliqz.app
  codesign -vvv --deep --strict $PKG_DIR/Cliqz.app

  /bin/bash notarize_mac_app.sh $MAC_NOTARY_USER $MAC_NOTARY_PASS

  # copy back to dist folder a signed app (for generating an update package(s) later), it will be transferred as stashed artifacts
  if [[ $DMG == *"de.mac.dmg"* ]]; then
    cp -r $PKG_DIR/Cliqz.app obj/dist/l10n-stage/cliqz
  fi
  if [[ $DMG == *"en-US.mac.dmg"* ]]; then
    cp -r $PKG_DIR/Cliqz.app obj/dist/cliqz
  fi

  SIGNED_DMG="${DMG%.dmg}-signed.dmg"
  if [ -f $SIGNED_DMG ]; then
      echo "File ${SIGNED_DMG} exists. Removing to continue"
      rm $SIGNED_DMG
  fi

  appdmg -v cliqz-dmg.json $SIGNED_DMG
  cp $SIGNED_DMG $DMG
done
