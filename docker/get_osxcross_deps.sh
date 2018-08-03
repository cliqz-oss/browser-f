#!/usr/bin/env bash

set -e -o pipefail

if [[ -z $OSX_SDK_PATH ]]; then
   OSX_SDK_PATH="s3://cliqz-ci/osxcross/MacOSX10.11.sdk.tar.bz2"
fi

# get osx sdk bundle.
aws s3 cp $OSX_SDK_PATH .

