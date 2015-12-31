#!/bin/bash
set -e
eval `ssh-agent`
ssh-add ~/.ssh/ffxbld_rsa
trap "ssh-agent -k" EXIT

SCRIPTS_DIR="$(dirname $0)/../.."

# Call the Python 2.7 package in Win64 machines.
if [ "$OS" = "Windows_NT" ] && [ -e "/c/mozilla-build/python27/python.exe" ]; then
    PYBIN="/c/mozilla-build/python27/python.exe"
    GITBIN="/c/mozilla-build/Git/bin/git.exe"
elif [ "$TERM" = "linux" ] && [ -e "/usr/local/bin/python2.7" ]; then
    PYBIN="/usr/local/bin/python2.7"
    GITBIN="git"
else
    PYBIN="python"
    GITBIN="git"
fi

# Make sure required env vars are set.
if [ "$GIT_FUNFUZZ_REPO" == "" ]; then
    echo "GIT_FUNFUZZ_REPO not set."
exit 11
fi
if [ "$GIT_LITHIUM_REPO" == "" ]; then
    echo "GIT_LITHIUM_REPO not set."
exit 12
fi
if [ "$GIT_FUNFUZZ_PRIVATE_REPO" == "" ]; then
    echo "GIT_FUNFUZZ_PRIVATE_REPO not set."
exit 13
fi
if [ "$GIT_FUZZMANAGER_REPO" == "" ]; then
    echo "GIT_FUZZMANAGER_REPO not set."
exit 14
fi
REPO_NAME="funfuzz"
# We need to wrap our git operation for private repos in a shell script so
# we can set things like the user (gitolite3). We use GIT_PRIVATE_SSH to
# point to this script
GIT_PRIVATE_SSH=./git_private_ssh.bash
echo -e '#!/bin/bash\nssh -l gitolite3 $1 $2' > $GIT_PRIVATE_SSH
chmod 755 $GIT_PRIVATE_SSH
rm -rf $REPO_NAME lithium FuzzManager funfuzz-private
$GITBIN clone $GIT_FUNFUZZ_REPO $REPO_NAME
$GITBIN clone $GIT_LITHIUM_REPO lithium
$GITBIN clone $GIT_FUZZMANAGER_REPO FuzzManager
GIT_SSH=$GIT_PRIVATE_SSH $GITBIN clone $GIT_FUNFUZZ_PRIVATE_REPO funfuzz-private

$PYBIN $REPO_NAME/bot.py --remote-host "$FUZZ_REMOTE_HOST" --basedir "$FUZZ_BASE_DIR"
