import os
from util.commands import run_cmd


def signFiles(files):
    for f in files:
        run_cmd(
            ['bash', '-c', os.environ['MOZ_SIGN_CMD'] + ' -f gpg "%s"' % f])
