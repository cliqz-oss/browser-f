# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, # You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import, unicode_literals

import sys
import os
import stat
import platform
import re

from mach.decorators import (
    CommandArgument,
    CommandProvider,
    Command,
)

from mozbuild.base import MachCommandBase, MozbuildObject


@CommandProvider
class SearchProvider(object):
    @Command('dxr', category='misc',
             description='Search for something in DXR.')
    @CommandArgument('term', nargs='+', help='Term(s) to search for.')
    def dxr(self, term):
        import webbrowser
        term = ' '.join(term)
        uri = 'http://dxr.mozilla.org/mozilla-central/search?q=%s&redirect=true' % term
        webbrowser.open_new_tab(uri)

    @Command('mdn', category='misc',
             description='Search for something on MDN.')
    @CommandArgument('term', nargs='+', help='Term(s) to search for.')
    def mdn(self, term):
        import webbrowser
        term = ' '.join(term)
        uri = 'https://developer.mozilla.org/search?q=%s' % term
        webbrowser.open_new_tab(uri)

    @Command('google', category='misc',
             description='Search for something on Google.')
    @CommandArgument('term', nargs='+', help='Term(s) to search for.')
    def google(self, term):
        import webbrowser
        term = ' '.join(term)
        uri = 'https://www.google.com/search?q=%s' % term
        webbrowser.open_new_tab(uri)

    @Command('search', category='misc',
             description='Search for something on the Internets. '
             'This will open 3 new browser tabs and search for the term on Google, '
             'MDN, and DXR.')
    @CommandArgument('term', nargs='+', help='Term(s) to search for.')
    def search(self, term):
        self.google(term)
        self.mdn(term)
        self.dxr(term)


@CommandProvider
class UUIDProvider(object):
    @Command('uuid', category='misc',
             description='Generate a uuid.')
    @CommandArgument('--format', '-f', choices=['idl', 'cpp', 'c++'],
                     help='Output format for the generated uuid.')
    def uuid(self, format=None):
        import uuid
        u = uuid.uuid4()
        if format in [None, 'idl']:
            print(u)
            if format is None:
                print('')
        if format in [None, 'cpp', 'c++']:
            u = u.hex
            print('{ 0x%s, 0x%s, 0x%s, \\' % (u[0:8], u[8:12], u[12:16]))
            pairs = tuple(map(lambda n: u[n:n+2], range(16, 32, 2)))
            print(('  { ' + '0x%s, ' * 7 + '0x%s } }') % pairs)


