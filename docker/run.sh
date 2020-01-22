#!/usr/bin/env sh

set -e

usage() {
  echo "Usage: run.sh <channel> <os> <flavor>"
  echo "  where:"
  echo "    <channel> must be one of:"
  echo "      - beta"
  echo "      - release"
  echo "    <os> must be one of:"
  echo "      - ubuntu"
  echo "      - ubuntu:16.04"
  echo "      - ubuntu:18.04"
  echo "      - ubuntu:19.04"
  echo "      - ubuntu:19.10"
  echo "      - debian"
  echo "      - debian:10"
  echo "      - debian:buster"
  echo "      - opensuse"
  echo "      - opensuse:15"
  echo "      - opensuse:leap"
  echo "      - opensuse:16"
  echo "      - opensuse:tumbleweed"
  echo "      - fedora"
  echo "      - fedora:28"
  echo "      - fedora:29"
  echo "      - fedora:30"
  echo "      - fedora:31"
  echo "      - centos"
  echo "      - centos:8"
  echo "      - archlinux"
  echo "    <flavor> must be one of:"
  echo "      - ppa"
  echo "      - deb"
  echo "      - rpm"
  echo "      - aur"
  echo
  echo "Examples:"
  echo "  ./run.sh release ubuntu ppa"
  echo "  ./run.sh release debian:buster deb"
  echo "  ./run.sh beta ubuntu:18.04 ppa"
  echo "  ./run.sh beta opensuse:tumbleweed rpm"
}

###############################################################################
# Validate <channel> argument
###############################################################################
CHANNEL="release" # Default
case $1 in
release)
    CHANNEL='release'
    ;;
beta)
    CHANNEL='beta'
    ;;
*)
    echo "Error: unsupported <channel> $1."
    echo
    usage
    exit 1
    ;;
esac

###############################################################################
# Validate <flavor> argument
###############################################################################
FLAVOR='ppa' # Default ppa
case $3 in
ppa)
    FLAVOR='ppa'
    ;;
deb)
    FLAVOR='deb'
    ;;
rpm)
    FLAVOR='rpm'
    ;;
aur)
    FLAVOR='aur'
    ;;
*)
    echo "Error: unsupported <flavor> $3."
    echo
    usage
    exit 1
    ;;
esac

###############################################################################
# Validate <os> argument
###############################################################################

assert_flavor_is_deb_or_ppa() {
  if [ "${FLAVOR}" != 'deb' ] && [ "${FLAVOR}" != 'ppa' ] ; then
    echo '<flavor> must be either ppa or deb'
    exit 1
  fi
}

assert_flavor_is_ppa() {
  if [ "${FLAVOR}" != 'ppa' ] ; then
    echo '<flavor> must be ppa'
    exit 1
  fi
}

assert_flavor_is_deb() {
  if [ "${FLAVOR}" != 'deb' ] ; then
    echo '<flavor> must be deb'
    exit 1
  fi
}

assert_flavor_is_rpm() {
  if [ "${FLAVOR}" != 'rpm' ] ; then
    echo '<flavor> must be rpm'
    exit 1
  fi
}

assert_flavor_is_aur() {
  if [ "${FLAVOR}" != 'aur' ] ; then
    echo '<flavor> must be aur'
    exit 1
  fi
}

# https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Linux_compatibility_matrix
OS='ubuntu:18.04' # Default to latest LTS
case $2 in
ubuntu)
    assert_flavor_is_deb_or_ppa
    OS="ubuntu:latest"
    ;;
ubuntu:16.04)
    assert_flavor_is_deb_or_ppa
    OS="ubuntu:16.04"
    ;;
ubuntu:18.04)
    assert_flavor_is_deb_or_ppa
    OS="ubuntu:18.04"
    ;;
ubuntu:19.04)
    assert_flavor_is_deb_or_ppa
    OS="ubuntu:19.04"
    ;;
ubuntu:19.10)
    assert_flavor_is_deb_or_ppa
    OS="ubuntu:19.10"
    ;;
debian)
    assert_flavor_is_deb_or_ppa
    OS="debian:latest"
    ;;
debian:10)
    assert_flavor_is_deb_or_ppa
    OS="debian:10"
    ;;
debian:buster)
    assert_flavor_is_deb_or_ppa
    OS="debian:10"
    ;;
opensuse)
    assert_flavor_is_rpm
    OS="opensuse/tumbleweed"
    FLAVOR="rpm_zypper"
    ;;
opensuse:15)
    assert_flavor_is_rpm
    OS="opensuse/leap"
    FLAVOR="rpm_zypper"
    ;;
opensuse:leap)
    assert_flavor_is_rpm
    OS="opensuse/leap"
    FLAVOR="rpm_zypper"
    ;;
