# ***** BEGIN LICENSE BLOCK *****
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
# ***** END LICENSE BLOCK *****
import os

config = {
    "options": [
        "--prefs-root=%(test_path)s/prefs",
        "--processes=1",
        "--config=%(test_path)s/wptrunner.ini",
        "--ca-cert-path=%(test_path)s/certs/cacert.pem",
        "--host-key-path=%(test_path)s/certs/web-platform.test.key",
        "--host-cert-path=%(test_path)s/certs/web-platform.test.pem",
        "--certutil-binary=%(test_install_path)s/bin/certutil",
    ],

    "exes": {
        'virtualenv': '/tools/virtualenv/bin/virtualenv',
        'tooltool.py': "/tools/tooltool.py",
    },

    "find_links": [
        "http://pypi.pvt.build.mozilla.org/pub",
        "http://pypi.pub.build.mozilla.org/pub",
    ],

    "pip_index": False,

    "buildbot_json_path": "buildprops.json",

    "default_blob_upload_servers": [
         "https://blobupload.elasticbeanstalk.com",
    ],

    "blob_uploader_auth_file" : os.path.join(os.getcwd(), "oauth.txt"),

    "download_minidump_stackwalk": True,

    "download_tooltool": True,

    # this would normally be in "exes", but "exes" is clobbered by remove_executables
    "geckodriver": "%(abs_test_bin_dir)s/geckodriver",

    "verify_category": "web-platform",
}

