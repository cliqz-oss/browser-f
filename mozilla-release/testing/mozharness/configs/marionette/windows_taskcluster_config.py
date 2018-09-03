# This is a template config file for marionette production on Windows.
import os
import sys

config = {
    # marionette options
    "marionette_address": "localhost:2828",
    "test_manifest": "unit-tests.ini",

    "virtualenv_path": 'venv',
    "exes": {
        'python': sys.executable,
        'hg': os.path.join(os.environ['PROGRAMFILES'], 'Mercurial', 'hg')
    },

    "default_actions": [
        'clobber',
        'download-and-extract',
        'create-virtualenv',
        'install',
        'run-tests',
    ],
    "download_minidump_stackwalk": True,
    "download_symbols": "ondemand",
    "suite_definitions": {
        "marionette_desktop": {
            "options": [
                "-vv",
                "--log-raw=%(raw_log_file)s",
                "--log-errorsummary=%(error_summary_file)s",
                "--log-html=%(html_report_file)s",
                "--binary=%(binary)s",
                "--address=%(address)s",
                "--symbols-path=%(symbols_path)s"
            ],
            "run_filename": "",
            "testsdir": "marionette"
        },
    },
}
