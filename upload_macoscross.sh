#!/usr/bin/env bash

set -e -o pipefail

if [[ -z ${CQZ_S3_MACOSXBUILD_URL} ]]; then
    echo "set: CQZ_S3_MACOSXBUILD_URL"
    exit -1
fi

OBJ_PATH=obj/dist

aws s3 cp $OBJ_PATH/*.dmg ${CQZ_S3_MACOSXBUILD_URL}/
