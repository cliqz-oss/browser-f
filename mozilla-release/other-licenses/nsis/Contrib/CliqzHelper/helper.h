// Copyright (c) 2016 Cliqz GmbH. All rights reserved.
// Author: Alexander Komarnitskiy <alexander@cliqz.com>

#ifndef helper_h
#define helper_h

#include <string>
#include <windows.h>

typedef DWORD ProcessId;
typedef HANDLE ProcessHandle;
typedef HANDLE UserTokenHandle;

ProcessId GetParentProcessId(ProcessId pid);
std::wstring GetProcessCommandline(ProcessId pid);
std::wstring GetProcessFilename(ProcessId pid);

#endif  // helper_h
