#!/usr/bin/env python

# restart_masters.py
#
# Buildbot-masters gradually consume more resources the longer they stay up.
# To combat this, we've begun manually restarting masters once a month. This
# script attempts to automate that manual process.
#
# The basic workflow is this:
#  * lookup the list of all enabled masters in production-masters.json
#  * prune that list based on an optional list of masters to target
#  * put the masters into buckets by type and datacenter:
#  ** We only process one master per bucket at a given time. This is to
#     minimize our impact on capacity.
#  * disable each master in slavealloc
#  * exceute a graceful shutdown of that master via it's web interface
#  * wait for the master process to disappear, then restart buildbot
#  * on each interation, check for masters that have finished, pick a new master
#    from that same bucket, and begin the restart process for that master

import getpass
import operator
import os
import requests
import simplejson as json
import socket
import time

from furl import furl
from paramiko import AuthenticationException
from slaveapi.clients import ssh

import logging
log = logging.getLogger(__name__)

buckets = {}
running_buckets = {}
completed_masters = {}
problem_masters = {}
master_ids = {}
SLEEP_INTERVAL = 60
username = "cltbld"
slavealloc_api_url = "https://secure.pub.build.mozilla.org/slavealloc/api/masters"
credentials = {
    "ldap_username": "",
    "ldap_password": "",
    "cltbld_password": "",
}

def IgnorePolicy():
    def missing_host_key(self, *args):
        pass

def put_masters_in_buckets(masters_json, master_list=None):
    for master in masters_json:
        if not master['enabled']:
            continue
        if master_list:
            if master['hostname'].split('.')[0] not in master_list:
                continue

        bucket_key = master['name'].split('-',1)[1]
        # We can parallelize restarts more in AWS because we're in different regions,
        # so make separate buckets for cloud pools.
        if "aws" in master['datacentre']:
            bucket_key += "-" + master['datacentre']
        if bucket_key not in buckets:
            buckets[bucket_key] = []
        buckets[bucket_key].append(master)
    return

def masters_remain():
    for key in running_buckets:
        if running_buckets[key]:
            return True
    for key in buckets:
        if buckets[key]:
            return True
    return False

class MasterConsole(ssh.SSHConsole):
    def connect(self, timeout=30):
        try:
            log.debug("Attempting to connect to %s as %s" % (self.fqdn, username))
            self.client.load_system_host_keys()
            if credentials["cltbld_password"] != "":
                self.client.connect(hostname=self.fqdn, username=username, password=credentials["cltbld_password"], allow_agent=True)
            else:
                self.client.connect(hostname=self.fqdn, username=username, allow_agent=True)
            log.info("Connection as %s succeeded!", username)
            self.connected = True
        except AuthenticationException, e:
            log.debug("Authentication failure.")
            raise e
        except socket.error, e:
            # Exit out early if there is a socket error, such as:
            # ECONNREFUSED (Connection Refused). These errors are
            # typically raised at the OS level.
            from errno import errorcode
            log.debug("Socket Error (%s) - %s", errorcode[e[0]], e[1])
            raise e
        if not self.connected:
            log.info("Couldn't connect with any credentials.")
            raise Exception

def get_console(hostname):
    console = MasterConsole(hostname, None)
    try:
        console.connect()  # Make sure we can connect properly
        return console
    except (socket.error, ssh.SSHException), e:
        log.error(e)
        console.disconnect() # Don't hold a connection
        return None  # No valid console
    return None  # How did we get here?

def stop_master(master):
    # For scheduler masters, we just stop them.
    log.info("Stopping %s" % master['hostname'])
    cmd = "cd %s; source bin/activate; touch reconfig.lock; make stop" % master['basedir']
    console = get_console(master['hostname'])
    if console:
        try:
            rc, output = console.run_cmd(cmd)
            if rc == 0:
                log.info("%s stopped successfully." % master['hostname'])
                return True
            log.warning("Failed to stop %s, or never saw stop finish." % master['hostname'])
        except ssh.RemoteCommandError:
            log.warning("Caught exception while attempting stop_master.")
    else:
        log.error("Couldn't get console to %s" % master['hostname'])
    return False

def parse_bash_env_var_from_string(match_string, line):
    line = line.strip()
    key,value = line.split("=", 2)
    return value.strip(' \'\"')

