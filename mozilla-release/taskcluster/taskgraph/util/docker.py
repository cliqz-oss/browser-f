# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import absolute_import, print_function, unicode_literals

import hashlib
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
import yaml

from mozbuild.util import memoize
from mozpack.files import GeneratedFile
from mozpack.archive import (
    create_tar_gz_from_files,
)
from .. import GECKO


IMAGE_DIR = os.path.join(GECKO, 'taskcluster', 'docker')


def docker_image(name, by_tag=False):
    '''
        Resolve in-tree prebuilt docker image to ``<registry>/<repository>@sha256:<digest>``,
        or ``<registry>/<repository>:<tag>`` if `by_tag` is `True`.
    '''
    try:
        with open(os.path.join(IMAGE_DIR, name, 'REGISTRY')) as f:
            registry = f.read().strip()
    except IOError:
        with open(os.path.join(IMAGE_DIR, 'REGISTRY')) as f:
            registry = f.read().strip()

    if not by_tag:
        hashfile = os.path.join(IMAGE_DIR, name, 'HASH')
        try:
            with open(hashfile) as f:
                return '{}/{}@{}'.format(registry, name, f.read().strip())
        except IOError:
            raise Exception('Failed to read HASH file {}'.format(hashfile))

    try:
        with open(os.path.join(IMAGE_DIR, name, 'VERSION')) as f:
            tag = f.read().strip()
    except IOError:
        tag = 'latest'
    return '{}/{}:{}'.format(registry, name, tag)


def generate_context_hash(topsrcdir, image_path, image_name, args=None):
    """Generates a sha256 hash for context directory used to build an image."""

    # It is a bit unfortunate we have to create a temp file here - it would
    # be nicer to use an in-memory buffer.
    fd, p = tempfile.mkstemp()
    os.close(fd)
    try:
        return create_context_tar(topsrcdir, image_path, p, image_name, args)
    finally:
        os.unlink(p)


def create_context_tar(topsrcdir, context_dir, out_path, prefix, args=None):
    """Create a context tarball.

    A directory ``context_dir`` containing a Dockerfile will be assembled into
    a gzipped tar file at ``out_path``. Files inside the archive will be
    prefixed by directory ``prefix``.

    We also scan the source Dockerfile for special syntax that influences
    context generation.

    If a line in the Dockerfile has the form ``# %include <path>``,
    the relative path specified on that line will be matched against
    files in the source repository and added to the context under the
    path ``topsrcdir/``. If an entry is a directory, we add all files
    under that directory.

    If a line in the Dockerfile has the form ``# %ARG <name>``, occurrences of
    the string ``$<name>`` in subsequent lines are replaced with the value
    found in the ``args`` argument. Exception: this doesn't apply to VOLUME
    definitions.

    Returns the SHA-256 hex digest of the created archive.
    """
    archive_files = {}
    replace = []

    for root, dirs, files in os.walk(context_dir):
        for f in files:
            source_path = os.path.join(root, f)
            rel = source_path[len(context_dir) + 1:]
            archive_path = os.path.join(prefix, rel)
            archive_files[archive_path] = source_path

    # Parse Dockerfile for special syntax of extra files to include.
    content = []
    with open(os.path.join(context_dir, 'Dockerfile'), 'rb') as fh:
        for line in fh:
            if line.startswith('# %ARG'):
                p = line[len('# %ARG '):].strip()
                if not args or p not in args:
                    raise Exception('missing argument: {}'.format(p))
                replace.append((re.compile(r'\${}\b'.format(p)),
                                args[p].encode('ascii')))
                continue

            for regexp, s in replace:
                line = re.sub(regexp, s, line)

            content.append(line)

            if not line.startswith('# %include'):
                continue

            p = line[len('# %include '):].strip()
            if os.path.isabs(p):
                raise Exception('extra include path cannot be absolute: %s' % p)

            fs_path = os.path.normpath(os.path.join(topsrcdir, p))
            # Check for filesystem traversal exploits.
            if not fs_path.startswith(topsrcdir):
                raise Exception('extra include path outside topsrcdir: %s' % p)

            if not os.path.exists(fs_path):
                raise Exception('extra include path does not exist: %s' % p)

            if os.path.isdir(fs_path):
                for root, dirs, files in os.walk(fs_path):
                    for f in files:
                        source_path = os.path.join(root, f)
                        rel = source_path[len(fs_path) + 1:]
                        archive_path = os.path.join(prefix, 'topsrcdir', p, rel)
                        archive_files[archive_path] = source_path
            else:
                archive_path = os.path.join(prefix, 'topsrcdir', p)
                archive_files[archive_path] = fs_path

    archive_files[os.path.join(prefix, 'Dockerfile')] = \
        GeneratedFile(b''.join(content))

    with open(out_path, 'wb') as fh:
        create_tar_gz_from_files(fh, archive_files, '%s.tar.gz' % prefix)

    h = hashlib.sha256()
    with open(out_path, 'rb') as fh:
        while True:
            data = fh.read(32768)
            if not data:
                break
            h.update(data)
    return h.hexdigest()


def build_from_context(docker_bin, context_path, prefix, tag=None):
    """Build a Docker image from a context archive.

    Given the path to a `docker` binary, a image build tar.gz (produced with
    ``create_context_tar()``, a prefix in that context containing files, and
    an optional ``tag`` for the produced image, build that Docker image.
    """
    d = tempfile.mkdtemp()
    try:
        with tarfile.open(context_path, 'r:gz') as tf:
            tf.extractall(d)

        # If we wanted to do post-processing of the Dockerfile, this is
        # where we'd do it.

        args = [
            docker_bin,
            'build',
            # Use --no-cache so we always get the latest package updates.
            '--no-cache',
        ]

        if tag:
            args.extend(['-t', tag])

        args.append('.')

        res = subprocess.call(args, cwd=os.path.join(d, prefix))
        if res:
            raise Exception('error building image')
    finally:
        shutil.rmtree(d)


@memoize
def image_paths():
    """Return a map of image name to paths containing their Dockerfile.
    """
    with open(os.path.join(GECKO, 'taskcluster', 'ci', 'docker-image',
                           'kind.yml')) as fh:
        config = yaml.load(fh)
        return {
            k: os.path.join(IMAGE_DIR, v.get('definition', k))
            for k, v in config['jobs'].items()
        }


def image_path(name):
    paths = image_paths()
    if name in paths:
        return paths[name]
    return os.path.join(IMAGE_DIR, name)


@memoize
def parse_volumes(image):
    """Parse VOLUME entries from a Dockerfile for an image."""
    volumes = set()

    path = image_path(image)

    with open(os.path.join(path, 'Dockerfile'), 'rb') as fh:
        for line in fh:
            line = line.strip()
            # We assume VOLUME definitions don't use %ARGS.
            if not line.startswith(b'VOLUME '):
                continue

            v = line.split(None, 1)[1]
            if v.startswith(b'['):
                raise ValueError('cannot parse array syntax for VOLUME; '
                                 'convert to multiple entries')

            volumes |= set(v.split())

    return volumes
