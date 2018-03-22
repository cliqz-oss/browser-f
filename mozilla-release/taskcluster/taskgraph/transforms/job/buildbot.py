# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""

Support for running jobs via buildbot.

"""

from __future__ import absolute_import, print_function, unicode_literals
import slugid
from urlparse import urlparse

from taskgraph.util.schema import Schema, optionally_keyed_by, resolve_keyed_by
from taskgraph.util.scriptworker import get_release_config
from voluptuous import Optional, Required, Any

from taskgraph.transforms.job import run_job_using


buildbot_run_schema = Schema({
    Required('using'): 'buildbot',

    # the buildername to use for buildbot-bridge, will expand {branch} in name from
    # the current project.
    Required('buildername'): basestring,

    # the product to use
    Required('product'): Any('firefox', 'mobile', 'fennec', 'devedition', 'thunderbird'),

    Optional('channels'): optionally_keyed_by('project', basestring),

    Optional('release-promotion'): bool,

    Optional('release-eta'): basestring,
})


def _get_balrog_api_root(branch):
    if branch in ('mozilla-beta', 'mozilla-release') or branch.startswith('mozilla-esr'):
        return 'https://aus4-admin.mozilla.org/api'
    else:
        return 'https://balrog-admin.stage.mozaws.net/api'


def bb_release_worker(config, worker, run):
    # props
    release_props = get_release_config(config)
    repo_path = urlparse(config.params['head_repository']).path.lstrip('/')
    revision = config.params['head_rev']
    branch = config.params['project']
    product = run['product']

    release_props.update({
        'release_promotion': True,
        'repo_path': repo_path,
        'revision': revision,
    })

    if 'channels' in run:
        release_props['channels'] = run['channels']
        resolve_keyed_by(release_props, 'channels', 'channels', **config.params)

    if product in ('devedition', 'firefox'):
        release_props['balrog_api_root'] = _get_balrog_api_root(branch)

    if run.get('release-eta'):
        # TODO Use same property name when we move away from BuildBot
        release_props['schedule_at'] = run['release-eta']

    worker['properties'].update(release_props)
    # Setting script_repo_revision to the gecko revision doesn't work for
    # jobs that clone build/tools or other repos instead of gecko.
    if 'script_repo_revision' not in worker['properties']:
        worker['properties']['script_repo_revision'] = revision


def bb_ci_worker(config, worker):
    worker['properties'].update({
        'who': config.params['owner'],
        'upload_to_task_id': slugid.nice(),
    })


@run_job_using('buildbot-bridge', 'buildbot', schema=buildbot_run_schema)
def mozharness_on_buildbot_bridge(config, job, taskdesc):
    run = job['run']
    worker = taskdesc['worker']
    branch = config.params['project']
    product = run['product']

    buildername = run['buildername'].format(branch=branch)
    revision = config.params['head_rev']

    worker.update({
        'buildername': buildername,
        'sourcestamp': {
            'branch': branch,
            'repository': config.params['head_repository'],
            'revision': revision,
        },
    })
    worker.setdefault('properties', {})['product'] = product

    if run.get('release-promotion'):
        bb_release_worker(config, worker, run)
    else:
        bb_ci_worker(config, worker)
