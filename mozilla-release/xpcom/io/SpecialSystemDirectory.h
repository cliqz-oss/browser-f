/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef _SPECIALSYSTEMDIRECTORY_H_
#define _SPECIALSYSTEMDIRECTORY_H_

#include "nscore.h"
#include "nsIFile.h"

#ifdef MOZ_WIDGET_COCOA
#include "nsILocalFileMac.h"
#include "prenv.h"
#endif

enum SystemDirectories {
  OS_DriveDirectory         =   1,
  OS_TemporaryDirectory     =   2,
  OS_CurrentProcessDirectory =  3,
  OS_CurrentWorkingDirectory =  4,
  XPCOM_CurrentProcessComponentDirectory = 5,
  XPCOM_CurrentProcessComponentRegistry =  6,

  Moz_BinDirectory          =   100,
  Mac_SystemDirectory       =   101,
  Mac_DesktopDirectory      =   102,
  Mac_TrashDirectory        =   103,
  Mac_StartupDirectory      =   104,
  Mac_ShutdownDirectory     =   105,
  Mac_AppleMenuDirectory    =   106,
  Mac_ControlPanelDirectory =   107,
  Mac_ExtensionDirectory    =   108,
  Mac_FontsDirectory        =   109,
  Mac_ClassicPreferencesDirectory =   110,
  Mac_DocumentsDirectory          =   111,
  Mac_InternetSearchDirectory     =   112,
  Mac_DefaultDownloadDirectory    =   113,
  Mac_UserLibDirectory      =   114,
  Mac_PreferencesDirectory  =   115,

  Win_SystemDirectory       =   201,
  Win_WindowsDirectory      =   202,
  Win_HomeDirectory         =   203,
  Win_Desktop               =   204,
  Win_Programs              =   205,
  Win_Controls              =   206,
  Win_Printers              =   207,
  Win_Personal              =   208,
  Win_Favorites             =   209,
  Win_Recent                =   210,
  Win_Sendto                =   211,
  Win_Bitbucket             =   212,
  Win_Desktopdirectory      =   213,
  Win_Drives                =   214,
  Win_Network               =   215,
  Win_Nethood               =   216,
  Win_Fonts                 =   217,
  Win_Templates             =   218,
  Win_Common_Programs       =   219,
  Win_Common_Desktopdirectory = 220,
  Win_Appdata               =   221,
  Win_Printhood             =   222,
  Win_Cookies               =   223,
  Win_LocalAppdata          =   224,
  Win_ProgramFiles          =   225,
  Win_Downloads             =   226,
  Win_Common_AppData        =   227,
  Win_Documents             =   228,
  Win_Pictures              =   229,
  Win_Music                 =   230,
  Win_Videos                =   231,
#if defined(MOZ_CONTENT_SANDBOX)
  Win_LocalAppdataLow       =   232,
#endif

  Unix_LocalDirectory       =   301,
  Unix_LibDirectory         =   302,
  Unix_HomeDirectory        =   303,
  Unix_XDG_Desktop          =   304,
  Unix_XDG_Documents        =   305,
  Unix_XDG_Download         =   306,
  Unix_XDG_Music            =   307,
  Unix_XDG_Pictures         =   308,
  Unix_XDG_PublicShare      =   309,
  Unix_XDG_Templates        =   310,
  Unix_XDG_Videos           =   311
};

nsresult
GetSpecialSystemDirectory(SystemDirectories aSystemSystemDirectory,
                          nsIFile** aFile);
#ifdef MOZ_WIDGET_COCOA
nsresult
GetOSXFolderType(short aDomain, OSType aFolderType, nsIFile** aLocalFile);
#endif

#endif
