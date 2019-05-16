# dockerfile to build macos version on linux.
FROM ubuntu:16.04

RUN apt-get update && apt-get install -y unzip python3 make zip autoconf2.13 wget \
    python yasm clang-6.0 rsync xz-utils awscli libnss3-dev libnss3-tools

WORKDIR /opt
ADD cbindgen.tar.xz /opt
ADD cctools.tar.xz /opt
ADD nasm.tar.bz2 /opt
ADD clang.tar.xz /opt
ADD dmg.tar.xz /opt
ADD hfsplus-tools.tar.xz /opt
ADD llvm-dsymutil.tar.xz /opt
ADD node.tar.xz /opt
ADD rustc.tar.xz /opt
ADD rust-size.tar.xz /opt
ADD MacOSX10.11.sdk.tar.bz2 /opt
ADD http://repository.cliqz.com.s3.amazonaws.com/dist/artifacts/mac/release/1.27.0/signmar /opt
RUN chmod 755 /opt/signmar
# RUST seems to depend on cc
RUN ln -s /opt/clang/bin/clang /usr/bin/cc
ENV CROSS_TARGET  x86_64-apple-darwin
ENV TOOLCHAIN /opt

ARG UID
ARG GID
ARG user
ENV SHELL=/bin/bash

RUN getent group $GID || groupadd $user --gid $GID && \
    useradd --create-home --shell /bin/bash $user --uid $UID --gid $GID && \
    usermod -aG sudo $user

USER $user