VERBOSE=false
CLOBBER=false

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

if [ $IS_WIN ]; then
  MAKE=mozmake
else
  MAKE=make
fi

if [ -z $CQZ_RELEASE_CHANNEL ]; then
  export MOZ_UPDATE_CHANNEL=beta
else
  export MOZ_UPDATE_CHANNEL=$CQZ_RELEASE_CHANNEL
  # turn on PGO only for release Windows build on new server
  if [ $IS_WIN ]; then
    if [ $CQZ_BUILD_ID ]; then
      if [ "$MOZ_UPDATE_CHANNEL" = "release" ]; then
        export MOZ_PGO=1 # release build optimization
      fi
    fi
  fi
fi

export MOZ_OBJDIR=../obj

# Mac specific paths
I386DIR=$MOZ_OBJDIR/i386
X86_64DIR=$MOZ_OBJDIR/x86_64

export MOZCONFIG=browser/config/cliqz-release.mozconfig
export CQZ_VERSION=$(awk -F "=" '/version/ {print $2}'\
  ./repack/distribution/distribution.ini | head -n1)
export MOZ_AUTOMATION_UPLOAD=1  # TODO: remove, duplicates cliqz.mozconfig
export CQZ_BALROG_DOMAIN=balrog-admin.10e99.net
export BALROG_PATH=../build-tools/scripts/updates
export S3_BUCKET=repository.cliqz.com
# this condition only for transaction period between old and new build system
if [ -z $CQZ_BUILD_ID ]; then
  export S3_UPLOAD_PATH=`echo dist/$MOZ_UPDATE_CHANNEL/$CQZ_VERSION`
else
  # set path on S3 with BUILD_ID. From this path we take *.xpi and upload
  # build artifacts back (to locale folder, same as FF)
  export S3_UPLOAD_PATH=`echo dist/$MOZ_UPDATE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID`
  # set our own BUILD_ID in new build system, must be specified in format %Y%m%d%H%M%S
  export MOZ_BUILD_DATE=$CQZ_BUILD_ID
fi

OBJ_DIR=$MOZ_OBJDIR
SRC_BASE=mozilla-release
if [ $IS_MAC_OS ]; then
  OBJ_DIR=$I386DIR
fi

# automatic forget tab - start
wget -O adult-domains.bin https://s3.amazonaws.com/cdn.cliqz.com/browser-f/APT/adult-domains.bin
export CQZ_AUTO_PRIVATE_TAB=1
export CQZ_ADULT_DOMAINS_BF=../adult-domains.bin
# automatic forget tab - end

ROOT_PATH=$PWD
