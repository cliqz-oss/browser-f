FROM ubuntu:16.04
MAINTAINER Sharath Ganesh Pai <sharath@cliqz.com>
ENV DEBIAN_FRONTEND noninteractive
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y autoconf2.13 build-essential ccache curl git lib32z1 \
        libc6:i386 libncurses5:i386 libstdc++6:i386 mercurial openjdk-8-jdk \
        python-dev python-pip python-setuptools unzip uuid \
        wget xz-utils zip && \
    apt-get clean -y && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    mkdir -p /root/.mozbuild/proguard/lib && \
    wget --output-document=/tmp/proguard.tgz --quiet "https://vorboss.dl.sourceforge.net/project/proguard/proguard/5.3/proguard5.3.3.tar.gz" && \
    (cd /tmp; tar xf proguard.tgz && cp proguard5.3.3/lib/proguard.jar /root/.mozbuild/proguard/lib) && \
    rm -rf /tmp/proguard*
ENV SHELL /bin/bash
ENV ANDROID_HOME /root/.mozbuild/android-sdk-linux
RUN mkdir -p $ANDROID_HOME; \
    cd $ANDROID_HOME; \
    wget --output-document=sdktools.zip --quiet 'https://dl.google.com/android/repository/sdk-tools-linux-3859397.zip'; \
    unzip sdktools.zip; \
    rm -r sdktools.zip; \
    (while (true); do echo y; sleep 2; done) | \
      tools/bin/sdkmanager  "build-tools;25.0.3" "platforms;android-23" "platform-tools" "tools" "extras;google;m2repository" "extras;android;m2repository" "extras;google;google_play_services" "emulator";
RUN cd /root && \
    wget --output-document=nodejs.tgz --quiet \
      'https://nodejs.org/dist/v8.9.3/node-v8.9.3-linux-x64.tar.xz' && \
    tar xf nodejs.tgz && \
    rm -f nodejs.tgz
ENV PATH "/root/node-v8.9.3-linux-x64/bin:$PATH"
RUN npm install -g yarn
