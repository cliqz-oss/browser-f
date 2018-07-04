config = {
    # mozconfig file to use, it depends on branch and platform names
    "platform": "macosx64",
    "app_name": "browser",
    "mozconfig_platform": "macosx64",
    "mozconfig_variant": "l10n-mozconfig-devedition",
    "log_name": "single_locale",
    "objdir": "obj-firefox",
    "vcs_share_base": "/builds/hg-shared",

    "upload_env_extra": {
        "MOZ_PKG_PLATFORM": "mac",
    },

    # l10n
    "ignore_locales": ["en-US", "ja"],
    "l10n_dir": "l10n",
    "locales_file": "src/browser/locales/all-locales",
    "locales_dir": "browser/locales",
    "hg_l10n_tag": "default",

    # MAR
    "application_ini": "Contents/Resources/application.ini",
    "local_mar_tool_dir": "dist/host/bin",
    "mar": "mar",
    "mbsdiff": "mbsdiff",

    "update_channel": "aurora",
}
