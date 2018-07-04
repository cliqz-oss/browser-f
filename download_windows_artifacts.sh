#!/bin/bash

set -e
set -x

export CQZ_VERSION=$(cat ./mozilla-release/browser/config/version_display.txt)
export WAIT=2
export RETRIES=3
export ARTIFACT_PATH="/c/build"

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

main() {
    mkdir -p $ARTIFACT_PATH

    packages=("rustc.tar.bz2" "clang.tar.bz2" "redist.tar.bz2")
    for package in ${packages[@]}; do
        if [ ! -s "$ARTIFACT_PATH/$package" ]; then
            retry "download $package"
        fi
    done
}

main "$@"
