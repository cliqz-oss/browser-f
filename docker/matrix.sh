#!/usr/bin/env bash

##############################################################################
# Test .deb
##############################################################################
./build.sh release ubuntu deb
./build.sh release ubuntu:16.04 deb
./build.sh release ubuntu:18.04 deb
./build.sh release ubuntu:19.04 deb
./build.sh release ubuntu:19.10 deb
./build.sh release debian deb
./build.sh release debian:10 deb
./build.sh release debian:buster deb

##############################################################################
# Test PPA
##############################################################################
./build.sh release ubuntu ppa
./build.sh release ubuntu:16.04 ppa
./build.sh release ubuntu:18.04 ppa
./build.sh release ubuntu:19.04 ppa
./build.sh release ubuntu:19.10 ppa
./build.sh release debian ppa
./build.sh release debian:10 ppa
./build.sh release debian:buster ppa

##############################################################################
# Test rpm
##############################################################################
./build.sh release opensuse rpm
./build.sh release opensuse:15 rpm
./build.sh release opensuse:leap rpm
./build.sh release opensuse:16 rpm
./build.sh release opensuse:tumbleweed rpm
./build.sh release fedora rpm
./build.sh release fedora:28 rpm
./build.sh release fedora:29 rpm
./build.sh release fedora:30 rpm
./build.sh release fedora:31 rpm
./build.sh release centos rpm
./build.sh release centos:8 rpm

# NOTE: currently broken
# ./build.sh release archlinux aur
