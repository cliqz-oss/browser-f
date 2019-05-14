#!/bin/bash

set -e
set -x

export CQZ_VERSION=$(cat ./mozilla-release/browser/config/version_display.txt)
export WAIT=2
export RETRIES=3
export ARTIFACT_PATH="/c/build"
export ARTIFACT_VERSION=$(cat $ARTIFACT_PATH/version.txt)

retry() {
    cmd="$1"

    c=0
    while [ $c -lt $((RETRIES+1)) ]; do
        c=$((c+1))
        $1 && return $?

        if [ ! $c -eq $RETRIES ]; then
            sleep $WAIT
        else
            return 1
        fi
    done
}

download() {
    package="$1"

    wget -O "${ARTIFACT_PATH}/${package}" "https://repository.cliqz.com/dist/artifacts/win/release/${CQZ_VERSION}/${package}"
    tar xjvf ${ARTIFACT_PATH}/${package} -C $ARTIFACT_PATH
}

download_internal() {
    package="$1"

    wget -O "${ARTIFACT_PATH}/${package}" "ftp://cliqznas/cliqzwinbuild/${package}"
    tar xjvf ${ARTIFACT_PATH}/${package} -C $ARTIFACT_PATH
}

main() {
    if [ "$CQZ_VERSION" != "$ARTIFACT_VERSION" ]; then
        rm -rf $ARTIFACT_PATH
    fi
    mkdir -p $ARTIFACT_PATH

    packages=("rustc.tar.bz2" "clang.tar.bz2" "nasm.tar.bz2" "cbindgen.tar.bz2" "node.tar.bz2")
    for package in ${packages[@]}; do
        if [ ! -s "$ARTIFACT_PATH/$package" ]; then
            retry "download $package"
        fi
    done

    # TODO: remove copy-paste here
    packages_internal=("vs2017_15.9.10.tar.bz2")
    for package in ${packages_internal[@]}; do
        if [ ! -s "$ARTIFACT_PATH/$package" ]; then
            retry "download_internal $package"
        fi
    done

    echo $CQZ_VERSION > $ARTIFACT_PATH/version.txt
}

main "$@"
