config = {
    "nightly_build": True,
    "branch": "mozilla-beta",
    "en_us_binary_url": "http://ftp.mozilla.org/pub/mozilla.org/firefox/nightly/latest-mozilla-beta/",
    "update_channel": "aurora",  # devedition uses aurora based branding

    # l10n
    "hg_l10n_base": "https://hg.mozilla.org/l10n-central",

    # repositories
    "repos": [{
        "vcs": "hg",
        "repo": "https://hg.mozilla.org/build/tools",
        "branch": "default",
        "dest": "tools",
    }, {
        "vcs": "hg",
        "repo": "https://hg.mozilla.org/releases/mozilla-beta",
        "revision": "%(revision)s",
        "dest": "mozilla-beta",
        "clone_upstream_url": "https://hg.mozilla.org/mozilla-unified",
    }],
    # purge options
    'purge_minsize': 12,
    'is_automation': True,
}
