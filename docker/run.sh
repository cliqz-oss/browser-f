#!/usr/bin/env bash

./build.sh "$@"
docker run \
    -it \
    --rm \
    -e DISPLAY="${DISPLAY}" \
    -v /dev/shm:/dev/shm \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    browser-f-test cliqz --no-remote
