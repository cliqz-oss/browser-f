#!/bin/bash

echo "***** MAC SIGNING *****"

cd obj
mkdir pkg

FILES=/path/to/*
for dmg in i386/dist/*.dmg
do
  echo "Processing $dmg..."
  hdiutil attach $dmg
  cp -r /Volumes/CLIQZ/*.app pkg
  for app in pkg/*.app
  do
    codesign -s $CQZ_CERT_NAME --deep $app
  done
  hdiutil detach /Volumes/CLIQZ
  rm $dmg
  appdmg ../../CLIQZ-dmg.json $dmg
done

cd $OLDPWD
