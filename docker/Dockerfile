# Ubuntu:18.04 on 16-01-2020 at 3:14 am
FROM ubuntu:18.04@sha256:bc025862c3e8ec4a8754ea4756e33da6c41cba38330d7e324abd25c8e0b93300

ENV DEBIAN_FRONTEND=noninteractive

# From: https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/Linux_Prerequisites
# Additions from bootstrap.py + dependencies for custom ppa.
RUN apt-get update && apt-get install --yes \
  alien \
  apt-transport-https \
  apt-utils \
  autoconf2.13 \
  autotools-dev \
  binutils-avr \
  build-essential \
  ccache \
  cdbs \
  debhelper \
  desktop-file-utils \
  fakeroot \
  hunspell-en-us \
  libasound2-dev \
  libcurl4-openssl-dev \
  libdbus-1-dev \
  libdbus-glib-1-dev \
  libffi-dev \
  libfontconfig1-dev \
  libfreetype6-dev \
  libgl1-mesa-dev \
  libglib2.0-dev \
  libgstreamer-plugins-base1.0-dev \
  libgstreamer1.0-dev \
  libgtk-3-dev \
  libgtk2.0-dev \
  libiw-dev \
  libnotify-dev \
  libpango1.0-dev \
  libpulse-dev \
  libpython-dev \
  libstartup-notification0-dev \
  libx11-dev \
  libx11-xcb-dev \
  libxext-dev \
  libxrender-dev \
  libxt-dev \
  lsb-release \
  make \
  mesa-common-dev \
  nasm \
  pkg-config \
  python-dbus \
  python-dev \
  python-pip \
  python-setuptools \
  rpm \
  software-properties-common \
  sudo \
  unzip \
  uuid \
  wget \
  xvfb \
  yasm \
  zip

# Install clang + llvm version 9
RUN wget -O - https://apt.llvm.org/llvm-snapshot.gpg.key | apt-key add - \
 && add-apt-repository "deb http://apt.llvm.org/bionic/ llvm-toolchain-bionic-9 main" \
 && apt-get update \
 && apt-get install --yes clang-9 lldb-9 lld-9 clangd-9 libclang-9-dev

# Install awscli
RUN pip install awscli==1.17.5

# Install aptly for ppa management
RUN echo "deb http://repo.aptly.info/ squeeze main" > /etc/apt/sources.list.d/aptly.list \
 && wget -qO - https://www.aptly.info/pubkey.txt | apt-key add - \
 && apt-get update \
 && apt-get install aptly --yes

# Install Node.js (LTS = 12.x)
RUN wget -qO- https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add - \
 && echo "deb https://deb.nodesource.com/node_12.x bionic main" > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update \
 && apt-get install --yes nodejs

# Install Rust toolchain version 1.41.0
ENV RUSTUP_HOME=/usr/local/rustup \
  CARGO_HOME=/usr/local/cargo \
  PATH=/usr/local/cargo/bin:$PATH

RUN wget "https://static.rust-lang.org/rustup/archive/1.21.1/x86_64-unknown-linux-gnu/rustup-init" \
 && echo "ad1f8b5199b3b9e231472ed7aa08d2e5d1d539198a15c5b1e53c746aad81d27b *rustup-init" | sha256sum -c - \
 && chmod +x rustup-init \
 && ./rustup-init -y --no-modify-path --default-toolchain 1.41.0 \
 && rm rustup-init \
 && chmod -R a+w $RUSTUP_HOME $CARGO_HOME \
 && rustup --version \
 && cargo --version \
 && rustc --version

# Install cbindgen
RUN cargo install --version 0.14.1 cbindgen

# Install nasm 2.14 (see: https://www.nasm.us)
RUN mkdir -p /home/$user/nasm \
 && cd /home/$user/nasm \
 && wget --output-document=nasm.tar.xz --quiet "https://www.nasm.us/pub/nasm/releasebuilds/2.14.02/nasm-2.14.02.tar.xz" \
 && tar xf nasm.tar.xz \
 && cd nasm-2.14.02 \
 && sh configure \
 && sudo make install

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

ENV CC="clang-9 --target=x86_64-unknown-linux-gnu"
ENV CXX="clang++-9 --target=x86_64-unknown-linux-gnu"

SHELL ["/bin/bash", "-l", "-c"]
