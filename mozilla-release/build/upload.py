#!/usr/bin/python
#
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
#
# When run directly, this script expects the following environment variables
# to be set:
# UPLOAD_PATH    : path on that host to put the files in
#
# Files are simply copied to UPLOAD_PATH.
#
# All files to be uploaded should be passed as commandline arguments to this
# script. The script takes one other parameter, --base-path, which you can use
# to indicate that files should be uploaded including their paths relative
# to the base path.

import sys
import os
import shutil
from optparse import OptionParser
from subprocess import (
    check_call,
    check_output,
    STDOUT,
    CalledProcessError,
)
import concurrent.futures as futures
import redo
import sys
import boto
import boto.s3
import boto.s3.key


def OptionalEnvironmentVariable(v):
    """Return the value of the environment variable named v, or None
    if it's unset (or empty)."""
    if v in os.environ and os.environ[v] != "":
        return os.environ[v]
    return None


def FixupMsysPath(path):
    """MSYS helpfully translates absolute pathnames in environment variables
    and commandline arguments into Windows native paths. This sucks if you're
    trying to pass an absolute path on a remote server. This function attempts
    to un-mangle such paths."""
    if 'OSTYPE' in os.environ and os.environ['OSTYPE'] == 'msys':
        # sort of awful, find out where our shell is (should be in msys/bin)
        # and strip the first part of that path out of the other path
        if 'SHELL' in os.environ:
            sh = os.environ['SHELL']
            msys = sh[:sh.find('/bin')]
            if path.startswith(msys):
                path = path[len(msys):]
    return path


def GetBaseRelativePath(path, local_file, base_path):
    """Given a remote path to upload to, a full path to a local file, and an
    optional full path that is a base path of the local file, construct the
    full remote path to place the file in. If base_path is not None, include
    the relative path from base_path to file."""
    if base_path is None or not local_file.startswith(base_path):
        return path

    dir = os.path.dirname(local_file)
    # strip base_path + extra slash and make it unixy
    dir = dir[len(base_path) + 1:].replace('\\', '/')
    return path + dir


def GetFileHashAndSize(filename):
    sha512Hash = 'UNKNOWN'
    size = 'UNKNOWN'

    try:
        # open in binary mode to make sure we get consistent results
        # across all platforms
        with open(filename, "rb") as f:
            shaObj = hashlib.sha512(f.read())
            sha512Hash = shaObj.hexdigest()

        size = os.path.getsize(filename)
    except Exception:
        raise Exception("Unable to get filesize/hash from file: %s" % filename)

    return (sha512Hash, size)


def GetMarProperties(filename):
    if not os.path.exists(filename):
        return {}
    (mar_hash, mar_size) = GetFileHashAndSize(filename)
    return {
        'completeMarFilename': os.path.basename(filename),
        'completeMarSize': mar_size,
        'completeMarHash': mar_hash,
    }


def GetUrlProperties(output, package):
    # let's create a switch case using name-spaces/dict
    # rather than a long if/else with duplicate code
    property_conditions = [
        # key: property name, value: condition
        ('symbolsUrl', lambda m: m.endswith('crashreporter-symbols.zip') or
         m.endswith('crashreporter-symbols-full.zip')),
        ('testsUrl', lambda m: m.endswith(('tests.tar.bz2', 'tests.zip'))),
        ('robocopApkUrl', lambda m: m.endswith('apk') and 'robocop' in m),
        ('jsshellUrl', lambda m: 'jsshell-' in m and m.endswith('.zip')),
        ('completeMarUrl', lambda m: m.endswith('.complete.mar')),
        ('partialMarUrl', lambda m: m.endswith('.mar') and '.partial.' in m),
        ('codeCoverageURL', lambda m: m.endswith('code-coverage-gcno.zip')),
        ('sdkUrl', lambda m: m.endswith(('sdk.tar.bz2', 'sdk.zip'))),
        ('testPackagesUrl', lambda m: m.endswith('test_packages.json')),
        ('packageUrl', lambda m: m.endswith(package)),
    ]
    url_re = re.compile(
        r'''^(https?://.*?\.(?:tar\.bz2|dmg|zip|apk|rpm|deb|mar|tar\.gz|json))$''')
    properties = {}

    try:
        for line in output.splitlines():
            m = url_re.match(line.strip())
            if m:
                m = m.group(1)
                for prop, condition in property_conditions:
                    if condition(m):
                        properties.update({prop: m})
                        break
    except IOError as e:
        if e.errno != errno.ENOENT:
            raise
        properties = {prop: 'UNKNOWN' for prop, condition
                      in property_conditions}
    return properties

