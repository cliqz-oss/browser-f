# Ubuntu:19.10 on 16-01-2020 at 3:15 am
FROM ubuntu:19.10@sha256:9e9387cd5380eb96ace218a2f85ed25ac75563cd170f91852a73aefda6fa7834

# NOTE: is this the issue? https://bugzilla.mozilla.org/show_bug.cgi?id=1594686

ENV DEBIAN_FRONTEND=noninteractive

# From: https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/Linux_Prerequisites
# Additions from bootstrap.py + dependencies for custom ppa.
RUN apt-get update && apt-get install --yes \
  alien \
  apt-transport-https \
  apt-utils \
  aptly \
  autoconf2.13 \
  awscli \
  binutils-avr \
  build-essential \
  ccache \
  clang \
  desktop-file-utils \
  fakeroot \
  hunspell-en-us \
  libasound2-dev \
  libcurl4-openssl-dev \
  libdbus-1-dev \
  libdbus-glib-1-dev \
  libfontconfig1-dev \
  libfreetype6-dev \
  libgl1-mesa-dev \
  libgstreamer-plugins-base1.0-dev \
  libgstreamer1.0-dev \
  libgtk-3-dev \
  libgtk2.0-dev \
  libnotify-dev \
  libpulse-dev \
  libpython-dev \
  libx11-xcb-dev \
  libxt-dev \
  make \
  nasm \
  nodejs \
  pkg-config \
  python-dbus \
  python-dev \
  python-pip \
  python-setuptools \
  rpm \
  sudo \
  unzip \
  uuid \
  wget \
  xvfb \
  yasm \
  zip

ENV RUSTUP_HOME=/usr/local/rustup \
  CARGO_HOME=/usr/local/cargo \
  PATH=/usr/local/cargo/bin:$PATH

RUN wget "https://static.rust-lang.org/rustup/archive/1.21.1/x86_64-unknown-linux-gnu/rustup-init" \
 && echo "ad1f8b5199b3b9e231472ed7aa08d2e5d1d539198a15c5b1e53c746aad81d27b *rustup-init" | sha256sum -c - \
 && chmod +x rustup-init \
 && ./rustup-init -y --no-modify-path --default-toolchain 1.39.0 \
 && rm rustup-init \
 && chmod -R a+w $RUSTUP_HOME $CARGO_HOME \
 && rustup --version \
 && cargo --version \
 && rustc --version

RUN cargo install --version 0.12.2 cbindgen

ARG uid
ARG gid
ARG user
ENV SHELL=/bin/bash

RUN groupadd $user -g $gid \
 && useradd -ms /bin/bash $user -u $uid -g $gid \
 && usermod -aG sudo $user

# Enable passwordless sudo for users under the "sudo" group
RUN sed -i.bkp -e \
      's/%sudo\s\+ALL=(ALL\(:ALL\)\?)\s\+ALL/%sudo ALL=NOPASSWD:ALL/g' \
      /etc/sudoers

RUN mkdir /builds

USER $user

SHELL ["/bin/bash", "-l", "-c"]
