#!/usr/bin/env bash

set -e
./build.sh "$@"
docker run \
    -it \
    --rm \
    --env DISPLAY="${DISPLAY}" \
    --volume /dev/shm:/dev/shm \
    --volume /tmp/.X11-unix:/tmp/.X11-unix:ro \
    browser-f-test cliqz --no-remote
