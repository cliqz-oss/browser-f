# Dockerfile used for regular linux builds.
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
  yasm \
  apt-transport-https

RUN pip install awscli

RUN echo "deb http://repo.aptly.info/ squeeze main" > /etc/apt/sources.list.d/aptly.list; \
  apt-key adv --keyserver pool.sks-keyservers.net --recv-keys ED75B5A4483DA07C; \
  apt-get update; \
  apt-get install aptly -y

  ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN echo "deb http://ppa.launchpad.net/mercurial-ppa/releases/ubuntu xenial main" > /etc/apt/sources.list.d/mercurial.list; \
  apt-key adv --keyserver pool.sks-keyservers.net --recv-keys 41BD8711B1F0EC2B0D85B91CF59CE3A8323293EE; \
  apt-get update; \
  apt-get install mercurial -y

RUN wget -qO- https://deb.nodesource.com/gpgkey/nodesource.gpg.key | apt-key add -
RUN echo "deb https://deb.nodesource.com/node_10.x xenial main" > /etc/apt/sources.list.d/nodesource.list; \
  apt-get update; \
  apt-get install -y nodejs

RUN set -eux; \
    \
# this "case" statement is generated via "update.sh"
    dpkgArch="$(dpkg --print-architecture)"; \
    case "${dpkgArch##*-}" in \
        amd64) rustArch='x86_64-unknown-linux-gnu'; rustupSha256='5a38dbaf7ab2e4335a3dfc42698a5b15e7167c93b0b06fc95f53c1da6379bf1a' ;; \
        armhf) rustArch='armv7-unknown-linux-gnueabihf'; rustupSha256='67a98a67f7f7bf19c5cde166499acb8299f2f8fa88c155093df53b66da1f512a' ;; \
        arm64) rustArch='aarch64-unknown-linux-gnu'; rustupSha256='82fe368c4ebf1683d57e137242793a4417042639aace8bd514601db7d79d3645' ;; \
        i386) rustArch='i686-unknown-linux-gnu'; rustupSha256='7a1c085591f6c1305877919f8495c04a1c97546d001d1357a7a879cedea5afbb' ;; \
        *) echo >&2 "unsupported architecture: ${dpkgArch}"; exit 1 ;; \
    esac; \
    url="https://static.rust-lang.org/rustup/archive/1.7.0/${rustArch}/rustup-init"; \
    wget "$url"; \
    echo "${rustupSha256} *rustup-init" | sha256sum -c -; \
    chmod +x rustup-init; \
    ./rustup-init -y --no-modify-path --default-toolchain 1.32.0; \
    rm rustup-init; \
    chmod -R a+w $RUSTUP_HOME $CARGO_HOME; \
    rustup --version; \
    cargo --version; \
    rustc --version

RUN cargo install --version 0.8.2 cbindgen

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

USER $user
ENV CLANG_HOME /home/$user/clang/clang+llvm-6.0.0-x86_64-linux-gnu-ubuntu-16.04/
ENV GCC_VERSION=6.0.0
ENV CXX=$CLANG_HOME/bin/clang++
ENV CC=$CLANG_HOME/bin/clang
ENV LLVM_CONFIG=$CLANG_HOME/bin/llvm-config
SHELL ["/bin/bash", "-l", "-c"]

#Install CLang
RUN mkdir -p /home/$user/clang; \
    cd /home/$user/clang; \
    wget --output-document=clang.tar.xz --quiet "https://repository.cliqz.com/dist/android/artifacts/clang/clang%2Bllvm-6.0.0-x86_64-linux-gnu-ubuntu-16.04.tar.xz"; \
    tar xf clang.tar.xz; \
    echo 'export PATH=$CLANG_HOME/bin:$PATH' >> ~/.bashrc; \
    echo 'export LD_LIBRARY_PATH=$CLANG_HOME/lib:LD_LIBRARY_PATH' >> ~/.bashrc; \
    ln -s /usr/include include; \
    ln -s /usr/bin bin;\
    mkdir -p lib/gcc/x86_64-linux-gnu/; \
    cd lib/gcc/x86_64-linux-gnu/; \
    ln -s /usr/lib/gcc/x86_64-linux-gnu/$GCC_VERSION $GCC_VERSION

#Install nasm 2.13
RUN mkdir -p /home/$user/nasm; \
    cd /home/$user/nasm; \
    wget --output-document=nasm.tar.xz --quiet "https://www.nasm.us/pub/nasm/releasebuilds/2.13.03/nasm-2.13.03.tar.xz"; \
    tar xf nasm.tar.xz; \
    cd nasm-2.13.03; \
    sh configure; \
    sudo make install