def get_credentials_from_config_file(config_file):
    # LDAP username and LDAP password are required. If ssh keys are available
    # (either locally or via agent), we can use them for cltbld access.
    if config_file and os.path.exists(config_file):
        with open(config_file, 'r') as f:
            for line in f:
                if 'LDAP_USERNAME' in line:
                    credentials["ldap_username"] = parse_bash_env_var_from_string('LDAP_USERNAME', line)
                elif 'LDAP_PASSWORD' in line:
                    credentials["ldap_password"] = parse_bash_env_var_from_string('LDAP_PASSWORD', line)
                elif 'CLTBLD_PASSWORD' in line:
                    credentials["cltbld_password"] = parse_bash_env_var_from_string('CLTBLD_PASSWORD', line)
        f.closed
        if not credentials["ldap_username"] or not credentials["ldap_password"]:
            log.error("Unable to parse LDAP credentials from config file: %s" % config_file)
            return None
    return True

def get_credentials_from_user():
    credentials["ldap_username"] = raw_input("Enter LDAP username: ")
    credentials["ldap_password"] = getpass.getpass(prompt='Enter LDAP password: ')
    credentials["cltbld_password"] = getpass.getpass(prompt='Enter cltbld password: ')

def get_credentials(config_file=None):
    if config_file:
	get_credentials_from_config_file(config_file)
    if credentials["ldap_username"] == '' or credentials["ldap_password"] == '':
        get_credentials_from_user()
    if credentials["ldap_username"] == '' or credentials["ldap_password"] == '':
        return None
    return True

def get_master_ids():
    r = requests.get(slavealloc_api_url, auth=(credentials["ldap_username"], credentials["ldap_password"]))
    if r.status_code != 200:
        log.error("Unable to retrieve masters from slavealloc. Check LDAP credentials.")
        return False
    for master in r.json():
        master_ids[str(master['nickname'])] = master['masterid']
    if not master_ids:
        return False
    return True

def http_post(post_url, error_msg):
    try:
        requests.post(str(post_url), allow_redirects=False)
    except requests.RequestException:
        log.error(error_msg)
        return False
    return True

def http_put(put_url, put_data, error_msg):
    try:
        r = requests.put(put_url, data=json.dumps(put_data), allow_redirects=False, auth=(credentials["ldap_username"], credentials["ldap_password"]))
        if r.status_code == 200:
            return True
    except requests.RequestException:
        log.error(error_msg)
        return False
    return True

def disable_master(master):
    # Disable the master in slavealloc while we're restarting.
    # This shuold avoid new slaves from connecting during shutdown
    # and possibly getting hung.
    log.info("Disabling %s in slavealloc." % master['hostname'])
    disable_url = furl(slavealloc_api_url + "/" + str(master_ids[master['name']]))
    put_data = {"enabled": 0}
    error_msg = "Failed to disable %s" % master['hostname']
    return http_put(str(disable_url), put_data, error_msg)

def enable_master(master):
    # Re-enable the master in slavealloc after it has been restarted.
    log.info("Re-enabling %s in slavealloc." % master['hostname'])
    enable_url = furl(slavealloc_api_url + "/" + str(master_ids[master['name']]))
    put_data = {"enabled": 1}
    error_msg = "Failed to re-enable %s" % master['hostname']
    return http_put(str(enable_url), put_data, error_msg)

def graceful_shutdown(master):
    # We do graceful shutdowns through the master's web interface
    log.info("Initiating graceful shutdown for %s" % master['hostname'])
    shutdown_url = furl("http://" + master['hostname'])
    shutdown_url.port = master['http_port']
    shutdown_url.path = "shutdown"
    error_msg = "Failed to initiate graceful shutdown for %s" % master['hostname']
    if http_post(str(shutdown_url), error_msg):
        log.info("Creating reconfig lockfile for master: %s" % master['hostname'])
        cmd = "cd %s; touch reconfig.lock" % master['basedir']
        console = get_console(master['hostname'])
        if console:
            try:
                rc, output = console.run_cmd(cmd)
                if rc == 0:
                    log.info("Created lockfile on master: %s." % master['hostname'])
                    return True
                log.warning("Error creating lockfile on master: %s" % master['hostname'])
            except ssh.RemoteCommandError:
                log.warning("Caught exception while attempting graceful_shutdown.")
        else:
            log.error("Couldn't get console to %s" % master['hostname'])

    return False