@CommandProvider
class PastebinProvider(object):
    @Command('pastebin', category='misc',
             description='Command line interface to pastebin.mozilla.org.')
    @CommandArgument('--language', default=None,
                     help='Language to use for syntax highlighting')
    @CommandArgument('--poster', default='',
                     help='Specify your name for use with pastebin.mozilla.org')
    @CommandArgument('--duration', default='day',
                     choices=['d', 'day', 'm', 'month', 'f', 'forever'],
                     help='Keep for specified duration (default: %(default)s)')
    @CommandArgument('file', nargs='?', default=None,
                     help='Specify the file to upload to pastebin.mozilla.org')
    def pastebin(self, language, poster, duration, file):
        import urllib
        import urllib2

        URL = 'https://pastebin.mozilla.org/'

        FILE_TYPES = [{'value': 'text', 'name': 'None', 'extension': 'txt'},
                      {'value': 'bash', 'name': 'Bash', 'extension': 'sh'},
                      {'value': 'c', 'name': 'C', 'extension': 'c'},
                      {'value': 'cpp', 'name': 'C++', 'extension': 'cpp'},
                      {'value': 'html4strict', 'name': 'HTML', 'extension': 'html'},
                      {'value': 'javascript', 'name': 'Javascript', 'extension': 'js'},
                      {'value': 'javascript', 'name': 'Javascript', 'extension': 'jsm'},
                      {'value': 'lua', 'name': 'Lua', 'extension': 'lua'},
                      {'value': 'perl', 'name': 'Perl', 'extension': 'pl'},
                      {'value': 'php', 'name': 'PHP', 'extension': 'php'},
                      {'value': 'python', 'name': 'Python', 'extension': 'py'},
                      {'value': 'ruby', 'name': 'Ruby', 'extension': 'rb'},
                      {'value': 'css', 'name': 'CSS', 'extension': 'css'},
                      {'value': 'diff', 'name': 'Diff', 'extension': 'diff'},
                      {'value': 'ini', 'name': 'INI file', 'extension': 'ini'},
                      {'value': 'java', 'name': 'Java', 'extension': 'java'},
                      {'value': 'xml', 'name': 'XML', 'extension': 'xml'},
                      {'value': 'xml', 'name': 'XML', 'extension': 'xul'}]

        lang = ''

        if file:
            try:
                with open(file, 'r') as f:
                    content = f.read()
                # TODO: Use mime-types instead of extensions; suprocess('file <f_name>')
                # Guess File-type based on file extension
                extension = file.split('.')[-1]
                for l in FILE_TYPES:
                    if extension == l['extension']:
                        print('Identified file as %s' % l['name'])
                        lang = l['value']
            except IOError:
                print('ERROR. No such file')
                return 1
        else:
            content = sys.stdin.read()
        duration = duration[0]

        if language:
            lang = language

        params = [
            ('parent_pid', ''),
            ('format', lang),
            ('code2', content),
            ('poster', poster),
            ('expiry', duration),
            ('paste', 'Send')]

        data = urllib.urlencode(params)
        print('Uploading ...')
        try:
            req = urllib2.Request(URL, data)
            response = urllib2.urlopen(req)
            http_response_code = response.getcode()
            if http_response_code == 200:
                print(response.geturl())
            else:
                print('Could not upload the file, '
                      'HTTP Response Code %s' % (http_response_code))
        except urllib2.URLError:
            print('ERROR. Could not connect to pastebin.mozilla.org.')
            return 1
        return 0


