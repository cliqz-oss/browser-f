VERBOSE=false
CLOBBER=false
BUILD_DE=false
CQZ_BUILD_TESTS=false
CQZ_BUILD_SYMBOLS=false
CQZ_INJECT_LOGGING=false

if [ -z "$LANG" ]; then
  LANG='en-US'
fi

while [[ $# > 0 ]]
do
  key="$1"

  case $key in
    -lang|--language)
    LANG="$2"
    shift # Consume additional argument
    ;;

    -v|--verbose)
    VERBOSE=true
    ;;

    --clobber)
    CLOBBER=true
    ;;

    --de)
    BUILD_DE=true
    ;;

    --tests)
    CQZ_BUILD_TESTS=true
    ;;

    --symbols)
    CQZ_BUILD_SYMBOLS=true
    ;;

    *)
    echo "WARNING: Unknown option $key"
    ;;
  esac
  shift # Consume current argument
done

if [[ "$OSTYPE" == "linux-gnu" ]]; then
  IS_LINUX=true
  echo 'Linux OS detected'
elif [[ "$OSTYPE" == "darwin"* ]]; then
  IS_MAC_OS=true
  echo 'Mac OS detected'
elif [[ "$OSTYPE" == "cygwin" || "$OSTYPE" == "msys" ]]; then
  IS_WIN=true
  echo 'Windows OS detected'
else
  echo 'Unknow OS -`$OSTYPE`'
fi

# check if we are cross compiling
if [[ $IS_LINUX == "true" ]]; then
  if [[ "$CROSS_TARGET" == *"apple-darwin"* ]];then
    OSX_CROSS_BUILD=true
  fi
fi

if [ $IS_WIN ]; then
  MAKE=mozmake
else
  MAKE=make
fi

# by default use beta update channel, except Release
if [ -z $CQZ_RELEASE_CHANNEL ]; then
  export CQZ_RELEASE_CHANNEL=beta
fi
export MOZ_UPDATE_CHANNEL=beta

if [ "$CQZ_RELEASE_CHANNEL" == "release" ]; then
  export MOZ_UPDATE_CHANNEL=release
  # turn on PGO only for Release Windows build
  if [ $IS_WIN ]; then
    export MOZ_PGO=1 # release build optimization flag
  fi
fi

# specify update channel name, for now it is same for all builds
export ACCEPTED_MAR_CHANNEL_IDS=firefox-mozilla-release
export MAR_CHANNEL_ID=firefox-mozilla-release

export MOZ_OBJDIR=../obj
# Set proper mozconfig
if [ $IS_WIN ]; then
  if [ "$CQZ_BUILD_64BIT_WINDOWS" == "1" ]; then
    export MOZCONFIG=browser/config/cliqz-release-64.mozconfig
  else
    export MOZCONFIG=browser/config/cliqz-release-32.mozconfig
  fi
elif [ "$OSX_CROSS_BUILD" == "true" ]; then
  export MOZCONFIG=browser/config/cliqz-release-cross.mozconfig
else
  export MOZCONFIG=browser/config/cliqz.mozconfig
fi

export CQZ_VERSION=$(cat ./mozilla-release/browser/config/version_display.txt)
export S3_BUCKET=repository.cliqz.com
export S3_BUCKET_SERVICE=cliqz-browser-data

# check CQZ_BUILD_ID and try to obtain, if not specified
if [ -z $CQZ_BUILD_ID ]; then
  export CQZ_BUILD_ID="`wget -qO- https://$S3_BUCKET/dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/lastbuildid`"
fi

if [ -z $CQZ_BUILD_ID ]; then
  echo "CQZ_BUILD_ID not specified and can not be obtain from "$S3_BUCKET
  exit 1
fi

# set our own BUILD_ID in new build system, must be specified in format %Y%m%d%H%M%S
export MOZ_BUILD_DATE=$CQZ_BUILD_ID

# set path on S3 with BUILD_ID. From this path we take *.xpi and upload
# build artifacts back (to locale folder, same as FF)
export S3_UPLOAD_PATH=`echo dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$MOZ_BUILD_DATE`

# Generate buildsymbols for release and beta builds
if [ "$CQZ_RELEASE_CHANNEL" == "release" ] || [ "$CQZ_RELEASE_CHANNEL" == "beta" ] ; then
  export S3_UPLOAD_PATH_SERVICE=`echo cliqzfox/buildsymbols/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$MOZ_BUILD_DATE`
fi

OBJ_DIR=$MOZ_OBJDIR
SRC_BASE=mozilla-release

# automatic forget tab - start
wget -O mozilla-release/browser/adult-domains.bin https://s3.amazonaws.com/cdn.cliqz.com/browser-f/APT/adult-domains.bin
export CQZ_ADULT_DOMAINS_BF="adult-domains.bin"
# automatic forget tab - end

export ROOT_PATH=$PWD
export SHELL=$SHELL

if [ "$CQZ_RELEASE_CHANNEL" == "beta" ]; then
  CQZ_INJECT_LOGGING=true
fi
export CQZ_INJECT_LOGGING
