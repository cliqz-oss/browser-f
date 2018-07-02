#!/usr/bin/python
"""%prog [options] format inputfile outputfile inputfilename"""
import os
import os.path
import site
# Modify our search path to find our modules
site.addsitedir(os.path.join(os.path.dirname(__file__), "../../lib/python"))

import logging
import sys

from util.file import copyfile, safe_unlink
from signing.utils import shouldSign, signfile, osslsigncode_signfile
from signing.utils import gpg_signfile, mar_signfile, dmg_signpackage
from signing.utils import jar_signfile, emevoucher_signfile, widevine_signfile

if __name__ == '__main__':
    from optparse import OptionParser
    from ConfigParser import RawConfigParser

    parser = OptionParser(__doc__)
    parser.set_defaults(
        fake=False,
        signcode_keydir=None,
        gpg_homedir=None,
        loglevel=logging.INFO,
        configfile=None,
        mar_cmd=None,
        mar_sha384_cmd=None,
        signcode_timestamp=None,
        jar_keystore=None,
        jar_keyname=None,
        jar_sigalg=None,
        jar_digestalg=None,
        focus_jar_keystore=None,
        focus_jar_keyname=None,
        focus_jar_sigalg=None,
        focus_jar_digestalg=None,
        emevoucher_key=None,
        emevoucher_chain=None,
        widevine_key=None,
        widevine_cert=None,
        widevine_cmd=None,
    )
    parser.add_option("--keydir", dest="signcode_keydir",
                      help="where MozAuthenticode.spc, MozAuthenticode.spk can be found")
    parser.add_option("--gpgdir", dest="gpg_homedir",
                      help="where the gpg keyrings are")
    parser.add_option("--mac_id", dest="mac_id",
                      help="the mac signing identity")
    parser.add_option("--dmgkeychain", dest="dmg_keychain",
                      help="the mac signing keydir")
    parser.add_option("--fake", dest="fake", action="store_true",
                      help="do fake signing")
    parser.add_option("-c", "--config", dest="configfile",
                      help="config file to use")
    parser.add_option("--signcode_disable_timestamp",
                      dest="signcode_timestamp", action="store_false")
    parser.add_option("--jar_keystore", dest="jar_keystore",
                      help="keystore for signing jar_")
    parser.add_option("--jar_keyname", dest="jar_keyname",
                      help="which key to use from jar_keystore")
    parser.add_option("--jar_digestalg", dest="jar_digestalg",
                      help="which digest algorithm to use for signing jar files")
    parser.add_option("--jar_sigalg", dest="jar_sigalg",
                      help="which signature algorithm to use for signing jar files")
    parser.add_option("--focus_jar_keystore", dest="focus_jar_keystore",
                      help="keystore for signing Firefox Focus")
    parser.add_option("--focus_jar_keyname", dest="focus_jar_keyname",
                      help="which key to use from focus_jar_keystore")
    parser.add_option("--focus_jar_digestalg", dest="focus_jar_digestalg",
                      help="which digest algorithm to use for signing Firefox Focus")
    parser.add_option("--focus_jar_sigalg", dest="focus_jar_sigalg",
                      help="which signature algorithm to use for signing Firefox Focus")
    parser.add_option("--emevoucher_key", dest="emevoucher_key",
                      help="The certificate to use for signing the eme voucher")
    parser.add_option("--emevoucher_chain", dest="emevoucher_chain",
                      help="Certificate chain to include in EME voucher signatures")
    parser.add_option("--widevine_key", dest="widevine_key",
                      help="The key to use for signing widevine files")
    parser.add_option("--widevine_cert", dest="widevine_cert",
                      help="Certificate to use for signing widevine files")
    parser.add_option("--widevine_cmd", dest="widevine_cmd",
                      help="Command to use for signing widevine files")
    parser.add_option(
        "-v", action="store_const", dest="loglevel", const=logging.DEBUG)

    options, args = parser.parse_args()

    if options.configfile:
        config = RawConfigParser()
        config.read(options.configfile)
        for option, value in config.items('signscript'):
            if option == "signcode_timestamp":
                value = config.getboolean('signscript', option)
            options.ensure_value(option, value)

    # Reset to default if this wasn't set in the config file
    if options.signcode_timestamp is None:
        options.signcode_timestamp = True

    logging.basicConfig(
        level=options.loglevel, format="%(asctime)s - %(message)s")

    if len(args) != 4:
        parser.error("Incorrect number of arguments")

    format_, inputfile, destfile, filename = args

    tmpfile = destfile + ".tmp"

    passphrase = sys.stdin.read().strip()
    if passphrase == '':
        passphrase = None

    if format_ == "signcode":
        if not options.signcode_keydir:
            parser.error("keydir required when format is signcode")
        copyfile(inputfile, tmpfile)
        if shouldSign(filename):
            signfile(tmpfile, options.signcode_keydir, options.fake,
                     passphrase, timestamp=options.signcode_timestamp)
        else:
            parser.error("Invalid file for signing: %s" % filename)
            sys.exit(1)
    elif format_ == "osslsigncode":
        safe_unlink(tmpfile)
        if not options.signcode_keydir:
            parser.error("keydir required when format is osslsigncode")
        if shouldSign(filename):
            osslsigncode_signfile(inputfile, tmpfile, options.signcode_keydir, options.fake,
                     passphrase, timestamp=options.signcode_timestamp)
        else:
            parser.error("Invalid file for signing: %s" % filename)
            sys.exit(1)
    elif format_ in ("sha2signcode", "sha2signcodestub"):
        safe_unlink(tmpfile)
        # add zipfile support
        if not options.sha2signcode_keydir:
            parser.error("sha2signcode_keydir required when format is sha2signcode")
        includedummycert = False
        if format_ == "sha2signcodestub":
            includedummycert = True
        if shouldSign(filename):
            # osslsigncode_signfile is used here because "sha2 signing" isn't
            # a different signing process, it's just signing using the same
            # tools/process with a different cert.
            osslsigncode_signfile(inputfile, tmpfile, options.sha2signcode_keydir, options.fake,
                     passphrase, timestamp=options.signcode_timestamp, includedummycert=includedummycert)
        else:
            parser.error("Invalid file for signing: %s" % filename)
            sys.exit(1)
    elif format_ == "gpg":
        if not options.gpg_homedir:
            parser.error("gpgdir required when format is gpg")
        safe_unlink(tmpfile)
        gpg_signfile(
            inputfile, tmpfile, options.gpg_homedir, options.fake, passphrase)
    elif format_ == "emevoucher":
        safe_unlink(tmpfile)
        emevoucher_signfile(
            inputfile, tmpfile, options.emevoucher_key,
            options.emevoucher_chain, options.fake, passphrase)
    elif format_ == "mar":
        if not options.mar_cmd:
            parser.error("mar_cmd is required when format is mar")
        safe_unlink(tmpfile)
        mar_signfile(
            inputfile, tmpfile, options.mar_cmd, options.fake, passphrase)
    elif format_ == "mar_sha384":
        if not options.mar_sha384_cmd:
            parser.error("mar_sha384_cmd is required when format is mar_sha384")
        safe_unlink(tmpfile)
        mar_signfile(
            inputfile, tmpfile, options.mar_sha384_cmd, options.fake, passphrase)
    elif format_ == "dmg":
        if not options.dmg_keychain:
            parser.error("dmg_keychain required when format is dmg")
        if not options.mac_id:
            parser.error("mac_id required when format is dmg")
        safe_unlink(tmpfile)
        dmg_signpackage(inputfile, tmpfile, options.dmg_keychain, options.mac_id, options.mac_cert_subject_ou, options.fake, passphrase)
    elif format_ in ("jar", "focus-jar"):
        if format_ == "jar":
            keystore, keystore_config_name, keyname, keyname_config_name, digestalg, sigalg = (
                options.jar_keystore, "jar_keystore", options.jar_keyname, "jar_keyname",
                options.jar_digestalg, options.jar_sigalg
            )
        else:
            keystore, keystore_config_name, keyname, keyname_config_name, digestalg, sigalg = (
                options.focus_jar_keystore, "focus_jar_keystore", options.focus_jar_keyname, "focus_jar_keystore",
                options.focus_jar_digestalg, options.focus_jar_sigalg
            )
        if not keystore:
            parser.error("%s required when format is %s" % (keystore_config_name, format_))
        if not keyname:
            parser.error("%s required when format is %s" % (keyname_config_name, format_))
        copyfile(inputfile, tmpfile)
        jar_signfile(tmpfile, keystore, keyname, digestalg, sigalg, options.fake, passphrase)
    elif format_ in ("widevine", "widevine_blessed"):
        safe_unlink(tmpfile)
        if not options.widevine_key:
            parser.error("widevine_key required when format is %s" % format_)
        blessed = "0"
        if format_ == "widevine_blessed":
            blessed = "1"
        widevine_signfile(
            inputfile, tmpfile, options.widevine_key, options.widevine_cert,
            options.widevine_cmd, fake=options.fake, passphrase=passphrase,
            blessed=blessed
        )

    os.rename(tmpfile, destfile)
