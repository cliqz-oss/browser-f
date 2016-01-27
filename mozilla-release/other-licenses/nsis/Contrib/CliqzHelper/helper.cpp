// Copyright (c) 2016 Cliqz GmbH. All rights reserved.
// Author: Alexander Komarnitskiy <alexander@cliqz.com>

#include "helper.h"

#include <windows.h>
#include <tlhelp32.h>

#ifndef _NTDEF_
  typedef LONG NTSTATUS, *PNTSTATUS;
#endif  // _NTDEF_

typedef HANDLE ProcessHandle;
typedef DWORD ProcessId;
typedef HANDLE UserTokenHandle;

struct ProcessEntry : public PROCESSENTRY32 {
  ProcessId pid() const {return th32ProcessID;}
  ProcessId parent_pid() const {return th32ParentProcessID;}
  const wchar_t* exe_file() const {return szExeFile;}
};

ProcessId GetParentProcessId(ProcessId procid) {
  ProcessId parent = 0;
  HANDLE hProcessSnap;
  PROCESSENTRY32 pe32;

  // Take a snapshot of all processes in the system.
  hProcessSnap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (hProcessSnap != INVALID_HANDLE_VALUE) {
    // Set the size of the structure before using it.
    pe32.dwSize = sizeof(PROCESSENTRY32);

    // Retrieve information about the first process,
    // and exit if unsuccessful
    if (Process32First(hProcessSnap, &pe32)) {
      // Now walk the snapshot of processes, and
      // display information about each process in turn
      do {
        if (pe32.th32ProcessID == procid) {
          parent = pe32.th32ParentProcessID;
        }
      } while (Process32Next(hProcessSnap, &pe32));
    }
    CloseHandle(hProcessSnap);
  }

  return parent;
}

// http://wj32.org/wp/2009/01/24/howto-get-the-command-line-of-processes/
typedef NTSTATUS(NTAPI *_NtQueryInformationProcess)(
  HANDLE ProcessHandle,
  DWORD ProcessInformationClass,
  PVOID ProcessInformation,
  DWORD ProcessInformationLength,
  PDWORD ReturnLength
);

typedef struct _UNICODE_STRING {
  USHORT Length;
  USHORT MaximumLength;
  PWSTR Buffer;
} UNICODE_STRING, *PUNICODE_STRING;

typedef struct _PROCESS_BASIC_INFORMATION {
  LONG ExitStatus;
  PVOID PebBaseAddress;
  ULONG_PTR AffinityMask;
  LONG BasePriority;
  ULONG_PTR UniqueProcessId;
  ULONG_PTR ParentProcessId;
} PROCESS_BASIC_INFORMATION, *PPROCESS_BASIC_INFORMATION;

std::wstring GetParentCommandString() {
  std::wstring cmd;
  // When installer works, the processes tree looks like:
  // CLIQZ-43.0.4.en-US.win32.installer.exe
  // \_setup.exe
  //   \_setup.exe
  // So we need to go two level upper to find original installer file
  ProcessId parent_pid = GetParentProcessId(
      GetParentProcessId(::GetCurrentProcessId()));

  if (parent_pid != 0) {
    HANDLE processHandle = 0;
    PVOID rtlUserProcParamsAddress = 0;
    UNICODE_STRING commandLine;
    wchar_t* commandLineContents = 0;
    if ((processHandle = OpenProcess(
        PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
        FALSE,
        parent_pid)) != 0) {
      _NtQueryInformationProcess NtQueryInformationProcess = 0;
      NtQueryInformationProcess = (_NtQueryInformationProcess)GetProcAddress(
          GetModuleHandleA("ntdll.dll"),
          "NtQueryInformationProcess");
      if (NtQueryInformationProcess) {
        PROCESS_BASIC_INFORMATION pbi;
        NtQueryInformationProcess(processHandle, 0, &pbi, sizeof(pbi), NULL);
        // get the address of ProcessParameters
        if (pbi.PebBaseAddress &&
            ReadProcessMemory(processHandle, 
                (PCHAR)pbi.PebBaseAddress + 0x10,
                &rtlUserProcParamsAddress, 
                sizeof(PVOID), 
                NULL)) {
          // read the CommandLine UNICODE_STRING structure
          if (ReadProcessMemory(processHandle, 
              (PCHAR)rtlUserProcParamsAddress + 0x40,
              &commandLine, 
              sizeof(commandLine), 
              NULL)) {
            // allocate memory to hold the command line
            commandLineContents = new wchar_t[commandLine.Length / 2 + 1];
            // read the command line
            if (ReadProcessMemory(processHandle, commandLine.Buffer,
              commandLineContents, commandLine.Length, NULL)) {
              commandLineContents[commandLine.Length / 2] = L'\0';
              cmd = commandLineContents;
            }
          }
        }
      }
      if (processHandle)
        CloseHandle(processHandle);
      if (commandLineContents)
        delete[] commandLineContents;
    }
  }
  return cmd;
}
