#! /bin/bash

# set -u
set -e
set -x

source cliqz_env.sh

cd $SRC_BASE
cd $OBJ_DIR

echo '***** Generate MAR for DE, if needed *****'
if [ $CQZ_BUILD_DE_LOCALIZATION ]; then
  $MAKE -C ./tools/update-packaging full-update AB_CD=de
fi
echo '***** Packaging MAR *****'
$MAKE update-packaging

if [ $CQZ_CERT_DB_PATH ]; then
  # TODO: Specify certificate name by env var.
  if [ -z "$MAR_CERT_NAME" ]; then
    MAR_CERT_NAME="Cliqz GmbH's DigiCert Inc ID"
  fi
  echo '***** Signing mar *****'
  MAR_FILES=dist/update/*.mar
  for MAR_FILE in $MAR_FILES
  do
    # signmar is somehow dependent on its execution path. It refuses to work when
    # launched using relative paths, and gives unrelated error:
    # "Could not initialize NSS". BEWARE!
    SIGNMAR_ABS_DIR=$(cd dist/bin/; pwd)
    $SIGNMAR_ABS_DIR/signmar -d $CQZ_CERT_DB_PATH -n "$MAR_CERT_NAME" \
      -s $MAR_FILE $MAR_FILE.signed

    mv $MAR_FILE $MAR_FILE.unsigned
    cp $MAR_FILE.signed $MAR_FILE
  done
fi

echo '***** Uploading MAR and package files *****'
export LANG=$LANG
$MAKE upload

echo '***** Genereting build_properties.json *****'
$ROOT_PATH/$SRC_BASE/build/gen_build_properties.py

if [ $CQZ_BUILD_DE_LOCALIZATION ]; then
  # Rename build_properties so name wont collide with repack
  cp build_properties.json en_build_properties.json

  OLD_LANG=$LANG
  export LANG='de'
  # We need to copy this files because we build DE version as repack step, so
  # they don't exist for DE build (but must be before uploading stage, so they)
  # fall into mach_build_properties.json file
  for f in dist/cliqz-*.{txt,json}; do
    cp $f `echo $f | sed "s/en-US/$LANG/"`
  done

  $MAKE upload AB_CD=$LANG

  echo '***** Genereting build_properties.json *****'
  $ROOT_PATH/$SRC_BASE/build/gen_build_properties.py

  # Rename de build_properties for easier identification
  cp build_properties.json de_build_properties.json


  export LANG=$OLD_LANG
fi

cd $ROOT_PATH
