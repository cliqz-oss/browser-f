#!/bin/bash

diff -i <(cd cliqz; find . -print0 | xargs -0 file --) <(cd official; find . -print0 | xargs -0 file --)
