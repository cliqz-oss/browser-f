#!/usr/bin/python
"""%prog -w <warn_new> -c <crit_new> -t <max_age> queuedir [queuedir...]

nagios plugin to monitor a queuedir"""
import os
import sys
import traceback
import time

OK, WARNING, CRITICAL, UNKNOWN = range(4)


def oldest_mtime(files):
    retval = None
    for f in files:
        try:
            mtime = os.path.getmtime(f)
            if retval is None:
                retval = mtime
            else:
                retval = min(retval, mtime)
        except OSError:
            # The file probably went away
            pass
    return retval


def check_queuedir(d, options):
    status = OK
    msgs = []

    # Check 'dead'
    num_dead = len([f for f in os.listdir(
        os.path.join(d, 'dead')) if not f.endswith(".log")])
    if num_dead > 0:
        status = CRITICAL
        if num_dead == 1:
            msgs.append("%i dead item" % num_dead)
        else:
            msgs.append("%i dead items" % num_dead)

    # Check 'new'
    new_files = os.listdir(os.path.join(d, 'new'))
    num_new = len(new_files)
    if num_new > 0:
        oldest_new = oldest_mtime([(os.path.join(d, 'new', f)) for f in new_files])
        if num_new >= options.crit_new:
            status = CRITICAL
            msgs.append("%i new items" % num_new)
        elif num_new >= options.warn_new:
            status = max(status, WARNING)
            msgs.append("%i new items" % num_new)

        age = int(time.time() - oldest_new)
        if age > options.max_age:
            status = max(status, WARNING)
            msgs.append("oldest item is %is old" % age)

    # Check 'cur'
    cur_files = os.listdir(os.path.join(d, 'cur'))
    num_cur = len(cur_files)
    if num_cur > 0:
        oldest_cur = oldest_mtime([(os.path.join(d, 'cur', f)) for f in cur_files])
        if num_cur >= options.crit_cur:
            status = CRITICAL
            msgs.append("%i cur items" % num_cur)
        elif num_cur >= options.warn_cur:
            status = max(status, WARNING)
            msgs.append("%i cur items" % num_cur)

        age = int(time.time() - oldest_cur)
        if age > options.max_age:
            status = max(status, WARNING)
            msgs.append("oldest item is %is old" % age)

    return status, msgs


def main():
    from optparse import OptionParser
    parser = OptionParser(__doc__)
    parser.set_defaults(
        warn_new=50,
        crit_new=100,
        warn_cur=50,
        crit_cur=100,
        max_age=900,
    )
    parser.add_option("-w", dest="warn_new", type="int",
                      help="warn when there are more than this number of items in new")
    parser.add_option("-c", dest="crit_new", type="int",
                      help="critical when there are more than this number of items in new")
    parser.add_option("--warn-cur", dest="warn_cur", type="int",
                      help="warn when there are more than this number of items in cur")
    parser.add_option("--crit-cur", dest="crit_cur", type="int",
                      help="critical when there are more than this number of items in cur")
    parser.add_option("-t", dest="max_age", type="int",
                      help="warn when oldest item in new/cur is more than this many seconds old")

    options, args = parser.parse_args()

    if len(args) == 0:
        print "You must specify at least one queuedir"
        sys.exit(UNKNOWN)

    try:
        status = OK
        msgs = []
        for d in args:
            d_status, d_msgs = check_queuedir(d, options)
            status = max(status, d_status)
            msgs.extend(d_msgs)

        if not msgs:
            print "Ok"
        else:
            print ";".join(msgs)
        sys.exit(status)
    except SystemExit:
        raise
    except:
        print "Unhandled exception"
        traceback.print_exc()
        sys.exit(UNKNOWN)

if __name__ == '__main__':
    main()
