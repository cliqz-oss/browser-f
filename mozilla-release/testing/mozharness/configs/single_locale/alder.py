# This configuration uses mozilla-central binaries (en-US, localized complete
# mars) and urls but it generates 'alder' artifacts. With this setup, binaries
# generated on alder are NOT overwriting mozilla-central files.
# Using this configuration, on a successful build, artifacts will be uploaded
# here:
#
# * http://dev-stage01.srv.releng.scl3.mozilla.com/pub/mozilla.org/firefox/nightly/latest-alder-l10n/
#   (in staging environment)
# * https://ftp.mozilla.org/pub/firefox/nightly/latest-alder-l10n/
#   (in production environment)
#
# If you really want to have localized alder builds, use the use the following
# values:
# * "en_us_binary_url": "http://ftp.mozilla.org/pub/mozilla.org/firefox/tinderbox-builds/alder-%(platform)s/latest/",
# * "mar_tools_url": "http://ftp.mozilla.org/pub/mozilla.org/firefox/tinderbox-builds/alder-%(platform)s/latest/",
# * "repo": "https://hg.mozilla.org/projects/alder",
#

import os

config = {
    "nightly_build": True,
    "branch": "alder",
    "en_us_binary_url": "http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-mozilla-central/",
    "update_channel": "nightly",

    # l10n
    "hg_l10n_base": "https://hg.mozilla.org/l10n-central",

    # mar
    "mar_tools_url": os.environ.get(
        "MAR_TOOLS_URL",
        # Buildbot l10n fetches from ftp rather than setting an environ var
        "http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-mozilla-central/mar-tools/%(platform)s"
    ),

    # repositories
    "repos": [{
        "vcs": "hg",
        "repo": "https://hg.mozilla.org/build/tools",
        "branch": "default",
        "dest": "tools",
    }, {
        "vcs": "hg",
        "repo": "https://hg.mozilla.org/mozilla-central",
        "branch": "default",
        "dest": "alder",
    }],
    # purge options
    'is_automation': True,
}