def check_shutdown_status(master):
    # Returns true when there is no matching master process.
    # Example process:
    # /builds/buildbot/coop/tests-master/bin/python /builds/buildbot/coop/tests-master/bin/buildbot start /builds/buildbot/coop/tests-master/master
    log.info("Checking shutdown status of master: %s" % master['hostname'])
    cmd="ps auxww | grep python | grep start | grep %s" % master['master_dir']
    console = get_console(master['hostname'])
    if console:
        try:
            rc, output = console.run_cmd(cmd)
            if rc != 0:
                log.info("No master process found on %s." % master['hostname'])
                return True
            log.info("Master process still exists on %s." % master['hostname'])
        except ssh.RemoteCommandError:
            log.warning("Caught exception while checking shutdown status. Will retry on next pass.")
    else:
        log.error("Couldn't get console to %s" % master['hostname'])
    return False

def restart_master(master):
    # Restarts buildbot on the remote master
    log.info("Attempting to restart master: %s" % master['hostname'])
    cmd = "cd %s; source bin/activate; make start; rm -f reconfig.lock" % master['basedir']
    console = get_console(master['hostname'])
    if console:
        try:
            rc, output = console.run_cmd(cmd)
            if rc == 0:
                log.info("Master %s restarted successfully." % master['hostname'])
                return True
            log.warning("Restart of master %s failed, or never saw restart finish." % master['hostname'])
        except ssh.RemoteCommandError:
            log.warning("Caught exception while attempting to restart_master.")
    else:
        log.error("Couldn't get console to %s" % master['hostname'])
    return False

def display_remaining():
    if not buckets:
        return
    log.info("")
    log.info("Masters not processed yet")
    log.info("{:<30} {}".format("bucket","master URL"))
    log.info("{:<30} {}".format("======","=========="))
    for bucket in sorted(buckets.iterkeys()):
        for master in sorted(buckets[bucket], key=operator.itemgetter('hostname')):
            if master['role'] == 'scheduler':
	        log.info("{:<30} {}".format(bucket, master['hostname']))
            else:
	        log.info("{:<30} http://{}:{}".format(bucket, master['hostname'], master['http_port']))

def display_running():
    if not running_buckets:
        return
    log.info("")
    log.info("Masters still being processed")
    log.info("{:<30} {}".format("bucket","master URL"))
    log.info("{:<30} {}".format("======","=========="))
    for bucket in sorted(running_buckets.iterkeys()):
        if running_buckets[bucket]['role'] == 'scheduler':
            log.info("{:<30} {}".format(bucket, running_buckets[bucket]['hostname']))
        else:
            log.info("{:<30} http://{}:{}".format(bucket, running_buckets[bucket]['hostname'], running_buckets[bucket]['http_port']))

def display_completed():
    if not completed_masters:
        return
    log.info("")
    log.info("Masters restarted (or at least attempted)")
    log.info("{:<30} {}".format("bucket","master URL"))
    log.info("{:<30} {}".format("======","=========="))
    for bucket in sorted(completed_masters.iterkeys()):
        for master in sorted(completed_masters[bucket], key=operator.itemgetter('hostname')):
            if master['role'] == 'scheduler':
                log.info("{:<30} {}".format(bucket, master['hostname']))
            else:
                log.info("{:<30} http://{}:{}".format(bucket, master['hostname'], master['http_port']))

def display_problems():
    if not problem_masters:
        return
    log.info("")
    log.info("Masters that hit problems")
    log.info("{:<30} {} {}".format("bucket","master URL","issue"))
    log.info("{:<30} {} {}".format("======","==========","====="))
    for bucket in sorted(problem_masters.iterkeys()):
        for master in sorted(problem_masters[bucket], key=operator.itemgetter('hostname')):
	    if master['role'] == 'scheduler':
	        log.info("{:<30} {} {}".format(bucket, master['hostname'], master['issue']))
	    else:
	        log.info("{:<30} http://{}:{} {}".format(bucket, master['hostname'], master['http_port'], master['issue']))

