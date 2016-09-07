#!/bin/bash

set -e
set -x

source cliqz_env.sh

cd $SRC_BASE
cd $OBJ_DIR

echo '***** Generate DEBIAN repository *****'
gpg --allow-secret-key-import --import $DEBIAN_GPG_KEY
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

OLD_LANG=$LANG
export LANG='en_US.UTF-8'
aws s3 sync --delete aptly/ $CQZ_S3_DEBIAN_REPOSITORY_URL
export LANG=$OLD_LANG
s3://repository.cliqz.com/dist/debian-$CQZ_RELEASE_CHANNEL/