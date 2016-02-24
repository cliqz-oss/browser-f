#! /bin/bash

# set -u
set -e
set -x

source cliqz_env.sh

cd $OBJ_DIR

echo "Starting build on with language $LANG and VERBOSE=$VERBOSE"

echo '***** Uploading MAR and package files *****'
$MAKE upload

echo '***** Genereting build_properties.json *****'
$OLDPWD/mozilla-release/build/gen_build_properties.py

cd $OLDPWD

echo '***** Submiting to Balrog *****'
python build-tools/scripts/updates/balrog-submitter.py \
  --credentials-file mozilla-release/build/creds.txt --username balrogadmin \
  --api-root http://$CQZ_BALROG_DOMAIN/api \
  --build-properties $OBJ_DIR/build_properties.json
