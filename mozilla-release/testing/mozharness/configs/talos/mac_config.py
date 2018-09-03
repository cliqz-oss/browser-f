ENABLE_SCREEN_RESOLUTION_CHECK = True

SCREEN_RESOLUTION_CHECK = {
    "name": "check_screen_resolution",
    "cmd": ["bash", "-c", "screenresolution get && screenresolution list && system_profiler SPDisplaysDataType"],
    "architectures": ["32bit", "64bit"],
    "halt_on_failure": False,
    "enabled": ENABLE_SCREEN_RESOLUTION_CHECK
}

import os

VENV_PATH = '%s/build/venv' % os.getcwd()

config = {
    "log_name": "talos",
    "installer_path": "installer.exe",
    "virtualenv_path": VENV_PATH,
    "title": os.uname()[1].lower().split('.')[0],
    "default_actions": [
        "clobber",
        "download-and-extract",
        "populate-webroot",
        "create-virtualenv",
        "install",
        "setup-mitmproxy",
        "run-tests",
    ],
    "run_cmd_checks_enabled": True,
    "preflight_run_cmd_suites": [
        SCREEN_RESOLUTION_CHECK,
    ],
    "postflight_run_cmd_suites": [
        SCREEN_RESOLUTION_CHECK,
    ],
    "download_minidump_stackwalk": True,
    "minidump_stackwalk_path": "macosx64-minidump_stackwalk",
    "minidump_tooltool_manifest_path": "config/tooltool-manifests/macosx64/releng.manifest",
    "tooltool_cache": "/builds/tooltool_cache",
}
