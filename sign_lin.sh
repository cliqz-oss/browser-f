#!/bin/bash

set -e
set -x

source cliqz_env.sh

cd $SRC_BASE
cd $OBJ_DIR

echo '***** Generate DEBIAN repository *****'
gpg --allow-secret-key-import --import ../debian.gpg.key
rm -rf debian ~/.aptly aptly
mkdir debian
cp dist/*.deb debian/
aptly repo create -component=main -distribution=stable cliqz-$CQZ_RELEASE_CHANNEL
aptly repo add cliqz-$CQZ_RELEASE_CHANNEL ./debian/
aptly publish repo \
  -architectures=i386,amd64 \
  -batch=true \
  -gpg-key=debian-$CQZ_RELEASE_CHANNEL@cliqz.com \
  -passphrase-file=../debian.gpg.pass \
  cliqz-$CQZ_RELEASE_CHANNEL
mv ~/.aptly/public aptly
aws s3 sync --delete aptly/ s3://repository.cliqz.com/dist/debian-$CQZ_RELEASE_CHANNEL/
