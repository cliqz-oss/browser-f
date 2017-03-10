// Copyright (c) 2016 Cliqz GmbH. All rights reserved.
// Author: Alexander Komarnitskiy <alexander@cliqz.com>

#include <shlobj.h>
#include <windows.h>

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

// Try to find data in tagged area in current or one of parent's processes.
// If data exist, check does distribution file already exist.
// If not - save all data from tagged area to distribution file 
// (in CSIDL_APPDATA\\Cliqz folder)
extern "C" void __declspec(dllexport) saveTaggedParams(HWND hwndParent,
                                                       int string_size,
                                                       TCHAR *variables,
                                                       stack_t **stacktop) {
#ifdef _DEBUG
  MessageBox(hwndParent, L"1", L"2", MB_OK);
#endif

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

  if (tag_found) {
    // One parameters must be passed from NSIS installer - installation directory
    TCHAR install_dir[MAX_PATH] = {0};
    popstring(stacktop, install_dir, MAX_PATH);
    std::string value = InstallerTagData::ForCurrentProcess()->GetAllParams();
    if (install_dir[0]!='\0' && !value.empty()) {
      wcscat_s(install_dir, L"\\defaults\\pref");
      SHCreateDirectory(0, install_dir);
      wcscat_s(install_dir, L"\\distribution.js");
      DWORD dwAttrib = GetFileAttributes(install_dir);
      BOOL file_exist = (dwAttrib != INVALID_FILE_ATTRIBUTES) 
          && !(dwAttrib & FILE_ATTRIBUTE_DIRECTORY);
      if (!file_exist) {
        HANDLE hFile = CreateFile(install_dir, GENERIC_WRITE, 0, NULL, CREATE_NEW,
                                  FILE_ATTRIBUTE_NORMAL, NULL);
        if (hFile != INVALID_HANDLE_VALUE) {
          std::string data = "pref(\"extensions.cliqz.full_distribution\", \"";
          data += value;
          data += "\");";
          DWORD written = 0;
          WriteFile(hFile, &data[0], data.length(), &written, NULL);
          CloseHandle(hFile);
        }
      }
    }
  }
}

BOOL APIENTRY DllMain(HMODULE hModule, 
                      DWORD ul_reason_for_call, 
                      LPVOID lpReserved) {
  return TRUE;
}
