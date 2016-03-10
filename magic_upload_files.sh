#! /bin/bash

# set -u
set -e
set -x

source cliqz_env.sh

cd $SRC_BASE
cd $OBJ_DIR

echo '***** Packaging MAR *****'
$MAKE update-packaging

if [ $CQZ_CERT_DB_PATH ]; then
  # TODO: Specify certificate name by env var.
  if [ -z "$MAR_CERT_NAME" ]; then
    MAR_CERT_NAME="Cliqz GmbH's DigiCert Inc ID"
  fi
  echo '***** Signing mar *****'
  MAR_FILE=`ls dist/update/*.mar | head -n 1`
  # signmar is somehow dependent on its execution path. It refuses to work when
  # launched using relative paths, and gives unrelated error:
  # "Could not initialize NSS". BEWARE!
  SIGNMAR_ABS_DIR=$(cd dist/bin/; pwd)
  $SIGNMAR_ABS_DIR/signmar -d $CQZ_CERT_DB_PATH -n "$MAR_CERT_NAME" \
    -s $MAR_FILE $MAR_FILE.signed

  mv $MAR_FILE $MAR_FILE.unsigned
  cp $MAR_FILE.signed $MAR_FILE
fi

echo '***** Uploading MAR and package files *****'
$MAKE upload

echo '***** Genereting build_properties.json *****'
$ROOT_PATH/$SRC_BASE/build/gen_build_properties.py

echo '***** Submiting to Balrog *****'
python $ROOT_PATH/build-tools/scripts/updates/balrog-submitter.py \
  --credentials-file $ROOT_PATH/$SRC_BASE/build/creds.txt --username balrogadmin \
  --api-root http://$CQZ_BALROG_DOMAIN/api \
  --build-properties build_properties.json

cd $ROOT_PATH
