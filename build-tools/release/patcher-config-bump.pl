#!/usr/bin/perl -w
use strict;

use Config::General;
use File::Spec::Functions;
use File::Temp qw(tempdir);
use Getopt::Long;
use Storable;

use Bootstrap::Util qw(LoadLocaleManifest);

use Release::Patcher::Config qw(GetProductDetails GetReleaseBlock BumpFilePath BumpURL);
use Release::Versions qw(GetPrettyVersion);

$|++;

# we disable this for bug 498273
# my $RELEASE_CANDIDATE_CHANNELS = ['betatest', 'DisableCompleteJump'];

my %config;
my @DEFAULT_PLATFORMS = ('linux', 'linux64', 'macosx64', 'win32', 'win64');

ProcessArgs();
BumpPatcherConfig();

sub ProcessArgs {
    GetOptions(
        \%config,
        "product|p=s", "brand|r=s", "version|v=s", "old-version|o=s",
        "partial-version=s@", "prompt-wait-time=s", "mar-channel-id=s@",
        "app-version|a=s", "build-number|b=s", "patcher-config|c=s",
        "ftp-server|f=s", "bouncer-server|d=s",
        "use-beta-channel|u", "shipped-locales|l=s", "releasenotes-url|n=s",
        "platform=s@", "marname=s", "oldmarname=s", "schema|s=s",
        "stage-product=s",
        "bouncer-product=s",
        "help|h"
    );

    if ($config{'help'}) {
        print <<__USAGE__;
Usage: patcher-config-bump.pl [options]
This script depends on the MozBuild::Util and Bootstrap::Util modules.
Options:
  -p The product name (eg. firefox, thunderbird, seamonkey, etc.)
  --stage-product The product name used in the stage prefix.
     If not specified, the product name is assumed.
  --bouncer-product The product name used in Bouncer.
     If not specified, the product name is assumed.
  -r The brand name (eg. Firefox, Thunderbird, SeaMonkey, etc.)
     If not specified, a first-letter-uppercased product name is assumed.
  -v The current version of the product (eg. 3.1a1, 3.0rc1)
  -a The current 'app version' of the product (eg. 3.1a1, 3.0). If not
     specified is assumed to be the same as version
  --partial-version An older version (that is already in the patcher config)
     that should receive a partial update.
  -b The current build number of this release. (eg, 1, 2, 3)
  -c The path and filename of the config file to be bumped.
  -f The FTP server to get builds and buildIDs from. Typically is ftp.mozilla.org
  -d The hostname of the Bouncer server to serve release builds from.
     Typically is download.mozilla.org.
  -u When not passed, the Beta channel will be considered the channel for final
     release. Specifically, this will cause the 'beta' channel snippets to
     point at the Bouncer server (rather than FTP). When passed, the
     'release' channel will be considered the channel for final release.
     This means that 'release' channel snippets will point to bouncer and
     'beta' channel ones will point to FTP.
     Generally, Alphas and Betas do not pass this, final and point releases do.
  -l The path and filename to the shipped-locales file for this release.
  -n Release notes URL.
  --platform The list of platforms (multiple). Default to:
    --platform linux --platform macosx --platform win32
  --marname Optional MAR prefix (firefox, mozilladeveloperpreview) for this
    release. Default value is set to the product name.
  --oldmarname Optional MAR prefix (firefox, mozilladeveloperpreview) for the
    previous release. Default value is set to --marname.
  -s The schema version to write to the release block for version, which controls
     the style of snippets used (bug 459972), defaults to 2.
  --prompt-wait-time The amount of time to wait before prompting the user to update
                     to this release. Not specifying this will use the default value
                     as specified in the application.
  -h This usage message.
__USAGE__

        exit(0);
    }

    my $error = 0;

    # Some input validation
    for my $arg ('product', 'version', 'old-version', 'build-number',
                 'ftp-server', 'bouncer-server') {
        if (! defined $config{$arg}) {
            print "$arg must be defined.\n";
            $error = 1;
        }
    }
    if (! defined $config{'patcher-config'} or
             ! -w $config{'patcher-config'}) {
        print "patcher config file must exist and be writable.\n";
        $error = 1;
    }
    if (! defined $config{'shipped-locales'} or
             ! -e $config{'shipped-locales'}) {
        print "shipped locales file must exist.\n";
        $error = 1;
    }
    if ($error) {
        exit($error);
    }

    # set sane defaults
    if (! defined $config{'stage-product'}) {
        $config{'stage-product'} = $config{'product'};
    }
    if (! defined $config{'bouncer-product'}) {
        $config{'bouncer-product'} = $config{'product'};
    }
    if (! defined $config{'brand'}) {
        $config{'brand'} = ucfirst($config{'product'});
    }
    if (! defined $config{'app-version'}) {
        $config{'app-version'} = $config{'version'};
    }
    if (! defined $config{'use-beta-channel'}) {
        $config{'use-beta-channel'} = 0;
    }
    if (! defined $config{'platform'}) {
        $config{'platform'} = \@DEFAULT_PLATFORMS;
    }
    if (! defined $config{'marname'}) {
        $config{'marname'} = $config{'product'};
    }
    if (! defined $config{'oldmarname'}) {
        $config{'oldmarname'} = $config{'marname'};
    }
    if (! defined $config{'schema'}) {
        $config{'schema'} = 2;
    }
}

