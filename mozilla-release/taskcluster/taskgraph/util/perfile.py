# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import, print_function, unicode_literals

import logging
import math

from mozbuild.util import memoize
from mozpack.path import match as mozpackmatch
from mozversioncontrol import get_repository_object, InvalidRepoPath
from subprocess import CalledProcessError
from taskgraph import files_changed
from .. import GECKO

logger = logging.getLogger(__name__)


@memoize
def perfile_number_of_chunks(try_task_config, head_repository, head_rev, type):
    tests_per_chunk = 10.0
    if type.startswith('test-coverage'):
        tests_per_chunk = 30.0

    if type.startswith('test-verify-wpt') or type.startswith('test-coverage-wpt'):
        file_patterns = ['testing/web-platform/tests/**',
                         'testing/web-platform/mozilla/tests/**']
    elif type.startswith('test-verify-gpu') or type.startswith('test-coverage-gpu'):
        file_patterns = ['**/*webgl*/**/test_*',
                         '**/dom/canvas/**/test_*',
                         '**/gfx/tests/**/test_*',
                         '**/devtools/canvasdebugger/**/browser_*',
                         '**/reftest*/**']
    elif type.startswith('test-verify') or type.startswith('test-coverage'):
        file_patterns = ['**/test_*',
                         '**/browser_*',
                         '**/crashtest*/**',
                         'js/src/test/test/**',
                         'js/src/test/non262/**',
                         'js/src/test/test262/**']
    else:
        # Returning 0 means no tests to run, this captures non test-verify tasks
        return 1

    changed_files = set()
    specified_files = []
    if try_task_config:
        specified_files = try_task_config.split(":")

    try:
        vcs = get_repository_object(GECKO)
        changed_files.update(vcs.get_outgoing_files('AM'))
    except InvalidRepoPath:
        vcs = None
    except CalledProcessError:
        return 0

    if not changed_files:
        changed_files.update(files_changed.get_changed_files(head_repository,
                                                             head_rev))

    changed_files.update(specified_files)
    test_count = 0
    for pattern in file_patterns:
        for path in changed_files:
            # TODO: consider running tests if a manifest changes
            if path.endswith('.list') or path.endswith('.ini'):
                continue

            if mozpackmatch(path, pattern):
                gpu = False
                if type == 'test-verify-e10s' or type == 'test-coverage-e10s':
                    # file_patterns for test-verify will pick up some gpu tests, lets ignore
                    # in the case of reftest, we will not have any in the regular case
                    gpu_dirs = ['dom/canvas', 'gfx/tests', 'devtools/canvasdebugger', 'webgl']
                    for gdir in gpu_dirs:
                        if len(path.split(gdir)) > 1:
                            gpu = True

                if not gpu:
                    test_count += 1

    chunks = test_count/tests_per_chunk
    return int(math.ceil(chunks))
