#!/bin/bash
set -ex
set -o pipefail
# This ugly hack is a cross-platform (Linux/Mac/Windows+MSYS) way to get the
# absolute path to the directory containing this script
pushd `dirname $0` &>/dev/null
MY_DIR=$(pwd)
popd &>/dev/null
SCRIPTS_DIR="$MY_DIR/../../.."
PYTHON="/tools/python/bin/python"
if [ ! -x $PYTHON ]; then
    PYTHON=python
fi
JSONTOOL="$PYTHON $SCRIPTS_DIR/buildfarm/utils/jsontool.py"
workdir=`pwd`

platform=$1
configDict=$2
chunks=$3
thisChunk=$4
channel=$5

if [ -n "$PROPERTIES_FILE" -a -f "$PROPERTIES_FILE" ]; then
    # Buildbot only
    if $JSONTOOL -k properties.NO_BBCONFIG $PROPERTIES_FILE; then
       NO_BBCONFIG=$($JSONTOOL -k properties.NO_BBCONFIG $PROPERTIES_FILE);
    fi
    if $JSONTOOL -k properties.VERIFY_CONFIG $PROPERTIES_FILE; then
       VERIFY_CONFIG=$($JSONTOOL -k properties.VERIFY_CONFIG $PROPERTIES_FILE);
    fi
    if [ -z "$NO_BBCONFIG" -a -z "$BUILDBOT_CONFIGS" ]; then
        export BUILDBOT_CONFIGS="https://hg.mozilla.org/build/buildbot-configs"
    fi
    # Get the assumed slavebuilddir, and read in from buildbot if this is not
    # Release promotion
    SLAVEBUILDDIR=$(basename $(cd "$SCRIPTS_DIR/.."; pwd))
    if [ -z "$NO_BBCONFIG" ]; then
        RELEASE_CONFIG=$($JSONTOOL -k properties.release_config $PROPERTIES_FILE)
        TAG=$($JSONTOOL -k properties.release_tag $PROPERTIES_FILE)
        SLAVEBUILDDIR=$($JSONTOOL -k properties.slavebuilddir $PROPERTIES_FILE)
    fi

    $PYTHON -u $SCRIPTS_DIR/buildfarm/maintenance/purge_builds.py \
        -s 16 -n info -n 'rel-*' -n 'tb-rel-*' -n $SLAVEBUILDDIR
fi

if [ -z "$VERIFY_CONFIG" -a -n "$NO_BBCONFIG" ]; then
    echo "Unable to run without VERIFY_CONFIG specified when using NO_BBCONFIG"
    exit 1
fi

if [ -z "$NO_BBCONFIG" ]; then
  $PYTHON $MY_DIR/chunked-verify.py -t $TAG -r $RELEASE_CONFIG \
  -b $BUILDBOT_CONFIGS -p $platform --chunks $chunks --this-chunk $thisChunk \
  --config-dict $configDict --release-channel $channel \
    2>&1 | tee $SCRIPTS_DIR/../verify_log.txt
else
  $PYTHON $MY_DIR/chunked-verify.py --chunks $chunks --this-chunk $thisChunk \
  --verify-config $VERIFY_CONFIG \
  2>&1 | tee $SCRIPTS_DIR/../verify_log.txt
fi

print_failed_msg()
{
  echo "-------------------------"
  echo "This run has failed, see the above log"
  echo
  return 1
}

set +x

echo "Scanning log for failures"
echo "-------------------------"

# Test for a failure, note we are set -e.
# Grep returns 0 on a match and 1 on no match
( ! grep FAIL $SCRIPTS_DIR/../verify_log.txt ) || print_failed_msg

echo "-------------------------"
echo "All is well"
