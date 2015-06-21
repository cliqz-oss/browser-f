#!/bin/bash
set -e
eval `ssh-agent`
ssh-add ~/.ssh/ffxbld_rsa
trap "ssh-agent -k" EXIT

SCRIPTS_DIR="$(dirname $0)/../.."

# Call the Python 2.7 package in Win64 machines.
if [ "$OS" = "Windows_NT" ] && [ -e "/c/mozilla-build/python27/python.exe" ]; then
    PYBIN="/c/mozilla-build/python27/python.exe"
elif [ "$TERM" = "linux" ] && [ -e "/usr/local/bin/python2.7" ]; then
    PYBIN="/usr/local/bin/python2.7"
else
    PYBIN="python"
fi

test $HG_BUNDLE && BUNDLE_ARGS="--bundle $HG_BUNDLE"

$PYBIN $SCRIPTS_DIR/buildfarm/utils/hgtool.py $BUNDLE_ARGS $HG_REPO fuzzing
$PYBIN fuzzing/bot.py --remote-host "$FUZZ_REMOTE_HOST" --basedir "$FUZZ_BASE_DIR"
