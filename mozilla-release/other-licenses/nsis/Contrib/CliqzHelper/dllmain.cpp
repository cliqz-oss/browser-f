// Copyright (c) 2017 Cliqz GmbH. All rights reserved.
// Author: Alexander Komarnitskiy <alexander@cliqz.com>

#include <shlobj.h>
#include <windows.h>
#include <time.h>

#include "installer_tagdata.h"
#include "helper.h"

// Taken from NSIS
typedef struct _stack_t {
  struct _stack_t *next;
  TCHAR text[1]; // this should be the length of string_size
} stack_t;

int popstring(stack_t **stacktop, TCHAR *str, int len) {
  // Removes the element from the top of the stack and puts it in the buffer
  stack_t *th;
  if (!stacktop || !*stacktop) {
    return 1;
  }

  th = (*stacktop);
  lstrcpyn(str, th->text, len);
  *stacktop = th->next;
  GlobalFree((HGLOBAL)th);
  return 0;
}

void SaveToRegistry(const std::wstring& path,
                    const std::wstring& value,
                    int outdate_time) {
  time_t now = time(nullptr);
  bool outdated = true;  // replace/remove data by default

  HKEY regkey = NULL;
  if (::RegCreateKeyEx(HKEY_LOCAL_MACHINE, path.c_str(), 0, NULL, 
                       REG_OPTION_NON_VOLATILE, KEY_ALL_ACCESS, 
                       NULL, &regkey, NULL) == ERROR_SUCCESS) {
    DWORD saved_time = 0;
    DWORD byte_length = sizeof(saved_time);
    if (::RegGetValue(regkey, L"", L"CliqzBrandInfoTime", RRF_RT_REG_DWORD,
                      NULL, reinterpret_cast<BYTE*>(&saved_time), 
                      &byte_length) == ERROR_SUCCESS) {
      if (now - saved_time > 0 &&
          now - saved_time <= outdate_time) {
        outdated = false;
      }
    }

    if (outdated) {
      if (value.length()) {
        ::RegSetValueEx(regkey, L"CliqzBrandInfo", 0, REG_SZ,
                        reinterpret_cast<const BYTE*>(&value[0]),
                        (value.length() + 1) * sizeof(wchar_t));
        DWORD save_time = now;
        ::RegSetValueEx(regkey, L"CliqzBrandInfoTime", 0, REG_DWORD,
                        reinterpret_cast<const BYTE*>(&save_time),
                        sizeof(save_time));
      } 
      else {
        ::RegDeleteKeyValue(regkey, L"", L"CliqzBrandInfo");
        ::RegDeleteKeyValue(regkey, L"", L"CliqzBrandInfoTime");
      }
    }
    ::RegCloseKey(regkey);
  }
}

// Try to find data in tagged area in current or one of parent's processes.
// If data exist - save it to registry. Also need to check existing data for 
// outdating.
// Expecting two parameters:
//  param1 - path to save in registry (always HKLM).
//  param2 - timeout (in second) when existing data is outdated.
extern "C" void __declspec(dllexport) saveTaggedParams(HWND hwndParent,
                                                       int string_size,
                                                       TCHAR *variables,
                                                       stack_t **stacktop,
                                                       void *extra) {
#ifdef _DEBUG
  MessageBox(hwndParent, L"1", L"2", MB_OK);
#endif
  // Two parameters must be passed from NSIS installer - registry path
  // and "outdate time"
  TCHAR reg_path[1024] = { 0 };
  popstring(stacktop, reg_path, 1024);
  TCHAR outdate[32] = { 0 };
  popstring(stacktop, outdate, 32);

  // When installer works, the processes tree can have different look.
  // With UAC:
  //  CLIQZ-43.0.4.en-US.win32.installer.exe
  //  \_setup.exe
  //    \_setup.exe
  // Without UAC:
  //  CLIQZ-43.0.4.en-US.win32.installer.exe
  //  \_setup.exe
  // Let's go process by process up, until find a process with 
  // tag information in it (or go out without find anything).
  ProcessId pid = ::GetCurrentProcessId(); // start with current process
  bool tag_found = false;
  do {
    InstallerTagData::Reset();
    tag_found = InstallerTagData::Init(GetProcessFilename(pid));
    pid = GetParentProcessId(pid);
  } while (pid != 0 && !tag_found);

  std::wstring tag_data;
  if (tag_found) {
    std::string value = InstallerTagData::ForCurrentProcess()->GetAllParams();
    tag_data.assign(value.begin(), value.end());
  }

  SaveToRegistry(reg_path, tag_data, _wtoi(outdate));
}

BOOL APIENTRY DllMain(HMODULE hModule, 
                      DWORD ul_reason_for_call, 
                      LPVOID lpReserved) {
  return TRUE;
}
