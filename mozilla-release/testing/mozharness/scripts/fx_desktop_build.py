#!/usr/bin/env python
# ***** BEGIN LICENSE BLOCK *****
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
# ***** END LICENSE BLOCK *****
"""fx_desktop_build.py.

script harness to build nightly firefox within Mozilla's build environment
and developer machines alike

author: Jordan Lund

"""

import copy
import pprint
import sys
import os

# load modules from parent dir
sys.path.insert(1, os.path.dirname(sys.path[0]))

import mozharness.base.script as script
from mozharness.mozilla.building.buildbase import BUILD_BASE_CONFIG_OPTIONS, \
    BuildingConfig, BuildOptionParser, BuildScript
from mozharness.base.config import parse_config_file
from mozharness.mozilla.testing.try_tools import TryToolsMixin, try_config_options


class FxDesktopBuild(BuildScript, TryToolsMixin, object):
    def __init__(self):
        buildscript_kwargs = {
            'config_options': BUILD_BASE_CONFIG_OPTIONS + copy.deepcopy(try_config_options),
            'all_actions': [
                'get-secrets',
                'clobber',
                'build',
                'static-analysis-autotest',
                'check-test',
                'valgrind-test',
                'multi-l10n',
                'package-source',
                'update',
                'ensure-upload-path',
            ],
            'require_config_file': True,
            # Default configuration
            'config': {
                'is_automation': True,
                "pgo_build": False,
                "debug_build": False,
                "pgo_platforms": ['linux', 'linux64', 'win32', 'win64'],
                # nightly stuff
                "nightly_build": False,
                # hg tool stuff
                "tools_repo": "https://hg.mozilla.org/build/tools",
                # Seed all clones with mozilla-unified. This ensures subsequent
                # jobs have a minimal `hg pull`.
                "clone_upstream_url": "https://hg.mozilla.org/mozilla-unified",
                "repo_base": "https://hg.mozilla.org",
                'tooltool_url': 'https://tooltool.mozilla-releng.net/',
                "graph_selector": "/server/collect.cgi",
                # only used for make uploadsymbols
                'old_packages': [
                    "%(objdir)s/dist/firefox-*",
                    "%(objdir)s/dist/fennec*",
                    "%(objdir)s/dist/seamonkey*",
                    "%(objdir)s/dist/thunderbird*",
                    "%(objdir)s/dist/install/sea/*.exe"
                ],
                'build_resources_path': '%(abs_obj_dir)s/.mozbuild/build_resources.json',
                'nightly_promotion_branches': ['mozilla-central', 'mozilla-aurora'],

                # try will overwrite these
                'clone_with_purge': False,
                'clone_by_revision': False,

                'virtualenv_modules': [
                    'requests==2.8.1',
                ],
                'virtualenv_path': 'venv',
                #

            },
            'ConfigClass': BuildingConfig,
        }
        super(FxDesktopBuild, self).__init__(**buildscript_kwargs)

    def _pre_config_lock(self, rw_config):
        """grab properties if we are running this in automation"""
        super(FxDesktopBuild, self)._pre_config_lock(rw_config)
        c = self.config
        if self.try_message_has_flag('artifact') or os.environ.get('USE_ARTIFACT'):
            # Not all jobs that look like builds can be made into artifact
            # builds (for example, various SAN builds will not make sense as
            # artifact builds).  By default, only a vanilla debug or opt build
            # will be replaced by an artifact build.
            #
            # In addition, some jobs want to specify their artifact equivalent.
            # Use `artifact_flag_build_variant_in_try` to specify that variant.
            #
            # This is temporary, until we find a way to introduce an "artifact
            # build dimension" like "opt"/"debug" into the CI configurations.
            self.info('Artifact build requested by try push.')

            variant = None

            if 'artifact_flag_build_variant_in_try' in c:
                variant = c['artifact_flag_build_variant_in_try']
                if not variant:
                    self.info('Build variant has falsy `artifact_flag_build_variant_in_try`; '
                              'ignoring artifact build request and performing original build.')
                    return
                self.info('Build variant has `artifact_build_variant_in_try`: "%s".' % variant)
            else:
                if not c.get('build_variant'):
                    if c.get('debug_build'):
                        variant = 'debug-artifact'
                    else:
                        variant = 'artifact'
                elif c.get('build_variant') in ['debug', 'cross-debug']:
                    variant = 'debug-artifact'

            if variant:
                self.info('Using artifact build variant "%s".' % variant)
                self._update_build_variant(rw_config, variant)

    # helpers
    def _update_build_variant(self, rw_config, variant='artifact'):
        """ Intended for use in _pre_config_lock """
        c = self.config
        variant_cfg_path, _ = BuildOptionParser.find_variant_cfg_path(
            '--custom-build-variant-cfg',
            variant,
            rw_config.config_parser
        )
        if not variant_cfg_path:
            self.fatal('Could not find appropriate config file for variant %s' % variant)
        # Update other parts of config to keep dump-config accurate
        # Only dump-config is affected because most config info is set during
        # initial parsing
        variant_cfg_dict = parse_config_file(variant_cfg_path)
        rw_config.all_cfg_files_and_dicts.append((variant_cfg_path, variant_cfg_dict))
        c.update({
            'build_variant': variant,
            'config_files': c['config_files'] + [variant_cfg_path]
        })

        self.info("Updating self.config with the following from {}:".format(variant_cfg_path))
        self.info(pprint.pformat(variant_cfg_dict))
        c.update(variant_cfg_dict)
        c['forced_artifact_build'] = True
        # Bug 1231320 adds MOZHARNESS_ACTIONS in TaskCluster tasks to override default_actions
        # We don't want that when forcing an artifact build.
        if rw_config.volatile_config['actions']:
            self.info("Updating volatile_config to include default_actions "
                      "from {}.".format(variant_cfg_path))
            # add default actions in correct order
            combined_actions = []
            for a in rw_config.all_actions:
                if a in c['default_actions'] or a in rw_config.volatile_config['actions']:
                    combined_actions.append(a)
            rw_config.volatile_config['actions'] = combined_actions
            self.info("Actions in volatile_config are now: {}".format(
                rw_config.volatile_config['actions'])
            )
        # replace rw_config as well to set actions as in BaseScript
        rw_config.set_config(c, overwrite=True)
        rw_config.update_actions()
        self.actions = tuple(rw_config.actions)
        self.all_actions = tuple(rw_config.all_actions)

    def query_abs_dirs(self):
        if self.abs_dirs:
            return self.abs_dirs
        c = self.config
        abs_dirs = super(FxDesktopBuild, self).query_abs_dirs()
        if not c.get('app_ini_path'):
            self.fatal('"app_ini_path" is needed in your config for this '
                       'script.')

        dirs = {
            # BuildFactories in factory.py refer to a 'build' dir on the slave.
            # This contains all the source code/objdir to compile.  However,
            # there is already a build dir in mozharness for every mh run. The
            # 'build' that factory refers to I named: 'src' so
            # there is a seperation in mh.  for example, rather than having
            # '{mozharness_repo}/build/build/', I have '{
            # mozharness_repo}/build/src/'
            'abs_src_dir': os.path.join(abs_dirs['abs_work_dir'],
                                        'src'),
            'abs_obj_dir': os.path.join(abs_dirs['abs_work_dir'],
                                        'src',
                                        self._query_objdir()),
            'abs_tools_dir': os.path.join(abs_dirs['abs_work_dir'], 'tools'),
            'abs_app_ini_path': c['app_ini_path'] % {
                'obj_dir': os.path.join(abs_dirs['abs_work_dir'],
                                        'src',
                                        self._query_objdir())
            },
        }
        abs_dirs.update(dirs)
        self.abs_dirs = abs_dirs
        return self.abs_dirs

        # Actions {{{2

    def set_extra_try_arguments(self, action, success=None):
        """ Override unneeded method from TryToolsMixin """
        pass

    @script.PreScriptRun
    def suppress_windows_modal_dialogs(self, *args, **kwargs):
        if self._is_windows():
            # Suppress Windows modal dialogs to avoid hangs
            import ctypes
            ctypes.windll.kernel32.SetErrorMode(0x8001)


if __name__ == '__main__':
    fx_desktop_build = FxDesktopBuild()
    fx_desktop_build.run_and_exit()
