config = {
    "branch": "jamun",
    "nightly_build": True,
    "update_channel": "beta",

    # l10n
    "hg_l10n_base": "https://hg.mozilla.org/l10n-central",

    # repositories
    # staging beta dev releases use jamun repo for now
    "repos": [{
        "vcs": "hg",
        "repo": "https://hg.mozilla.org/build/tools",
        "branch": "default",
        "dest": "tools",
    }, {
        "vcs": "hg",
        "repo": "https://hg.mozilla.org/projects/jamun",
        "branch": "%(revision)s",
        "dest": "jamun",
        "clone_upstream_url": "https://hg.mozilla.org/projects/jamun",
    }],
    # purge options
    'is_automation': True,
    'purge_minsize': 12,
}
