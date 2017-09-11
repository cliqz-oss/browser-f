FROM ubuntu:16.04

RUN apt-get update && apt-get install -y \
  gcc \
  alien \
  fakeroot \
  rpm \
  git \
  python-dev \
  python-pip \
  desktop-file-utils \
  wget \
  sudo \
  libgstreamer1.0-dev \
  libgstreamer-plugins-base1.0-dev \
  libgstreamer-plugins-base0.10-0 \
  libgstreamer0.10-0 \
  libgstreamer0.10-dev \
  autoconf2.13 \
  build-essential \
  ccache \
  python-dev \
  python-pip \
  python-setuptools \
  unzip \
  uuid \
  zip \
  libasound2-dev \
  libcurl4-openssl-dev \
  libdbus-1-dev \
  libdbus-glib-1-dev \
  libgconf2-dev \
  libgtk-3-dev \
  libgtk2.0-dev \
  libiw-dev \
  libnotify-dev \
  libpulse-dev \
  libx11-xcb-dev \
  libxt-dev \
  mesa-common-dev \
  python-dbus \
  xvfb \
  yasm 

RUN echo "deb http://repo.aptly.info/ squeeze main" > /etc/apt/sources.list.d/aptly.list; \
  apt-key adv --keyserver keys.gnupg.net --recv-keys 9E3E53F19C7DE460; \
  apt-get update; \
  apt-get install aptly -y

RUN pip install awscli \
  compare-locales

ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN set -eux; \
    \
# this "case" statement is generated via "update.sh"
    dpkgArch="$(dpkg --print-architecture)"; \
    case "${dpkgArch##*-}" in \
        amd64) rustArch='x86_64-unknown-linux-gnu'; rustupSha256='f5833a64fd549971be80fa42cffc6c5e7f51c4f443cd46e90e4c17919c24481f' ;; \
        armhf) rustArch='armv7-unknown-linux-gnueabihf'; rustupSha256='67a98a67f7f7bf19c5cde166499acb8299f2f8fa88c155093df53b66da1f512a' ;; \
        arm64) rustArch='aarch64-unknown-linux-gnu'; rustupSha256='82fe368c4ebf1683d57e137242793a4417042639aace8bd514601db7d79d3645' ;; \
        i386) rustArch='i686-unknown-linux-gnu'; rustupSha256='7a1c085591f6c1305877919f8495c04a1c97546d001d1357a7a879cedea5afbb' ;; \
        *) echo >&2 "unsupported architecture: ${dpkgArch}"; exit 1 ;; \
    esac; \
    \
    url="https://static.rust-lang.org/rustup/archive/1.6.0/${rustArch}/rustup-init"; \
    wget "$url"; \
    echo "${rustupSha256} *rustup-init" | sha256sum -c -; \
    chmod +x rustup-init; \
    ./rustup-init -y --no-modify-path --default-toolchain 1.20.0; \
    rm rustup-init; \
    chmod -R a+w $RUSTUP_HOME $CARGO_HOME; \
    rustup --version; \
    cargo --version; \
    rustc --version;

RUN wget -O bootstrap.py https://hg.mozilla.org/mozilla-central/raw-file/default/python/mozboot/bin/bootstrap.py && \
  python bootstrap.py --application-choice=browser --no-interactive && \
  rm bootstrap.py

ARG uid
ARG gid
ARG user
ENV SHELL=/bin/bash

RUN groupadd $user -g $gid && useradd -ms /bin/bash $user -u $uid -g $gid && usermod -aG sudo $user

# Enable passwordless sudo for users under the "sudo" group
RUN sed -i.bkp -e \
      's/%sudo\s\+ALL=(ALL\(:ALL\)\?)\s\+ALL/%sudo ALL=NOPASSWD:ALL/g' \
      /etc/sudoers

RUN mkdir /builds
