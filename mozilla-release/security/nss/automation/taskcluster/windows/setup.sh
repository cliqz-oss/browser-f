#!/usr/bin/env bash

set -v -e -x

export VSPATH="$(pwd)/vs2017_15.4.2"
export NINJA_PATH="$(pwd)/ninja/bin"

export WINDOWSSDKDIR="${VSPATH}/SDK"
export VS90COMNTOOLS="${VSPATH}/VC"
export INCLUDE="${VSPATH}/VC/include:${VSPATH}/SDK/Include/10.0.15063.0/ucrt:${VSPATH}/SDK/Include/10.0.15063.0/shared:${VSPATH}/SDK/Include/10.0.15063.0/um"

# Usage: hg_clone repo dir [revision=@]
hg_clone() {
    repo=$1
    dir=$2
    rev=${3:-@}
    for i in 0 2 5; do
        sleep $i
        hg clone -r "$rev" "$repo" "$dir" && return
        rm -rf "$dir"
    done
    exit 1
}

hg_clone https://hg.mozilla.org/build/tools tools default
tools/scripts/tooltool/tooltool_wrapper.sh $(dirname $0)/releng.manifest https://tooltool.mozilla-releng.net/ non-existant-file.sh /c/mozilla-build/python/python.exe /c/builds/tooltool.py --authentication-file /c/builds/relengapi.tok -c /c/builds/tooltool_cache