@CommandProvider
class FormatProvider(MachCommandBase):
    @Command('clang-format', category='misc',
             description='Run clang-format on current changes')
    @CommandArgument('--show', '-s', action='store_true', default=False,
                     help='Show diff output on instead of applying changes')
    @CommandArgument('--path', '-p', nargs='+', default=None,
                     help='Specify the path(s) to reformat')
    def clang_format(self, show, path):
        # Run clang-format or clang-format-diff on the local changes
        # or files/directories
        import urllib2

        plat = platform.system()
        fmt = plat.lower() + "/clang-format-5.0"
        fmt_diff = "clang-format-diff-5.0"

        if plat == "Windows":
            fmt += ".exe"
        else:
            arch = os.uname()[4]
            if (plat != "Linux" and plat != "Darwin") or arch != 'x86_64':
                print("Unsupported platform " + plat + "/" + arch +
                      ". Supported platforms are Windows/*, Linux/x86_64 and Darwin/x86_64")
                return 1

        if path is not None:
            path = self.conv_to_abspath(path)

        os.chdir(self.topsrcdir)
        self.prompt = True

        try:
            clang_format = self.locate_or_fetch(fmt)
            if not clang_format:
                return 1
            clang_format_diff = self.locate_or_fetch(fmt_diff, python_script=True)
            if not clang_format_diff:
                return 1

        except urllib2.HTTPError as e:
            print("HTTP error {0}: {1}".format(e.code, e.reason))
            return 1

        if path is None:
            return self.run_clang_format_diff(clang_format_diff, show)
        else:
            return self.run_clang_format_path(clang_format, show, path)

    def conv_to_abspath(self, paths):
        # Converts all the paths to absolute pathnames
        tmp_path = []
        for f in paths:
            tmp_path.append(os.path.abspath(f))
        return tmp_path

    def locate_or_fetch(self, root, python_script=False):
        # Download the clang-format binary & python clang-format-diff if doesn't
        # exists
        import urllib2
        import hashlib
        bin_sha = {
            "Windows": "5b6a236425abde1a04ff09e74d8fd0fee1d49e5a35e228b24d77366cab03e1141b8073eec1b36c43e265a80bee707baaa7f96856b4820cbb02069775e58a3f9d",  # noqa: E501
            "Linux": "64444efd9b6895447359a9f70d6781251e74d7881f993b5d81a19f8e6a8503f798d42506061fb9eb48729b7327c42a9d273c80dde18816a350fdbc020ebfa783",  # noqa: E501
            "Darwin": "d9b08e21c233426628e39dd49bbb9b4e43cccb9aeb78d043dec2bdf6b1eacafddd13488558d38dfa0a0d39946b03b72c58933f1f79d638c045353cf3f4ae0fa4",  # noqa: E501
            "python_script": "051b8c8932085616a775ef8b7b1384687db8f37660938f94e9389bf6dba6f6e244d2dc63d23e1d2bf8ab96c9bd5244faefc5218a1f90d5ec692698f0094a3238",  # noqa: E501
        }

        target = os.path.join(self._mach_context.state_dir, os.path.basename(root))

        if not os.path.exists(target):
            tooltool_url = "https://tooltool.mozilla-releng.net/sha512/"
            if self.prompt and raw_input("Download clang-format executables from {0} (yN)? ".format(tooltool_url)).lower() != 'y':  # noqa: E501,F821
                print("Download aborted.")
                return None
            self.prompt = False
            plat = platform.system()
            if python_script:
                # We want to download the python script (clang-format-diff)
                dl = bin_sha["python_script"]
            else:
                dl = bin_sha[plat]
            u = tooltool_url + dl
            print("Downloading {0} to {1}".format(u, target))
            data = urllib2.urlopen(url=u).read()
            temp = target + ".tmp"
            # Check that the checksum of the downloaded data matches the hash
            # of the file
            sha512Hash = hashlib.sha512(data).hexdigest()
            if sha512Hash != dl:
                print("Checksum verification for {0} failed: {1} found instead of {2} ".format(target, sha512Hash, dl))  # noqa: E501
                return 1
            with open(temp, "wb") as fh:
                fh.write(data)
                fh.close()
            os.chmod(temp, os.stat(temp).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            os.rename(temp, target)
        return target

    # List of file extension to consider (should start with dot)
    _format_include_extensions = ('.cpp', '.c', '.h')
    # File contaning all paths to exclude from formatting
    _format_ignore_file = '.clang-format-ignore'

    def _get_clang_format_diff_command(self):
        if self.repository.name == 'hg':
            args = ["hg", "diff", "-U0", "-r" ".^"]
            for dot_extension in self._format_include_extensions:
                args += ['--include', 'glob:**{0}'.format(dot_extension)]
            args += ['--exclude', 'listfile:{0}'.format(self._format_ignore_file)]
        else:
            args = ["git", "diff", "--no-color", "-U0", "HEAD", "--"]
            for dot_extension in self._format_include_extensions:
                args += ['*{0}'.format(dot_extension)]
            # git-diff doesn't support an 'exclude-from-files' param, but
            # allow to add individual exclude pattern since v1.9, see
            # https://git-scm.com/docs/gitglossary#gitglossary-aiddefpathspecapathspec
            with open(self._format_ignore_file, 'rb') as exclude_pattern_file:
                for pattern in exclude_pattern_file.readlines():
                    pattern = pattern.rstrip()
                    pattern = pattern.replace('.*', '**')
                    if not pattern or pattern.startswith('#'):
                        continue  # empty or comment
                    magics = ['exclude']
                    if pattern.startswith('^'):
                        magics += ['top']
                        pattern = pattern[1:]
                    args += [':({0}){1}'.format(','.join(magics), pattern)]
        return args

    def run_clang_format_diff(self, clang_format_diff, show):
        # Run clang-format on the diff
        # Note that this will potentially miss a lot things
        from subprocess import Popen, PIPE

        diff_process = Popen(self._get_clang_format_diff_command(), stdout=PIPE)
        args = [sys.executable, clang_format_diff, "-p1"]
        if not show:
            args.append("-i")
        cf_process = Popen(args, stdin=diff_process.stdout)
        return cf_process.communicate()[0]

    def is_ignored_path(self, ignored_dir_re, f):
        # Remove upto topsrcdir in pathname and match
        match_f = f.split(self.topsrcdir + '/', 1)
        match_f = match_f[1] if len(match_f) == 2 else match_f[0]
        return re.match(ignored_dir_re, match_f)

    def generate_path_list(self, paths):
        pathToThirdparty = os.path.join(self.topsrcdir, self._format_ignore_file)
        ignored_dir = []
        for line in open(pathToThirdparty):
            # Remove comments and empty lines
            if line.startswith('#') or len(line.strip()) == 0:
                continue
            # The regexp is to make sure we are managing relative paths
            ignored_dir.append("^[\./]*" + line.rstrip())

        # Generates the list of regexp
        ignored_dir_re = '(%s)' % '|'.join(ignored_dir)
        extensions = self._format_include_extensions

        path_list = []
        for f in paths:
            if self.is_ignored_path(ignored_dir_re, f):
                # Early exit if we have provided an ignored directory
                print("clang-format: Ignored third party code '{0}'".format(f))
                continue

            if os.path.isdir(f):
                # Processing a directory, generate the file list
                for folder, subs, files in os.walk(f):
                    subs.sort()
                    for filename in sorted(files):
                        f_in_dir = os.path.join(folder, filename)
                        if (f_in_dir.endswith(extensions)
                            and not self.is_ignored_path(ignored_dir_re, f_in_dir)):
                            # Supported extension and accepted path
                            path_list.append(f_in_dir)
            else:
                if f.endswith(extensions):
                    path_list.append(f)

        return path_list

    def run_clang_format_path(self, clang_format, show, paths):
        # Run clang-format on files or directories directly
        from subprocess import Popen

        args = [clang_format, "-i"]

        path_list = self.generate_path_list(paths)

        if path_list == []:
            return

        print("Processing %d file(s)..." % len(path_list))

        batchsize = 200

        for i in range(0, len(path_list), batchsize):
            l = path_list[i: (i + batchsize)]
            # Run clang-format on the list
            cf_process = Popen(args + l)
            # Wait until the process is over
            cf_process.communicate()[0]

        if show:
            # show the diff
            if self.repository.name == 'hg':
                cf_process = Popen(["hg", "diff"] + paths)
            else:
                assert self.repository.name == 'git'
                cf_process = Popen(["git", "diff"] + paths)
            cf_process.communicate()[0]


def mozregression_import():
    # Lazy loading of mozregression.
    # Note that only the mach_interface module should be used from this file.
    try:
        import mozregression.mach_interface
    except ImportError:
        return None
    return mozregression.mach_interface


def mozregression_create_parser():
    # Create the mozregression command line parser.
    # if mozregression is not installed, or not up to date, it will
    # first be installed.
    cmd = MozbuildObject.from_environment()
    cmd._activate_virtualenv()
    mozregression = mozregression_import()
    if not mozregression:
        # mozregression is not here at all, install it
        cmd.virtualenv_manager.install_pip_package('mozregression')
        print("mozregression was installed. please re-run your"
              " command. If you keep getting this message please "
              " manually run: 'pip install -U mozregression'.")
    else:
        # check if there is a new release available
        release = mozregression.new_release_on_pypi()
        if release:
            print(release)
            # there is one, so install it. Note that install_pip_package
            # does not work here, so just run pip directly.
            cmd.virtualenv_manager._run_pip([
                'install',
                'mozregression==%s' % release
            ])
            print("mozregression was updated to version %s. please"
                  " re-run your command." % release)
        else:
            # mozregression is up to date, return the parser.
            return mozregression.parser()
    # exit if we updated or installed mozregression because
    # we may have already imported mozregression and running it
    # as this may cause issues.
    sys.exit(0)


@CommandProvider
class MozregressionCommand(MachCommandBase):
    @Command('mozregression',
             category='misc',
             description=("Regression range finder for nightly"
                          " and inbound builds."),
             parser=mozregression_create_parser)
    def run(self, **options):
        self._activate_virtualenv()
        mozregression = mozregression_import()
        mozregression.run(options)