if __name__ == '__main__':
    import argparse
    import sys

    parser = argparse.ArgumentParser(description='Gracefully restart a list of buildbot masters')
    parser.add_argument("-v", "--verbose", dest="verbose", action="store_true",
                        help="Enable extra debug output")
    parser.add_argument("-vv", "--very-verbose", dest="very_verbose", action="store_true",
                        help="Enable extra debug output for ssh connections")
    parser.add_argument("-m", "--masters-json", action="store", dest="masters_json", help="JSON file containing complete list of masters", required=True)
    parser.add_argument("-l", "--limit-to-masters", action="store", dest="limit_to_masters", help="Test file containing list of masters to restart, one per line", default=None)
    parser.add_argument("-c", "--config", action="store", dest="config_file", help="Text file containing config variables in bash format", required=False)

    args = parser.parse_args()

    # Setup logging
    #
    # Some of the modules we use here are very chatty (e.g. paramiko). We set the default log level
    # low with an option to increase if we're debugging a submodule issue.
    if args.very_verbose:
        logging.basicConfig(level=logging.DEBUG, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s")
    else:
        logging.basicConfig(level=logging.WARNING, format="%(asctime)s - %(levelname)s - %(name)s - %(message)s")

    # The default log level for this script is slightly higher (INFO) because it's presumed we care
    # about the output.
    if args.verbose:
        log.setLevel(logging.DEBUG)
    else:
        log.setLevel(logging.INFO)

    if not os.path.isfile(args.masters_json):
        log.error("Masters JSON file ('%s') does not exist. Exiting..." % args.masters_json)
        sys.exit(1)

    if not get_credentials(config_file=args.config_file):
        sys.exit(2)

    # Getting the master IDs allown us to valid the LDAP credentials while also
    # getting a list of master IDS we can use when disabling masters in slavealloc.
    if not get_master_ids():
        sys.exit(3)

    master_list = []
    if args.limit_to_masters:
        if not os.path.isfile(args.limit_to_masters):
            log.warning("Masters limit file ('%s') does not exist. Skipping..." % args.limit_to_masters)
        else:
            master_list = [line.strip() for line in open(args.limit_to_masters)]

    json_data = open(args.masters_json)
    masters_json = json.load(json_data)

    put_masters_in_buckets(masters_json, master_list)

    #import pprint
    #pp = pprint.PrettyPrinter(indent=4)
    #pp.pprint(buckets)
    #sys.exit(1)

    while masters_remain():
        # Refill our running buckets.
        # If we add a new master, we need to kick off the graceful shutdown too.
        keys_processed = []
        for key in buckets:
            if key in running_buckets:
                continue
            else:
                if buckets[key]:
                    running_buckets[key] = buckets[key].pop()
                    if running_buckets[key]['role'] == "scheduler":
                        stop_master(running_buckets[key])
                    else:
                        if disable_master(running_buckets[key]):
                            log.info("Disabled %s in slavealloc." % running_buckets[key]['hostname'])
                        else:
                            running_buckets[key]['issue'] = "Unable to disable in slavealloc"
                            if key not in problem_masters:
                                problem_masters[key] = []
                            problem_masters[key].append(running_buckets[key].copy())
                            del running_buckets[key]
                        if graceful_shutdown(running_buckets[key]):
                            log.info("Initiated graceful_shutdown of %s." % running_buckets[key]['hostname'])
                        else:
                            running_buckets[key]['issue'] = "Unable to initiate graceful_shutdown"
                            if key not in problem_masters:
                                problem_masters[key] = []
                            problem_masters[key].append(running_buckets[key].copy())
                            del running_buckets[key]

        for key in running_buckets:
            if check_shutdown_status(running_buckets[key]):
                if not restart_master(running_buckets[key]):
                    log.warning("Failed to restart master (%s). Please investigate by hand." % running_buckets[key]['hostname'])
                # Either way, we re-enable and remove this master so we can proceed.
                if running_buckets[key]['role'] != "scheduler":
                    if enable_master(running_buckets[key]):
                        log.info("Re-enabled %s in slavealloc" % running_buckets[key]['hostname'])
                    else:
                        running_buckets[key]['issue'] = "Unable to re-enable in slavealloc"
                        if key not in problem_masters:
                            problem_masters[key] = []
                        problem_masters[key].append(running_buckets[key].copy())
                        del running_buckets[key]
                        continue
                if key not in completed_masters:
                    completed_masters[key] = []
                completed_masters[key].append(running_buckets[key].copy())
                keys_processed.append(key)

        for key in keys_processed:
            del running_buckets[key]

        if masters_remain():
            display_completed()
            display_problems()
            display_running()
            display_remaining()
            log.info("Sleeping for %ds" % SLEEP_INTERVAL)
            time.sleep(SLEEP_INTERVAL)

    log.info("All masters processed. Exiting")
    display_completed()
    display_problems()
