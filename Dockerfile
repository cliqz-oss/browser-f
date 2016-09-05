FROM ubuntu:14.04

RUN apt-get update && apt-get install -y \
  alien \
  fakeroot \
  rpm \
  git \
  python-dev \
  python-pip \
  desktop-file-utils \
  wget \
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

ARG UID
ARG GID
RUN groupadd jenkins -g $GID && useradd -ms /bin/bash jenkins -u $UID -g $GID

USER jenkins

RUN wget -O bootstrap.py https://hg.mozilla.org/mozilla-central/raw-file/default/python/mozboot/bin/bootstrap.py && \
  python bootstrap.py --application-choice=browser --no-interactive && \
  rm bootstrap.py
