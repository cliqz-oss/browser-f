#!/bin/bash

cd mozilla-release

export MOZ_VERSION=$(awk -F "=" '/version/ {print $2}' browser/config/version.txt | head -n1)

cd obj-firefox

DMG_FILE_NAME=CLIQZ-$MOZ_VERSION.$LANG.mac64.dmg

mkdir pkg
hdiutil attach dist/$DMG_FILE_NAME
cp -r /Volumes/CLIQZ/CLIQZ.app pkg
codesign -s "CLIQZ Gmbh" --deep ./pkg/CLIQZ.app
hdiutil detach /Volumes/CLIQZ
rm dist/$DMG_FILE_NAME
appdmg ../../CLIQZ-dmg.json dist/$DMG_FILE_NAME
