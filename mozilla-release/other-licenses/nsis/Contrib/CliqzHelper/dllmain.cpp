#include <windows.h>
#include <shlobj.h>
#include <stdio.h>

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

// Read key value from parameters, try to find this key in
// tagged area of parent process, if exist - check does
// distribution file exist. If not - save information about
// brand into distribution file (in CSIDL_APPDATA\\Cliqz folder)
extern "C" void __declspec(dllexport) setBrand(HWND hwndParent,
                                               int string_size,
                                               TCHAR *variables,
                                               stack_t **stacktop) {
#ifdef _DEBUG
  MessageBox(hwndParent, L"1", L"2", MB_OK);
#endif

  // need to get parent process, because setup.exe itself placed into
  // self-extracted 7z archive (which are generally a production installer)
  std::wstring name = GetParentCommandString();
  while (name.find('\"') != std::wstring::npos)
    name.erase(name.find('\"'), 1);
  if (InstallerTagData::Init(name)) {
    TCHAR temp[8192]; // don't forget to change if change this size in createing tag area
    popstring(stacktop, temp, 8192);
    std::wstring wparam(temp);
    std::string param(wparam.begin(), wparam.end());
    std::string value = InstallerTagData::ForCurrentProcess()->GetParam(param);
    if (!value.empty()) {
      TCHAR szPath[MAX_PATH];
      if (SUCCEEDED(SHGetFolderPath(NULL, CSIDL_APPDATA | CSIDL_FLAG_CREATE, NULL, 0, szPath))) {
        wcscat_s(szPath, L"\\CLIQZ");
        SHCreateDirectory(0, szPath);
        wcscat_s(szPath, L"\\distribution");
        DWORD dwAttrib = GetFileAttributes(szPath);
        BOOL file_exist = (dwAttrib != INVALID_FILE_ATTRIBUTES) && !(dwAttrib & FILE_ATTRIBUTE_DIRECTORY);
        if (!file_exist) {
          HANDLE hFile = CreateFile(szPath, GENERIC_WRITE, 0, NULL, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, NULL);
          if (hFile != INVALID_HANDLE_VALUE) {
            std::string data = "{\"ver\": 1, \"brand\": \"";
            data += value;
            data += "\"}";
            WriteFile(hFile, &data[0], data.length(), NULL, NULL);
            CloseHandle(hFile);
          }
        }
      }
    }
  }
}

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
  return TRUE;
}