opensuse:16)
    assert_flavor_is_rpm
    OS="opensuse/tumbleweed"
    FLAVOR="rpm_zypper"
    ;;
opensuse:tumbleweed)
    assert_flavor_is_rpm
    OS="opensuse/tumbleweed"
    FLAVOR="rpm_zypper"
    ;;
fedora)
    assert_flavor_is_rpm
    OS="fedora:latest"
    FLAVOR="rpm_yum"
    ;;
fedora:28)
    assert_flavor_is_rpm
    OS="fedora:28"
    FLAVOR="rpm_yum"
    ;;
fedora:29)
    assert_flavor_is_rpm
    OS="fedora:29"
    FLAVOR="rpm_yum"
    ;;
fedora:30)
    assert_flavor_is_rpm
    OS="fedora:30"
    FLAVOR="rpm_yum"
    ;;
fedora:31)
    assert_flavor_is_rpm
    OS="fedora:31"
    FLAVOR="rpm_yum"
    ;;
centos)
    assert_flavor_is_rpm
    OS="centos:latest"
    FLAVOR="rpm_yum"
    ;;
centos:8)
    assert_flavor_is_rpm
    OS="centos:8"
    FLAVOR="rpm_yum"
    ;;
archlinux)
    assert_flavor_is_aur
    OS="archlinux:latest"
    ;;
*)
    echo "Error: unsupported base image $2."
    echo
    usage
    exit 1
    ;;
esac

###############################################################################
# Build Dockerfile
###############################################################################

# Get latest version of Cliqz beta
BETA_VERSION=''
fetch_beta_version() {
  if [ "${BETA_VERSION}" = '' ] ; then
    BETA_VERSION=$(
      curl --silent 'https://s3.amazonaws.com/repository.cliqz.com?delimiter=/&prefix=dist/beta/' \
          | grep -oP '1[.]\d{2}[.]\d' \
          | sort \
          | tail -n 1
    )
  fi
}

# Get latest build ID for Cliqz beta
BETA_BUILD=''
fetch_beta_build() {
  if [ "${BETA_BUILD}" = '' ] ; then
    fetch_beta_version
    BETA_BUILD=$(curl --silent "https://s3.amazonaws.com/repository.cliqz.com/dist/beta/${BETA_VERSION}/lastbuildid")
  fi
}

# Get latest build base URL
BETA_URL=''
get_beta_base_url() {
  if [ "${BETA_URL}" = '' ] ; then
    fetch_beta_version
    fetch_beta_build
    BETA_URL="https://s3.amazonaws.com/repository.cliqz.com/dist/beta/${BETA_VERSION}/${BETA_BUILD}/cliqz-${BETA_VERSION}-beta.${BETA_BUILD}.x86_64"
  fi
}

# Get URL of latest beta build's DEB
BETA_DEB=''
get_beta_deb() {
  if [ "${BETA_DEB}" = '' ] ; then
    get_beta_base_url
    BETA_DEB="${BETA_URL}.deb"
  fi
}

# Get URL of latest beta build's RPM
BETA_RPM=''
get_beta_rpm() {
  if [ "${BETA_RPM}" = '' ] ; then
    get_beta_base_url
    BETA_RPM="${BETA_URL}.rpm"
  fi
}

# Get URLs of stable .deb and .rpm builds
RELEASE_URL="https://cdn.cliqz.com/browser-f/download/linux/cliqz.en-US.release.x86_64"
RELEASE_RPM="${RELEASE_URL}.rpm"
RELEASE_DEB="${RELEASE_URL}.deb"

docker_ppa_prerequisites() {
cat << EOF >> Dockerfile.tmp
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install --no-install-recommends --yes \
    apt-transport-https \
    apt-utils \
    ca-certificates \
    dirmngr \
    gnupg2
EOF
}

docker_ppa_release() {
docker_ppa_prerequisites
cat << EOF >> Dockerfile.tmp
# Install Cliqz
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 4E0C443A \
 && echo deb http://repository.cliqz.com/dist/debian-release stable main | tee /etc/apt/sources.list.d/cliqz.list \
 && apt-get update \
 && apt-get install --no-install-recommends --yes cliqz
EOF
}

docker_ppa_beta() {
docker_ppa_prerequisites
cat << EOF >> Dockerfile.tmp
# Install Cliqz
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 3B8AF70A \
 && echo deb http://repository.cliqz.com/dist/debian-beta stable main | tee /etc/apt/sources.list.d/cliqz.list \
 && apt-get update \
 && apt-get install --no-install-recommends --yes cliqz
EOF
}

docker_deb_prerequisites() {
cat << EOF >> Dockerfile.tmp
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install --yes wget gdebi-core
EOF
}

