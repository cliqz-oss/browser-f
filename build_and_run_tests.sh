#!/usr/bin/env bash

# Copyright (c) 2016 Cliqz GmbH. All rights reserved.
# Author: Max Breev <maxim@cliqz.com>

set -e
set -x

# Can be set outside to override default output directory name.
if [ -z "$OUT_DIR_NAME" ]; then
  OUT_DIR_NAME=obj-tests
fi

BASEDIR=$(dirname "$BASH_SOURCE")
LOG_FILE=mochitest.log
export MOZ_OBJDIR=../$OUT_DIR_NAME
export MOZCONFIG=browser/config/cliqz.mozconfig

cd $BASEDIR/mozilla-release
mkdir -p $MOZ_OBJDIR

# Build test variant of the browser
./mach build

# Run tests and save logs
./mach mochitest | tee $MOZ_OBJDIR/$LOG_FILE
