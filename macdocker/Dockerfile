FROM ubuntu:17.10

# build deps for xbuild tools
RUN apt-get update && \
    apt-get install -y clang make patch unzip llvm cmake git curl uuid-dev \
        zlib1g-dev libbz2-dev

# osxcross
WORKDIR /opt
RUN curl -LO https://github.com/tpoechtrager/osxcross/archive/master.zip
RUN unzip master.zip
RUN ln -s /opt/osxcross-master /opt/osxcross
WORKDIR /opt/osxcross/
COPY MacOSX10.11.sdk.tar.bz2 tarballs/
RUN echo yes | ./build.sh

# hfstools
WORKDIR /opt
RUN git clone https://github.com/mozilla/libdmg-hfsplus.git
WORKDIR /opt/libdmg-hfsplus
RUN mkdir build
WORKDIR build
RUN cmake ..
RUN make

# libdmg-hfsplus is broken on newer openssl api, but diskdev commands needs it.
RUN apt-get update && \
	apt-get install -y libssl-dev
# diskdev
WORKDIR /opt
RUN curl -LO  http://cavan.codon.org.uk/~mjg59/diskdev_cmds/diskdev_cmds-540.1.linux3.tar.gz
RUN tar xf diskdev_cmds-540.1.linux3.tar.gz
RUN ln -s /opt/diskdev_cmds-540.1.linux3 /opt/diskdev_cmds
WORKDIR /opt/diskdev_cmds
RUN make

# browser build-deps.
WORKDIR /opt
RUN apt-get update && \
    apt-get install -y python3 python wget zip autoconf2.13 m4 yasm rsync
# bring up rust
ENV RUSTUP_HOME=/opt/rust
ENV CARGO_HOME=/opt/rust
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable
RUN chmod -R a+x /opt/rust/bin
ENV PATH=/opt/rust/bin:$PATH
RUN rustup target add x86_64-apple-darwin

# bring up aws cli
RUN apt-get update && \
    apt-get install -y awscli

# environment variables for build.
ENV CROSS_CCTOOLS_PATH /opt/osxcross/target
ENV CROSS_SYSROOT ${CROSS_CCTOOLS_PATH}/SDK/MacOSX10.11.sdk
ENV CROSS_PRIVATE_FRAMEWORKS $CROSS_SYSROOT/System/Library/PrivateFrameworks

ENV FLAGS "-B $CROSS_CCTOOLS_PATH/bin -isysroot $CROSS_SYSROOT" 
ENV CC "$CROSS_CCTOOLS_PATH/bin/x86_64-apple-darwin15-clang $FLAGS" 
ENV CXX "$CROSS_CCTOOLS_PATH/bin/x86_64-apple-darwin15-clang++ $FLAGS" 
ENV CPP "$CROSS_CCTOOLS_PATH/bin/x86_64-apple-darwin15-clang $FLAGS -E" 
ENV TOOLCHAIN_PREFIX=$CROSS_CCTOOLS_PATH/bin/x86_64-apple-darwin15- 
ENV LDFLAGS="-Wl,-syslibroot,$CROSS_SYSROOT -Wl,-dead_strip" 
ENV BINDGEN_CFLAGS="$FLAGS" 
ENV LLVMCONFIG=/usr/bin/llvm-config 
ENV DSYMUTIL=/usr/bin/llvm-dsymutil-4.0 
ENV REAL_DSYMUTIL /usr/bin/llvm-dsymutil-4.0

ENV MKFSHFS /opt/diskdev_cmds/newfs_hfs.tproj/newfs_hfs 
ENV DMG_TOOL=/opt/libdmg-hfsplus/build/dmg/dmg 
ENV HFS_TOOL=/opt/libdmg-hfsplus/build/hfs/hfsplus

ENV HOST_CC="/usr/bin/clang" 
ENV HOST_CXX="/usr/bin/clang++" 
ENV HOST_CPP="/usr/bin/clang -E"

# enable debug symbols
#ENV HOST_CFLAGS="-g"
#ENV HOST_CXXFLAGS="-g"
#ENV HOST_LDFLAGS="-g"
