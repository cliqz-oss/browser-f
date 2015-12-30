import os
from os import path
import urllib
import socket
from urllib import urlretrieve
from urllib2 import urlopen, HTTPError, URLError

from redo import retrier
import requests

from release.platforms import buildbot2ftp
from release.l10n import makeReleaseRepackUrls
from release.paths import makeCandidatesDir
from util.paths import windows2msys, msys2windows
from util.commands import run_cmd

import logging
log = logging.getLogger(__name__)


def downloadReleaseBuilds(stageServer, productName, brandName, version,
                          buildNumber, platform, candidatesDir=None,
                          signed=False, usePymake=False):
    if candidatesDir is None:
        candidatesDir = makeCandidatesDir(productName, version, buildNumber,
                                          protocol='http', server=stageServer)
    files = makeReleaseRepackUrls(productName, brandName, version, platform,
                                  signed=signed)

    env = {}
    for fileName, remoteFile in files.iteritems():
        url = '/'.join([p.strip('/') for p in [candidatesDir,
                                               urllib.quote(remoteFile)]])
        log.info("Downloading %s to %s", url, fileName)
        for _ in retrier():
            with open(fileName, "wb") as f:
                try:
                    r = requests.get(url, stream=True, timeout=15)
                    r.raise_for_status()
                    for chunk in r.iter_content(chunk_size=5*1024**2):
                        f.write(chunk)
                    r.close()
                    break
                except (requests.HTTPError, requests.ConnectionError,
                        requests.Timeout):
                    log.exception("Caught exception downloading")

        if fileName.endswith('exe'):
            if usePymake:
                env['WIN32_INSTALLER_IN'] = msys2windows(path.join(os.getcwd(),
                                                         fileName))
            else:
                env['WIN32_INSTALLER_IN'] = windows2msys(path.join(os.getcwd(),
                                                         fileName))
        else:
            if platform.startswith('win') and not usePymake:
                env['ZIP_IN'] = windows2msys(path.join(os.getcwd(), fileName))
            else:
                env['ZIP_IN'] = msys2windows(path.join(os.getcwd(), fileName))

    return env


def downloadUpdate(stageServer, productName, version, buildNumber,
                   platform, locale, candidatesDir=None):
    if candidatesDir is None:
        candidatesDir = makeCandidatesDir(productName, version, buildNumber,
                                          protocol='http', server=stageServer)
    fileName = '%s-%s.complete.mar' % (productName, version)
    destFileName = '%s-%s.%s.complete.mar' % (productName, version, locale)
    platformDir = buildbot2ftp(platform)
    url = '/'.join([p.strip('/') for p in [
        candidatesDir, 'update', platformDir, locale, fileName]])
    log.info("Downloading %s to %s", url, destFileName)
    remote_f = urlopen(url, timeout=20)
    local_f = open(destFileName, "wb")
    local_f.write(remote_f.read())
    local_f.close()

    expected_size = int(remote_f.info()['Content-Length'])
    actual_size =  os.path.getsize(destFileName)
    if expected_size != actual_size:
        log.info("File is truncated, got %s of %s bytes" % (actual_size,
                                                            expected_size))
        raise HTTPError

    return destFileName

def downloadUpdateIgnore404(*args, **kwargs):
    try:
        return downloadUpdate(*args, **kwargs)
    except HTTPError, e:
        if e.code == 404:
            # New locale
            log.warning('Got 404. Skipping %s' % e.geturl())
            return None
        else:
            raise


def url_exists(url, timeout=10):
    """simple function that verifies if given a url exists.
    Args:
        url (str): url to check
        timeout (int): timeout in seconds
    Returns:
        bool: True if url exists. False if the url does not exists (any http
                error) or the operation does not complete in timeout seconds.
    """
    exists = True
    try:
        urlopen(url, timeout=timeout)
    except (HTTPError, URLError, socket.timeout):
        # socket.timeout is required for python > 2.7
        exists = False
    return exists
