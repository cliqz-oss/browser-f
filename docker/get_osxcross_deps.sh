#!/usr/bin/env bash

set -e -o pipefail

if [[ -z $TOOLCHAIN_DATE ]]; then
    TOOLCHAIN_DATE="2018-09-06"
fi

if [[ -z $OSX_SDK_PATH ]]; then
   OSX_SDK_PATH="s3://cliqz-ci/osxcross/MacOSX10.11.sdk.tar.bz2"
fi

# get toolchain bundles
for bundle in "cbindgen.tar.xz" "cctools.tar.xz" "clang.tar.xz" "dmg.tar.xz" \
                                "hfsplus-tools.tar.xz" "llvm-dsymutil.tar.xz" \
                                "node.tar.xz" "rustc.tar.xz" "rust-size.tar.xz"; do
    curl "https://s3.amazonaws.com/cliqz-ci/osxcross/toolchain/${TOOLCHAIN_DATE}/${bundle}" > ${bundle}
done

# get osx sdk bundle.
aws s3 cp $OSX_SDK_PATH .
