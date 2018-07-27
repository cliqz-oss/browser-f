#!/usr/bin/env bash

set -e -o pipefail

if [[ -z ${CQZ_S3_MACOSXBUILD_URL} ]]; then
    echo "set: CQZ_S3_MACOSXBUILD_URL"
    exit -1
fi

SRC_DIR=mozilla-release
OBJ_DIR=${SRC_DIR}/obj-x86_64-apple-darwin/dist

OBJ_PATH=${OBJ_DIR}

aws s3 cp $OBJ_PATH/*.dmg ${CQZ_S3_MACOSXBUILD_URL}/
