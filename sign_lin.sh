#!/bin/bash

set -e
set -x

source cliqz_env.sh

cd $SRC_BASE
cd $OBJ_DIR

echo '***** Generate DEBIAN repository *****'
gpg --allow-secret-key-import --import $DEBIAN_GPG_KEY
# get key name from the key, example:
#   :user ID packet: "Debian PR <debian-pr@cliqz.com>"
# gives:
#   debian-pr@cliqz.com
GPG_KEY_NAME=`gpg --list-packets $DEBIAN_GPG_KEY | grep "user ID packet" | head -1 | grep -Po "<\K([^>]+)"`
rm -rf debian ~/.aptly aptly
mkdir debian
cp dist/*.deb debian/
aptly repo create -component=main -distribution=stable cliqz-$CQZ_RELEASE_CHANNEL
aptly repo add cliqz-$CQZ_RELEASE_CHANNEL ./debian/
aptly publish repo \
  -architectures=i386,amd64 \
  -batch=true \
  -gpg-key=$GPG_KEY_NAME \
  -passphrase-file=../debian.gpg.pass \
  cliqz-$CQZ_RELEASE_CHANNEL
mv ~/.aptly/public aptly

OLD_LANG=$LANG
export LANG='en_US.UTF-8'
aws s3 sync --delete aptly/ $CQZ_S3_DEBIAN_REPOSITORY_URL
export LANG=$OLD_LANG
