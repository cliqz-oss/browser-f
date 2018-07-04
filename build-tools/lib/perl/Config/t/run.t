# -*-perl-*-
# testscript for Config::General Classes by Thomas Linden
#
# needs to be invoked using the command "make test" from
# the Config::General source directory.
#
# Under normal circumstances every test should succeed.


use Data::Dumper;
use Test::More tests => 51;
#use Test::More qw(no_plan);

# ahem, we deliver the test code with a local copy of
# the Tie::IxHash module so we can do tests on sorted
# hashes without dependency to Tie::IxHash.
use lib qw(t);
use Tie::IxHash;


### 1
BEGIN { use_ok "Config::General"};
require_ok( 'Config::General' );

### 2 - 7
foreach my $num (2..7) {
  my $cfg = "t/cfg.$num";
  open T, "<$cfg";
  my @file = <T>;
  close T;
  my $fst = $file[0];
  chomp $fst;
  $fst =~ s/\#\s*//g;
  eval {
    my $conf = new Config::General($cfg);
    my %hash = $conf->getall;
  };
  ok(!$@, "$fst");
}



### 8
my $conf = new Config::General("t/cfg.8");
my %hash = $conf->getall;
$conf->save_file("t/cfg.out");
my $copy = new Config::General("t/cfg.out");
my %copyhash = $copy->getall;
is_deeply(\%hash, \%copyhash, "Writing Config Hash to disk and compare with original");


### 9
$conf = new Config::General(
 -ExtendedAccess => 1,
 -ConfigFile     => "t/test.rc");
ok($conf, "Creating a new object from config file");


### 10
my $conf2 = new Config::General(
 -ExtendedAccess    => 1,
 -ConfigFile        => "t/test.rc",
 -AllowMultiOptions => "yes"
);
ok($conf2, "Creating a new object using the hash parameter way");


### 11
my $domain = $conf->obj("domain");
ok($domain, "Creating a new object from a block");


### 12
my $addr = $domain->obj("bar.de");
ok($addr, "Creating a new object from a sub block");


