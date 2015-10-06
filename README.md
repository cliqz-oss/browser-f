# CLIQZ Browser

CLIQZ develops novel Internet browsers that incorporate search as primary feature. This repository is about the CLIQZ Browsers based on Mozilla Firefox, available to users as  “CLIQZ for Windows beta” and “CLIQZ for Mac beta”.  Learn more at [cliqz.com](https://cliqz.com).

## Building

First you should have environment prepared to build regular Firefox. To do that
follow [Mozilla instructions](https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions).

Next run building script: `./magic_build_and_package.sh`

Successful build should create packages for appropriate platform in:

* windows installer: `./mozilla-release/obj-firefox/dist/installer/sea/`
* mac dmg: `./mozilla-release/obj-firefox/dist/`
* linux tar.bz2: `./mozilla-release/obj-firefox/dist/`

## Running

To test the build use regular Firefox process followed with:

* change working directory `cd mozilla-release`
* set environment variables:

```
export MOZ_OBJDIR=obj-firefox
export MOZCONFIG=`pwd`/browser/config/mozconfig
```

Then run as regular Firefox build with `./mach run`.

## Developing

There should be no differences in development from regular Mozilla process.

## Feature requests and bug reports

Please submit those in a form of a github issue.

When submitting the bug report please include following information:

* OS version, eg. Windox 8.1, Mac OS X 10.10.4
* system architecture (32/64 bit)
* browser version, eg. CLIQZ 0.8, based on Firefox 39