def UploadFilesToS3(s3_bucket, s3_path, files, package, verbose=False):
    """Upload only mar file(s) from the list to s3_bucket/s3_path/.
    If verbose is True, print status updates while working."""

    s3 = boto.connect_s3()
    s3 = boto.s3.connection.S3Connection(
        calling_format=boto.s3.connection.ProtocolIndependentOrdinaryCallingFormat())
    bucket = s3.get_bucket(s3_bucket)
    properties = {}

    property_conditions = [
        ('completeMarUrl', lambda m: m.endswith('.complete.mar')),
        ('partialMarUrl', lambda m: m.endswith('.mar') and '.partial.' in m),
        ('packageUrl', lambda m: m.endswith(package)),
    ]

    for source_file in files:
        source_file = os.path.abspath(source_file)
        if not os.path.isfile(source_file):
            raise IOError("File not found: %s" % source_file)
        if not re.search('(\w+)\.(mar|dmg|rpm|deb|exe|tar\.bz2)$', source_file):
            continue

        dest_file = os.path.basename(source_file)
        full_key_name = '/'+s3_path+'/'+dest_file

        bucket_key = boto.s3.key.Key(bucket)
        bucket_key.key = full_key_name
        if verbose:
            print "Uploading " + source_file

        bucket_key.set_contents_from_filename(source_file)

        m = 'https://' + s3_bucket + full_key_name

        for prop, condition in property_conditions:
            if condition(m):
                properties.update({prop: m})
                break


    if verbose:
        print "Upload complete"

    return properties

def UploadServiceFilesToS3(s3_bucket, s3_path, files, verbose=False):
    """Upload all service files for build into separate s3_bucket/s3_path/.
    If verbose is True, print status updates while working."""

    s3 = boto.connect_s3()
    s3 = boto.s3.connection.S3Connection(
        calling_format=boto.s3.connection.ProtocolIndependentOrdinaryCallingFormat())
    bucket = s3.get_bucket(s3_bucket)

    for source_file in files:
        source_file = os.path.abspath(source_file)
        if not os.path.isfile(source_file):
            raise IOError("File not found: %s" % source_file)
        if re.search('(\w+)\.(mar|dmg|rpm|deb|exe|tar\.bz2)$', source_file):
            continue

        dest_file = os.path.basename(source_file)
        full_key_name = '/' + s3_path + '/' +dest_file

        bucket_key = boto.s3.key.Key(bucket)
        bucket_key.key = full_key_name

        if verbose:
            print "Uploading service file " + source_file

        bucket_key.set_contents_from_filename(source_file)

    if verbose:
        print "Upload service files complete"

