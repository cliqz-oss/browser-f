#!/bin/bash


awk -F '=' '/version/ {print $2}' ./repack/distribution/distribution.ini | head -n1
