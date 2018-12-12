/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifndef nsFirefoxPasswordMigrator_h__
#define nsFirefoxPasswordMigrator_h__

#include "nsIFirefoxPasswordMigrator.h"

#ifdef XP_WIN
#include <windows.h>

class THandler {
public:
  THandler() : m_handle(INVALID_HANDLE_VALUE) {}

  ~THandler() {
    if (m_handle != INVALID_HANDLE_VALUE)
      CloseHandle(m_handle);
  }
  
  THandler(THandler const&) = delete;
  THandler& operator=(THandler const&) = delete;
  
  void Set(HANDLE handle) {
    if (handle == m_handle)
      return;
    if (m_handle != INVALID_HANDLE_VALUE)
      CloseHandle(m_handle);
    m_handle = handle;
  }
  HANDLE Get() {return m_handle;}

private:
  HANDLE m_handle;
};
#endif

#define NS_FIREFOXPASSWORDMIGRATOR_CID \
  { 0Xe241c6e9, 0X07ab, 0X4d93, \
  { 0Xa3, 0X6a, 0X5b, 0X27, 0X0b, 0X57, 0X8a, 0X7e } }
#define NS_FIREFOXPASSWORDMIGRATOR_CONTRACTID "@mozilla.org/profile/ff-pass-migrator;1"

class nsFirefoxPasswordMigrator final : public nsIFirefoxPasswordMigrator
{
public:
  NS_DECL_NSIFIREFOXPASSWORDMIGRATOR
  NS_DECL_ISUPPORTS
  nsFirefoxPasswordMigrator();

private:
  virtual ~nsFirefoxPasswordMigrator();
  
  bool m_inited;
  bool m_failed;
#ifdef XP_WIN
  THandler m_stdInRd, m_stdInWr, m_stdOutRd, m_stdOutWr;
#endif 
};

#endif /* !nsFirefoxPasswordMigrator_h__ */