docker_deb_release() {
docker_deb_prerequisites
cat << EOF >> Dockerfile.tmp
RUN wget -O cliqz.deb ${RELEASE_DEB} \
 && gdebi --non-interactive cliqz.deb \
 && rm cliqz.deb
EOF
}

docker_deb_beta() {
get_beta_deb
docker_deb_prerequisites
cat << EOF >> Dockerfile.tmp
RUN wget -O cliqz.deb ${BETA_DEB} \
 && gdebi --non-interactive cliqz.deb \
 && rm cliqz.deb
EOF
}

docker_rpm_zypper_prerequisites() {
cat << EOF >> Dockerfile.tmp
RUN zypper --non-interactive install wget lato-fonts
EOF
}

docker_rpm_zypper_release() {
docker_rpm_zypper_prerequisites
cat << EOF >> Dockerfile.tmp
RUN wget -O cliqz.rpm ${RELEASE_RPM} \
 && zypper --non-interactive install --allow-unsigned-rpm cliqz.rpm \
 && rm cliqz.rpm
EOF
}

docker_rpm_zypper_beta() {
docker_rpm_zypper_prerequisites
get_beta_rpm
cat << EOF >> Dockerfile.tmp
RUN wget -O cliqz.rpm ${BETA_RPM} \
 && zypper --non-interactive install --allow-unsigned-rpm cliqz.rpm \
 && rm cliqz.rpm
EOF
}

docker_rpm_yum_prerequisites() {
cat << EOF >> Dockerfile.tmp
RUN yum install -y wget lato-fonts
EOF
}

docker_rpm_yum_release() {
docker_rpm_yum_prerequisites
cat << EOF >> Dockerfile.tmp
RUN wget -O cliqz.rpm ${RELEASE_RPM} \
 && yum install -y --nogpgcheck cliqz.rpm \
 && rm cliqz.rpm
EOF
}

docker_rpm_yum_beta() {
docker_rpm_yum_prerequisites
get_beta_rpm
cat << EOF >> Dockerfile.tmp
RUN wget -O cliqz.rpm ${BETA_RPM} \
 && yum install -y --nogpgcheck cliqz.rpm \
 && rm cliqz.rpm
EOF
}

docker_aur_release() {
cat << EOF >> Dockerfile.tmp
# Update packages index and select fast mirrors.
RUN pacman -Syu --noconfirm
RUN pacman -S --noconfirm pacman-contrib
RUN cp /etc/pacman.d/mirrorlist /etc/pacman.d/mirrorlist.OLD \
 && rankmirrors -n 3 /etc/pacman.d/mirrorlist.OLD > /etc/pacman.d/mirrorlist

# Prepare buiding 'cliqz-bin' AUR package.
RUN pacman -S --noconfirm fakeroot binutils sudo git
RUN echo "cliqz ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers
USER cliqz
WORKDIR /home/cliqz

# Build and install 'cliqz-bin'
RUN git clone https://aur.archlinux.org/cliqz-bin.git \
 && cd cliqz-bin \
 && makepkg --syncdeps --noconfirm
EOF
}

# 0. Create temporary folder
TMP_DIR=$(mktemp -d)
cd "${TMP_DIR}"
echo "Temporary working dir: ${TMP_DIR}"
trap '/bin/rm -rf "${TMP_DIR}"' EXIT INT TERM

# 1. Base image
cat << EOF >> Dockerfile.tmp
FROM ${OS}
RUN useradd --create-home cliqz
EOF

# 2. Install: ppa, deb, or rpm
case "${FLAVOR}_${CHANNEL}" in
ppa_release)
    docker_ppa_release
    ;;
ppa_beta)
    docker_ppa_beta
    ;;
deb_release)
    docker_deb_release
    ;;
deb_beta)
    docker_deb_beta
    ;;
rpm_zypper_release)
    docker_rpm_zypper_release
    ;;
rpm_zypper_beta)
    docker_rpm_zypper_beta
    ;;
rpm_yum_release)
    docker_rpm_yum_release
    ;;
rpm_yum_beta)
    docker_rpm_yum_beta
    ;;
aur_release)
    docker_aur_release
    ;;
aur_beta)
    echo "No beta channel available on ArchLinux"
    exit 1
    ;;
*)
    echo "Internal error, unexpected value of 'FLAVOR' ${FLAVOR}"
    exit 1
    ;;
esac

# 3. Create user
cat << EOF >> Dockerfile.tmp
USER cliqz
WORKDIR /home/cliqz
EOF

# 4. Build image
docker build -t browser-f-test -f Dockerfile.tmp .

# 5. Start Cliqz!
docker run \
    -it \
    --rm \
    -e DISPLAY="${DISPLAY}" \
    -v /dev/shm:/dev/shm \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    browser-f-test cliqz --no-remote