def UploadFiles(user, host, path, files, verbose=False, port=None, ssh_key=None, base_path=None,
                upload_to_temp_dir=False, post_upload_command=None, package=None):
    """Upload each file in the list files to user@host:path. Optionally pass
    port and ssh_key to the ssh commands. If base_path is not None, upload
    files including their path relative to base_path. If upload_to_temp_dir is
    True files will be uploaded to a temporary directory on the remote server.
    Generally, you should have a post upload command specified in these cases
    that can move them around to their correct location(s).
    If post_upload_command is not None, execute that command on the remote host
    after uploading all files, passing it the upload path, and the full paths to
    all files uploaded.
    If verbose is True, print status updates while working."""
    if not host or not user:
        return {}
    if (not path and not upload_to_temp_dir) or (path and upload_to_temp_dir):
        print("One (and only one of UPLOAD_PATH or UPLOAD_TO_TEMP must be defined.")
        sys.exit(1)

    if upload_to_temp_dir:
        path = DoSSHCommand("mktemp -d", user, host,
                            port=port, ssh_key=ssh_key)
    if not path.endswith("/"):
        path += "/"
    if base_path is not None:
        base_path = os.path.abspath(base_path)
    remote_files = []
    properties = {}

    def get_remote_path(p):
        return GetBaseRelativePath(path, os.path.abspath(p), base_path)

    try:
        # Do a pass to find remote directories so we don't perform excessive
        # scp calls.
        remote_paths = set()
        for file in files:
            if not os.path.isfile(file):
                raise IOError("File not found: %s" % file)

            remote_paths.add(get_remote_path(file))

        # If we wanted to, we could reduce the remote paths if they are a parent
        # of any entry.
        for p in sorted(remote_paths):
            DoSSHCommand("mkdir -p " + p, user, host,
                         port=port, ssh_key=ssh_key)

        with futures.ThreadPoolExecutor(4) as e:
            fs = []
            # Since we're uploading in parallel, the largest file should take
            # the longest to upload. So start it first.
            for file in sorted(files, key=os.path.getsize, reverse=True):
                remote_path = get_remote_path(file)
                fs.append(e.submit(DoSCPFile, file, remote_path, user, host,
                                   port=port, ssh_key=ssh_key, log=verbose))
                remote_files.append(remote_path + '/' + os.path.basename(file))

            # We need to call result() on the future otherwise exceptions could
            # get swallowed.
            for f in futures.as_completed(fs):
                f.result()

        if post_upload_command is not None:
            if verbose:
                print("Running post-upload command: " + post_upload_command)
            file_list = '"' + '" "'.join(remote_files) + '"'
            output = DoSSHCommand('%s "%s" %s' % (
                post_upload_command, path, file_list), user, host, port=port, ssh_key=ssh_key)
            # We print since mozharness may parse URLs from the output stream.
            print(output)
            properties = GetUrlProperties(output, package)
    finally:
        if upload_to_temp_dir:
            DoSSHCommand("rm -rf %s" % path, user, host, port=port,
                         ssh_key=ssh_key)
    if verbose:
        print("Upload complete")
    return properties


def CopyFilesLocally(path, files, verbose=False, base_path=None):
    """Copy each file in the list of files to `path`.  The `base_path` argument is treated
    as it is by UploadFiles."""
    if not path.endswith("/"):
        path += "/"
    if base_path is not None:
        base_path = os.path.abspath(base_path)
    for file in files:
        file = os.path.abspath(file)
        if not os.path.isfile(file):
            raise IOError("File not found: %s" % file)
        # first ensure that path exists remotely
        target_path = GetBaseRelativePath(path, file, base_path)
        if not os.path.exists(target_path):
            os.makedirs(target_path)
        if verbose:
            print("Copying " + file + " to " + target_path)
        shutil.copy(file, target_path)


def WriteProperties(files, properties_file, url_properties, package):
    properties = url_properties
    for file in files:
        if file.endswith('.complete.mar'):
            properties.update(GetMarProperties(file))
    with open(properties_file, 'w') as outfile:
        properties['packageFilename'] = package
        properties['uploadFiles'] = [os.path.abspath(f) for f in files]
        json.dump(properties, outfile, indent=4)


if __name__ == '__main__':
    s3_path = OptionalEnvironmentVariable('S3_UPLOAD_PATH')
    s3_bucket = OptionalEnvironmentVariable('S3_BUCKET')
    if not s3_bucket:
        host = RequireEnvironmentVariable('UPLOAD_HOST')
        user = RequireEnvironmentVariable('UPLOAD_USER')
    path = OptionalEnvironmentVariable('UPLOAD_PATH')

    if not s3_bucket:
        if sys.platform == 'win32':
            if path is not None:
                path = FixupMsysPath(path)

    parser = OptionParser(usage="usage: %prog [options] <files>")
    parser.add_option("-b", "--base-path",
                      action="store",
                      help="Preserve file paths relative to this path when uploading. "
                      "If unset, all files will be uploaded directly to UPLOAD_PATH.")
    (options, args) = parser.parse_args()
    if len(args) < 1:
        print("You must specify at least one file to upload")
        sys.exit(1)

    try:
        if s3_bucket:
            url_properties = UploadFilesToS3(s3_bucket, s3_path, args, package=options.package, verbose=True)
            s3_service_path = OptionalEnvironmentVariable('S3_UPLOAD_PATH_SERVICE')
            s3_bucket_service = OptionalEnvironmentVariable('S3_BUCKET_SERVICE')
            if s3_service_path and s3_bucket_service:
                UploadServiceFilesToS3(s3_bucket_service, s3_service_path, args, verbose=True)
        else:
            CopyFilesLocally(path, args, base_path=options.base_path,
                             verbose=True)

        if url_properties:
            WriteProperties(args, options.properties_file,
                            url_properties, options.package)

    except IOError as strerror:
        print(strerror)
        sys.exit(1)
