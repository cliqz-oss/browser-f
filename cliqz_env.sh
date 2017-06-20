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

# by default use beta update channel, except Release
export MOZ_UPDATE_CHANNEL=beta
if [ "$CQZ_RELEASE_CHANNEL" = "release" ]; then
  export MOZ_UPDATE_CHANNEL=release
  # turn on PGO only for Release Windows build
  if [ $IS_WIN ]; then
    if [ $CQZ_BUILD_ID ]; then
      export MOZ_PGO=1 # release build optimization flag
    fi
  fi
fi

export MOZ_OBJDIR=../obj

export MOZCONFIG=browser/config/cliqz-release.mozconfig
export CQZ_VERSION=$(cat ./mozilla-release/browser/config/version_display.txt)
export MOZ_AUTOMATION_UPLOAD=1  # TODO: remove, duplicates cliqz.mozconfig
export CQZ_BALROG_DOMAIN=balrog-admin.10e99.net
export BALROG_PATH=../build-tools/scripts/updates
export S3_BUCKET=repository.cliqz.com
export S3_BUCKET_SERVICE=cliqz-browser-data
# this condition only for transaction period between old and new build system
if [ -z $CQZ_BUILD_ID ]; then
  export S3_UPLOAD_PATH=`echo dist/pr/$CQZ_RELEASE_CHANNEL`
else
  # set path on S3 with BUILD_ID. From this path we take *.xpi and upload
  # build artifacts back (to locale folder, same as FF)
  export S3_UPLOAD_PATH=`echo dist/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID`
  if [ "$CQZ_RELEASE_CHANNEL" = "release" ]; then
    # upload symbols only for release build
    export S3_UPLOAD_PATH_SERVICE=`echo cliqzfox/buildsymbols/$CQZ_RELEASE_CHANNEL/$CQZ_VERSION/$CQZ_BUILD_ID`
  fi
  # set our own BUILD_ID in new build system, must be specified in format %Y%m%d%H%M%S
  export MOZ_BUILD_DATE=$CQZ_BUILD_ID
fi

OBJ_DIR=$MOZ_OBJDIR
SRC_BASE=mozilla-release

# automatic forget tab - start
wget -O adult-domains.bin https://s3.amazonaws.com/cdn.cliqz.com/browser-f/APT/adult-domains.bin
export CQZ_AUTO_PRIVATE_TAB=1
export CQZ_ADULT_DOMAINS_BF=../adult-domains.bin
# automatic forget tab - end

ROOT_PATH=$PWD
