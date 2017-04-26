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
  libgstreamer0.10-dev

RUN echo "deb http://repo.aptly.info/ squeeze main" > /etc/apt/sources.list.d/aptly.list; \
  apt-key adv --keyserver keys.gnupg.net --recv-keys 9E3E53F19C7DE460; \
  apt-get update; \
  apt-get install aptly -y

RUN pip install awscli \
  compare-locales

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
