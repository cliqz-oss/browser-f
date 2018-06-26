#
# Makefile.PL - build file for Config::General
#
# Copyright (c) 2000-2007 Thomas Linden <tom@daemon.de>.
# All Rights Reserved. Std. disclaimer applies.
# Artificial License, same as perl itself. Have fun.
#

use ExtUtils::MakeMaker;

WriteMakefile(
	'NAME'	       => 'Config::General',
	'VERSION_FROM' => 'General.pm',
	'clean'        => {
				FILES                   => 't/*.out t/test.cfg *~ */*~'
			  },
	'PREREQ_PM'    => {
				'IO::File'              => 0,
				'FileHandle'            => 0,
				'File::Spec::Functions' => 0,
				'File::Glob'            => 0
			  },
	($ExtUtils::MakeMaker::VERSION ge '6.31'? 
	('LICENSE'		=> 'perl', ) : ()),
);

