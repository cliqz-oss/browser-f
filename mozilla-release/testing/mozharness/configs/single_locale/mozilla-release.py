import os

config = {
    "nightly_build": True,
    "branch": "mozilla-release",
    "update_channel": "release",

    # l10n
    "hg_l10n_base": "https://hg.mozilla.org/l10n-central",

    # mar
    "mar_tools_url": os.environ["MAR_TOOLS_URL"],

    # purge options
    'is_automation': True,
}