sub BumpPatcherConfig {
    my $product = $config{'product'};
    my $stage_product = $config{'stage-product'};
    my $brand = $config{'brand'};
    my $version = $config{'version'};
    my $oldVersion = $config{'old-version'};
    my @partialVersions = ();
    if (defined($config{'partial-version'})){
        @partialVersions = @{$config{'partial-version'}};
    }
    my @marChannelIds = ();
    if (defined($config{'mar-channel-id'})){
        @marChannelIds = @{$config{'mar-channel-id'}};
    }
    my $appVersion = $config{'app-version'};
    my $build = $config{'build-number'};
    my $patcherConfig = $config{'patcher-config'};
    my $ftpServer = $config{'ftp-server'};
    my $bouncerServer = $config{'bouncer-server'};
    my $bouncer_product = $config{'bouncer-product'};
    my $useBetaChannel = $config{'use-beta-channel'};
    my $configBumpDir = '.';
    my $releaseNotesUrl = $config{'releasenotes-url'};
    my $platforms = $config{'platform'};
    my $schema = $config{'schema'};
    my $promptWaitTime = $config{'prompt-wait-time'};

    my $prettyVersion = GetPrettyVersion(version => $version,
                                         product => $product);

    my $localeInfo = {};
    if (not LoadLocaleManifest(localeHashRef => $localeInfo,
                               manifest => $config{'shipped-locales'})) {
        die "Could not load locale manifest";
    }

    my $patcherConfigObj;
    if (Config::General->VERSION ge '2.40') {
        $patcherConfigObj = new Config::General(-ConfigFile => $patcherConfig, -SaveSorted => 1);
    } else {
        # remove this branch when ESR17 reaches EOL
        $patcherConfigObj = new Config::General(-ConfigFile => $patcherConfig);
    }

    my %rawConfig = $patcherConfigObj->getall();
    die "ASSERT: BumpPatcherConfig(): null rawConfig" 
     if (0 == scalar(keys(%rawConfig)));

    my $appObj = $rawConfig{'app'}->{$brand};
    die "ASSERT: BumpPatcherConfig(): null appObj" if (! defined($appObj));

    my $currentUpdateObj = $appObj->{'current-update'};

    if ($promptWaitTime) {
        $currentUpdateObj->{'promptWaitTime'} = $promptWaitTime;
    }
    else {
        delete($currentUpdateObj->{'promptWaitTime'});
    }

    # Add the release we're replacing to the past-releases array, but only if
    # it's a new release; we used to determine this by looking at the build 
    # value, but that can be misleading because sometimes we may not get to
    # the update step before a respin; so what we really need to compare is 
    # whether our current version in bootstrap.cfg is in the to clause of the 
    # patcher config file/object; we now control this via doOnetimePatcherBumps.
    #
    # More complicated than it needs to be because it handles the (uncommon)
    # case that there is no past-update yet (e.g. Firefox 3.0)

    my $doOnetimePatcherBumps = ($currentUpdateObj->{'to'} ne $version);

    # Don't try to modify past-update if this is the first time
    # we're doing updates (as proxied by undefined "from")
    if ($doOnetimePatcherBumps && defined($currentUpdateObj->{'from'})) {
        my $pastUpdateObj = $appObj->{'past-update'};
        # no existing past-update's, initialize
        if (! defined($pastUpdateObj)) {
            $appObj->{'past-update'} = $pastUpdateObj = [];
        }
        # one prior past-update, convert to array
        elsif (ref($pastUpdateObj) ne 'ARRAY') {
            my $oldSinglePastUpdateStr = $pastUpdateObj;
            $appObj->{'past-update'} = $pastUpdateObj = [];
            push(@{$pastUpdateObj}, $oldSinglePastUpdateStr);
        }

        my @pastUpdateChannels = (split(/[\s,]+/,
                                   $currentUpdateObj->{'testchannel'}),
                                  split(/[\s,]+/,
                                   $currentUpdateObj->{'channel'}));

        if (grep(/^$currentUpdateObj->{'from'} /, @{$pastUpdateObj})) {
            print "WARNING: we already have a past-update for $currentUpdateObj->{'from'}" .
                  ", not adding another\n";
        } else {
            push(@{$pastUpdateObj}, join(' ', $currentUpdateObj->{'from'},
              $currentUpdateObj->{'to'}, @pastUpdateChannels));
        }
    }

    # Now we can replace information in the "current-update" object; start
    # with the to/from versions, the rc channels, then the information for
    # the partial and complete update patches
    #
    # Only bump the to/from versions if we're really a new release. We used
    # to determine this by looking at the build value, but now we use
    # doOnetimePatcherBump 
    
    if ($doOnetimePatcherBumps) {
        $currentUpdateObj->{'to'} = $version;
        $currentUpdateObj->{'from'} = $oldVersion;
        if (defined($currentUpdateObj->{'openURL'})) {
            $currentUpdateObj->{'openURL'} = BumpURL(
                oldURL => $currentUpdateObj->{'openURL'},
                version => $appVersion,
                oldVersion => $oldVersion
            )
        }
    }

    $currentUpdateObj->{'details'} = $releaseNotesUrl ||
        GetProductDetails(product => $product, appVersion => $appVersion,
                          updateType => 'minor');

    # we disable this for bug 498273, except for ensuring the block is empty
    #if ($useBetaChannel) {
    #    push(@{$RELEASE_CANDIDATE_CHANNELS},'beta');
    #}
    $currentUpdateObj->{'rc'} = {};
    #foreach my $c (@{$RELEASE_CANDIDATE_CHANNELS}) {
    #    $currentUpdateObj->{'rc'}->{$c} = "$build";
    #}

    # When useBetaChannel is true we need to make sure that we separate
    # the release and beta channel snippets by setting beta-dir
    if ($useBetaChannel) {
        $currentUpdateObj->{'beta-dir'} = 'beta';
    }

    my $buildStr = 'build' . $build;
    my @oldPartialVersions = keys(%{$currentUpdateObj->{'partials'}});
    my $oldPaths;
    if ($#oldPartialVersions >= 0) {
        $oldPaths = $currentUpdateObj->{'partials'}->{$oldPartialVersions[0]};
    } else {
        print "WARNING: No old partials, using default values\n";
        $oldPaths = {path => "update/%platform%/%locale%/${product}-doesnotexist.partial.mar"};
        $oldPaths->{"betatest-url"} = $oldPaths->{"path"};
    }

    $currentUpdateObj->{'partials'} = {};
    for my $partialVersion (@partialVersions) {
        my $partialUpdate = {};
        $partialUpdate->{'url'} = 'http://' . $bouncerServer . '/?product=' .
                                $bouncer_product. '-' . $version . '-partial-' .
                                $partialVersion .
                                '&os=%bouncer-platform%&lang=%locale%';

        my $pPath = BumpFilePath(
          oldFilePath => $oldPaths->{'path'},
          product => $product,
          marName => $config{'marname'},
          oldMarName => $config{'oldmarname'},
          version => $version,
          oldVersion => $partialVersion
        );
        $partialUpdate->{'path'} = catfile($stage_product, 'nightly', $version .
                                '-candidates', $buildStr, $pPath);

        my $pBetatestPath = BumpFilePath(
          oldFilePath => $oldPaths->{'betatest-url'},
          product => $product,
          marName => $config{'marname'},
          oldMarName => $config{'oldmarname'},
          version => $version,
          oldVersion => $partialVersion
        );
        $partialUpdate->{'betatest-url'} =
        'http://' . $ftpServer. '/pub/' . $stage_product .
        '/nightly/' .  $version . '-candidates/' . $buildStr . '/' .
        $pBetatestPath;
        $partialUpdate->{'esrtest-url'} = $partialUpdate->{'betatest-url'};

        if ($useBetaChannel) {
        my $pBetaPath;
        if (defined($oldPaths->{'beta-url'})) {
            $pBetaPath = BumpFilePath(
              oldFilePath => $oldPaths->{'beta-url'},
              product => $product,
              marName => $config{'marname'},
              oldMarName => $config{'oldmarname'},
              version => $version,
              oldVersion => $partialVersion
            );
        } else {
            # patcher-config-creator.pl ensures this exists
            $pBetaPath = BumpFilePath(
              oldFilePath => $oldPaths->{'betatest-url'},
              product => $product,
              marName => $config{'marname'},
              oldMarName => $config{'oldmarname'},
              version => $version,
              oldVersion => $partialVersion
            );
        }
        $partialUpdate->{'beta-url'} =
        'http://' . $ftpServer . '/pub/' . $stage_product. '/nightly/' .
            $version . '-candidates/' . $buildStr . '/' . 
            $pBetaPath;
        }
        $currentUpdateObj->{'partials'}{$partialVersion} = $partialUpdate;
    }

    # Now the same thing, only complete update
    my $completeUpdate = {};
    $completeUpdate->{'url'} = 'http://' . $bouncerServer . '/?product=' .
     $bouncer_product . '-' . $version . 
     '-complete&os=%bouncer-platform%&lang=%locale%';

    my $cPath = BumpFilePath(
      oldFilePath => $currentUpdateObj->{'complete'}->{'path'},
      product => $product,
      marName => $config{'marname'},
      oldMarName => $config{'oldmarname'},
      version => $version,
      oldVersion => $oldVersion
    );
    $completeUpdate->{'path'} = catfile($stage_product, 'nightly', $version . 
     '-candidates', $buildStr, $cPath);

    my $cBetatestPath = BumpFilePath(
      oldFilePath => $currentUpdateObj->{'complete'}->{'betatest-url'},
      product => $product,
      marName => $config{'marname'},
      oldMarName => $config{'oldmarname'},
      version => $version,
      oldVersion => $oldVersion
    );
    $completeUpdate->{'betatest-url'} = 
     'http://' . $ftpServer . '/pub/' . $stage_product .
     '/nightly/' .  $version . '-candidates/' . $buildStr . '/' .
     $cBetatestPath;
    $completeUpdate->{'esrtest-url'} = $completeUpdate->{'betatest-url'};

    if ($useBetaChannel) {
       my $cBetaPath;
       if (defined($currentUpdateObj->{'complete'}->{'beta-url'})) {
         $cBetaPath = BumpFilePath(
           oldFilePath => $currentUpdateObj->{'complete'}->{'beta-url'},
           product => $product,
           marName => $config{'marname'},
           oldMarName => $config{'oldmarname'},
           version => $version,
           oldVersion => $oldVersion
         );
       } else {
         # patcher-config-creator.pl ensures this exists
         $cBetaPath = BumpFilePath(
           oldFilePath => $currentUpdateObj->{'complete'}->{'betatest-url'},
           product => $product,
           marName => $config{'marname'},
           oldMarName => $config{'oldmarname'},
           version => $version,
           oldVersion => $oldVersion
         );
       }
       $completeUpdate->{'beta-url'} = 
        'http://' . $ftpServer . '/pub/' . $stage_product. '/nightly/' .
        $version . '-candidates/' . $buildStr .  '/' . $cBetaPath;
    }
    $currentUpdateObj->{'complete'} = $completeUpdate;

    # Now, add the new <release> stanza for the release we're working on

    $appObj->{'release'}->{$version} = GetReleaseBlock(
        version => $version,
        appVersion => $appVersion,
        prettyVersion => $prettyVersion,
        product => $product,
        stage_product => $stage_product,
        buildstr => $buildStr,
        ftpServer => $ftpServer,
        localeInfo => $localeInfo,
        platforms => $platforms,
        schema => $schema,
        marChannelIds => \@marChannelIds,
    );

    $patcherConfigObj->save_file($patcherConfig);
}