### 13
my @keys = $conf->keys("domain");
ok($#keys > -1, "Getting values from the object");


### 14
# test various OO methods
my $a;
if ($conf->is_hash("domain")) {
  my $domains = $conf->obj("domain");
  foreach my $domain ($conf->keys("domain")) {
    my $domain_obj = $domains->obj($domain);
    foreach my $address ($domains->keys($domain)) {
      $a = $domain_obj->value($address);
    }
  }
}
ok($a, "Using keys() and values()");

### 15
# test AUTOLOAD methods
eval {
  my $conf3 = new Config::General(
     -ExtendedAccess => 1,
     -ConfigHash     => { name => "Moser", prename => "Hannes"}
  );
  my $n = $conf3->name;
  my $p = $conf3->prename;
  $conf3->name("Meier");
  $conf3->prename("Max");
  $conf3->save_file("t/test.cfg");
};
ok (!$@, "Using AUTOLOAD methods");


### 16
# testing variable interpolation
my $conf16 = new Config::General(-ConfigFile => "t/cfg.16", -InterPolateVars => 1, -StrictVars => 0);
my %h16 = $conf16->getall();
if($h16{etc}->{log} eq "/usr/log/logfile" and
   $h16{etc}->{users}->{home} eq "/usr/home/max" and
   exists $h16{dir}->{teri}->{bl}) {
  pass("Testing variable interpolation");
}
else {
  fail("Testing variable interpolation");
}

### 16.a
# testing variable interpolation with %ENV use
my $env = "/home/theunexistent";
$ENV{HOME} = $env;
my $conf16a = new Config::General(-ConfigFile => "t/cfg.16a", -InterPolateVars => 1, -InterPolateEnv => 1, -StrictVars => 0);
my %h16a = $conf16a->getall();
if($h16a{etc}->{log} eq "$env/log/logfile") {
  pass("Testing environment variable interpolation");
}
else {
  fail("Testing environment variable interpolation");
}


### 17
# testing value pre-setting using a hash
my $conf17 = new Config::General(
 -file => "t/cfg.17",
 -DefaultConfig => { home => "/exports/home",
		     logs => "/var/backlog",
                     foo  => {
			       bar => "quux"
			     }
		   },
 -InterPolateVars => 1,
 -MergeDuplicateOptions => 1,
 -MergeDuplicateBlocks => 1
);
my %h17 = $conf17->getall();
ok ($h17{home} eq "/home/users" &&
    $h17{foo}{quux} eq "quux",
    "Testing value pre-setting using a hash");


### 18
# testing value pre-setting using a string
my $conf18 = new Config::General(
 -file => "t/cfg.17", # reuse the file
 -DefaultConfig => "home = /exports/home\nlogs = /var/backlog",
 -MergeDuplicateOptions => 1,
 -MergeDuplicateBlocks => 1
);
my %h18 = $conf18->getall();
ok ($h18{home} eq "/home/users", "Testing value pre-setting using a string");


### 19
# testing various otion/value assignment notations
my $conf19 = new Config::General(-file => "t/cfg.19");
my %h19 = $conf19->getall();
my $works = 1;
foreach my $key (keys %h19) {
  if ($key =~ /\s/) {
    $works = 0;
  }
}
ok ($works, "Testing various otion/value assignment notations");

### 20
# testing files() method
my $conf20 = Config::General->new(
    -file => "t/cfg.20.a",
    -MergeDuplicateOptions => 1
);
my %h20 = $conf20->getall();
my %files = map { $_ => 1 } $conf20->files();
my %expected_files = map { $_ => 1 } (
    't/cfg.20.a',
    't/cfg.20.b',
    't/cfg.20.c',
);
is_deeply (\%files, \%expected_files, "testing files() method");


### 22
# testing improved IncludeRelative option
# First try without -IncludeRelative
# this should fail
eval {
    my $conf21 = Config::General->new(
        -file => "t/sub1/sub2/sub3/cfg.sub3",
        -MergeDuplicateOptions => 1,
    );
};
ok ($@, "prevented from loading relative cfgs without -IncludeRelative");


### 23
# Now try with -IncludeRelative
# this should fail
my $conf22 = Config::General->new(
    -file => "t/sub1/sub2/sub3/cfg.sub3",
    -MergeDuplicateOptions => 1,
    -IncludeRelative       => 1,
);
my %h22 = $conf22->getall;
my %expected_h22 = (
    'sub3_seen'  => 'yup',
    'sub2_seen'  => 'yup',
    'sub2b_seen' => 'yup',
    'sub1_seen'  => 'yup',
    'sub1b_seen' => 'yup',
    'fruit'      => 'mango',
);
is_deeply(\%h22, \%expected_h22, "loaded relative to included files");


### 24
# Testing IncludeDirectories option
my $conf23 = Config::General->new(
  -String => "<<include t/sub1>>",
  -IncludeDirectories => 1
);
my %h23 = $conf23->getall;
my %expected_h23 = (
  fruit => 'mango',
  sub1_seen => 'yup',
  sub1b_seen => 'yup',
  test => 'value',
  test2 => 'value2',
  test3 => 'value3'
);
is_deeply(\%h23, \%expected_h23, "including a directory with -IncludeDirectories");


### 24
# Testing IncludeGlob option
my $conf24 = Config::General->new(
  -String => "<<include t/sub1/cfg.sub[123]{c,d,e}>>",
  -IncludeGlob => 1
);
my %h24 = $conf24->getall;
my %expected_h24 = (
  test => 'value',
  test2 => 'value2',
  test3 => 'value3'
);
is_deeply(\%h24, \%expected_h24, "including multiple files via glob pattern with -IncludeGlob");


### 25
# Testing block and block name quoting
my $conf25 = Config::General->new(
  -String => <<TEST,
<block "/">
  opt1 val1
</block>
<"block2 /">
  opt2 val2
</"block2 /">
<"block 3" "/">
  opt3 val3
</"block 3">
<block4 />
  opt4 val4
</block4>
TEST
  -SlashIsDirectory => 1
);
my %h25 = $conf25->getall;
my %expected_h25 = (
  block => { '/' => { opt1 => 'val1' } },
  'block2 /' => { opt2 => 'val2' },
  'block 3' => { '/' => { opt3 => 'val3' } },
  block4 => { '/' => { opt4 => 'val4' } }
);
is_deeply(\%h25, \%expected_h25, "block and block name quoting");


### 26
# Testing 0-value handling
my $conf26 = Config::General->new(
 -String => <<TEST,
<foo 0>
  0
</foo>
TEST
);
my %h26 = $conf26->getall;
my %expected_h26 = (
  foo => { 0 => { 0 => undef } },
);
is_deeply(\%h26, \%expected_h26, "testing 0-values in block names");



#
# look if invalid input gets rejected right
#

### 27
# testing invalid parameter calls, expected to fail
my @pt = (
	  {
	   p => {-ConfigHash => "StringNotHash"},
	   t => "-ConfigHash HASH required"
	  },
	  {
	   p => {-String => {}},
	   t => "-String STRING required"
	  },
	  {
	   p => {-ConfigFile => {}},
	   t => "-ConfigFile STRING required"
	   },
	  {
	   p => {-ConfigFile => "NoFile"},
	   t => "-ConfigFile STRING File must exist and be readable"
	   }
);
foreach my $C (@pt) {
  eval {
    my $cfg = new Config::General(%{$C->{p}});
  };
  ok ($@, "check parameter failure handling $C->{t}");
}



### 32
# check Flagbits
my $cfg28 = new Config::General(
  -String => "Mode = CLEAR | UNSECURE",
  -FlagBits => {
    Mode => {
      CLEAR    => 1,
      STRONG   => 1,
      UNSECURE => "32bit"
    }
 } );
my %cfg28 = $cfg28->getall();
is_deeply(\%cfg28,
{
 'Mode' => {
 'STRONG' => undef,
 'UNSECURE' => '32bit',
 'CLEAR' => 1
}}, "Checking -Flagbits resolving");



### 33
# checking functional interface
eval {
  my %conf = Config::General::ParseConfig(-ConfigFile => "t/test.rc");
  Config::General::SaveConfig("t/test.rc.out", \%conf);
  my %next = Config::General::ParseConfig(-ConfigFile => "t/test.rc.out");
  my @a = sort keys %conf;
  my @b = sort keys %next;
  if (@a != @b) {
    die "Re-parsed result differs from original";
  }
};
ok(! $@, "Testing functional interface $@");



### 34
# testing -AutoTrue
my $cfg34 = new Config::General(-AutoTrue => 1, -ConfigFile => "t/cfg.34");
my %cfg34 = $cfg34->getall();
my %expect34 = (
		'a' => {
			'var6' => 0,
			'var3' => 1,
			'var1' => 1,
			'var4' => 0,
			'var2' => 1,
			'var5' => 0
		       },
		'b' => {
			'var6' => 0,
			'var3' => 1,
			'var1' => 1,
			'var4' => 0,
			'var2' => 1,
			'var5' => 0
		       }
	       );
is_deeply(\%cfg34, \%expect34, "Using -AutoTrue");



### 35
# testing -SplitPolicy
my %conf35 = Config::General::ParseConfig(
  -String =>
   qq(var1 :: alpha
      var2 :: beta
      var3 =  gamma  # use wrong delimiter by purpose),
  -SplitPolicy => 'custom',
  -SplitDelimiter => '\s*::\s*'
);
my %expect35 = (
		'var3 =  gamma' => undef,
		'var1' => 'alpha',
		'var2' => 'beta'
	      );
is_deeply(\%conf35, \%expect35, "Using -SplitPolicy and custom -SplitDelimiter");



### Include both
my $conf36 = Config::General->new( -ConfigFile => "t/dual-include.conf", 
                                 -IncludeAgain => 1 );
my %C36 = $conf36->getall;
is_deeply( \%C36, { bit => { one => { honk=>'bonk' }, 
                           two => { honk=>'bonk' } 
                }        }, "Included twice" );


### Include once
diag "\nPlease ignore the following message about IncludeAgain";
my $conf37 = Config::General->new( "t/dual-include.conf" );
my %C37 = $conf37->getall;
is_deeply( \%C37, { bit => { one => { honk=>'bonk' }, 
                           two => {} 
                }        }, "Included once-only" );


### apache-style Include 
my $conf38 = Config::General->new( -ConfigFile => "t/apache-include.conf", 
                              -IncludeAgain => 1,
                              -UseApacheInclude => 1 );
my %C38 = $conf38->getall;
is_deeply( \%C38, { bit => { one => { honk=>'bonk' }, 
                           two => { honk=>'bonk' } 
                }        }, "Apache-style include" );

#### 39 verifies bug rt#27225
# testing variable scope.
# a variable shall resolve to the value defined in the current
# scope, not a previous outer scope.
my $conf39 = new Config::General(-ConfigFile => "t/cfg.39", -InterPolateVars => 1, -StrictVars => 0);
my %conf39 = $conf39->getall();
isnt($conf39{outer}->{b1}->{inner}->{ivar},
     $conf39{outer}->{b2}->{inner}->{ivar},
     "Variable scope test");

### 40 - 42 verify if structural error checks are working
foreach my $pos (40 .. 43) {
  eval {
    my $conf = new Config::General(-ConfigFile => "t/cfg.$pos");
  };
  ok($@ =~ /^Config::General/, "$pos: Structural error checks");
}

my $conf44;
eval {
   $conf44 = new Config::General(-String => [ 'foo bar' ]);
};
ok(! $@, "-String arrayref");
is_deeply({ $conf44->getall }, { foo => 'bar' }, "-String arrayref contents");



# verifies bug rt#35122
my $conf45 = new Config::General(-ConfigFile => "t/cfg.45", -InterPolateVars => 1, -StrictVars => 0);
my %conf45 = $conf45->getall();
my $expect45 = {
		'block1' => {
			     'param5' => 'value3',
			     'param4' => 'value1',
			     'param2' => 'value3'
			    },
		'block2' => {
			     'param7' => 'value2',
			     'param6' => 'value1'
			    },
		'param2' => 'value2',
		'param1' => 'value1'
	       };
is_deeply($expect45, \%conf45, "Variable precedence");

# verifies bug rt#35766
my $conf46 = new Config::General(-ConfigFile => "t/cfg.46", -InterPolateVars => 1, -StrictVars => 0);
my %conf46 = $conf46->getall();
my $expect46 = {
		 'blah' => 'blubber',
		 'test' => 'bar \'variable $blah should be kept\' and \'$foo too\'',
		 'foo' => 'bar'
		};
is_deeply($expect46, \%conf46, "Variables inside single quotes");


# complexity test
# check the combination of various features
my $conf47 = new Config::General(
				 -ConfigFile => "t/complex.cfg",
				 -InterPolateVars => 1,
				 -DefaultConfig => { this => "that", default => "imported" },
				 -MergeDuplicateBlocks => 1,
				 -MergeDuplicateOptions => 1,
				 -StrictVars => 1,
				 -SplitPolicy => 'custom',
				 -SplitDelimiter => '\s*=\s*',
				 -IncludeGlob => 1,
				 -IncludeAgain => 1,
				 -IncludeRelative => 1,
				 -AutoTrue => 1,
				 -FlagBits => { someflags => { LOCK => 1, RW => 2, TAINT => 3 } },
				 -StoreDelimiter => ' = ',
				 -SlashIsDirectory => 1,
				 -SaveSorted => 1
				);
my %conf47 = $conf47->getall();
my $expect47 = {
          'var3' => 'blah',
          'z1' => {
                    'blak' => '11111',
                    'nando' => '9999'
                  },
          'a' => {
                   'b' => {
                            'm' => {
                                     '9323' => {
                                                 'g' => '000',
                                                 'long' => 'another long line'
                                               }
                                   },
                            'x' => '9323',
                            'z' => 'rewe'
                          }
                 },
          'onflag' => 1,
          'var2' => 'zeppelin',
          'ignore' => '\\$set',
          'quote' => 'this should be \'kept: $set\' and not be \'$set!\'',
          'x5' => {
                    'klack' => '11111'
                  },
          'set' => 'blah',
          'line' => 'along line',
          'this' => 'that',
          'imported' => 'got that from imported config',
		'someflags' => {
                           'RW' => 2,
                           'LOCK' => 1,
                           'TAINT' => 3
                         },
          'var1' => 'zero',
          'offflag' => 0,
          'cmd' => 'mart@gw.intx.foo:22',
          'default' => 'imported',
          'host' => 'gw.intx.foo',
          'nando' => '11111',
          'auch ätzendes' => 'muss gehen',
          'Directory' => {
                           '/' => {
                                    'mode' => '755'
                                  }
                         },
          'hansa' => {
                       'z1' => {
                                 'blak' => '11111',
                                 'nando' => '9999'
                               },
                       'Directory' => {
                                        '/' => {
                                                 'mode' => '755'
                                               }
                                      },
                       'block' => {
                                    '0' => {
                                             'value' => 0
                                           }
                                  },
                       'x5' => {
                                 'klack' => '11111'
                               },
                       'Files' => {
                                    '~/*.pl' => {
                                                  'Options' => '+Indexes'
                                                }
                                  },
                       'nando' => '11111'
                     },
          'block' => {
                       '0' => {
                                'value' => 0
                              }
                     },
          'Files' => {
                       '~/*.pl' => {
                                     'Options' => '+Indexes'
                                   }
                     },
          'a [[weird]] heredoc' => 'has to
  work
  too!'
};

is_deeply($expect47, \%conf47, "complexity test");

# check if sorted save works
$conf47->save_file("t/complex.out", \%conf47);
open T, "<t/complex.out";
my $got47 = join '', <T>;
close T;
my $sorted = qq(
imported = got that from imported config
line = along line
nando = 11111
offflag = 0
onflag = 1);
if ($got47 =~ /\Q$sorted\E/) {
  pass("Testing sorted save");
}
else {
  fail("Testing sorted save");
}



tie my %hash48, "Tie::IxHash";
my $ostr48 =
"zeppelin   1
beach   2
anathem   3
mercury   4\n";
my $cfg48 = new Config::General(
    -String => $ostr48,
    -Tie => "Tie::IxHash"
   );
%hash48 = $cfg48->getall();
my $str48 = $cfg48->save_string(\%hash48);
is( $str48, $ostr48, "tied hash test");
