import os

config = {
    'default_actions': [
        'clobber',
        'clone-tools',
        'checkout-sources',
        'setup-mock',
        'build',
        'upload-files',
        'sendchange',
        'check-test',
        # 'update',
    ],
    'stage_platform': 'linux64-asan',
    'publish_nightly_en_US_routes': False,
    'build_type': 'asan',
    'platform_supports_post_upload_to_latest': False,
    'enable_signing': False,
    'enable_talos_sendchange': False,
    #### 64 bit build specific #####
    'env': {
        'MOZBUILD_STATE_PATH': os.path.join(os.getcwd(), '.mozbuild'),
        'DISPLAY': ':2',
        'HG_SHARE_BASE_DIR': '/builds/hg-shared',
        'MOZ_OBJDIR': '%(abs_obj_dir)s',
        'TINDERBOX_OUTPUT': '1',
        'TOOLTOOL_CACHE': '/builds/tooltool_cache',
        'TOOLTOOL_HOME': '/builds',
        'MOZ_CRASHREPORTER_NO_REPORT': '1',
        'CCACHE_DIR': '/builds/ccache',
        'CCACHE_COMPRESS': '1',
        'CCACHE_UMASK': '002',
        'LC_ALL': 'C',
        ## 64 bit specific
        'PATH': '/usr/local/bin:/usr/lib64/ccache:/bin:\
/usr/bin:/usr/local/sbin:/usr/sbin:/sbin:/tools/git/bin:/tools/python27/bin:\
/tools/python27-mercurial/bin:/home/cltbld/bin',
    },
    'mozconfig_variant': 'nightly-asan',
    #######################
}
