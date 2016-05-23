#!/bin/bash

set -e
set -x

source cliqz_env.sh

cd $SRC_BASE
cd $OBJ_DIR

echo '***** Generate DEBIAN repository *****'
gpg --allow-secret-key-import --import ../certs/debian-$CQZ_RELEASE_CHANNEL@cliqz.com.gpg.key
rm -rf debian ~/.aptly aptly
mkdir debian
cp dist/*.deb debian/
aptly repo create -component=main -distribution=stable cliqz-$CQZ_RELEASE_CHANNEL
aptly repo add cliqz-$CQZ_RELEASE_CHANNEL ./debian/
aptly publish repo \
  -architectures=i386,amd64 \
  -batch=true \
  -gpg-key=debian-$CQZ_RELEASE_CHANNEL@cliqz.com \
  -passphrase-file=../certs/debian-$CQZ_RELEASE_CHANNEL@cliqz.com.pass \
  cliqz-$CQZ_RELEASE_CHANNEL
source ../certs/s3cmd_repository_cliqz_com.sh
mv ~/.aptly/public aptly
aws s3 sync --delete aptly/ s3://repository.cliqz.com/dist/debian-$CQZ_RELEASE_CHANNEL/
