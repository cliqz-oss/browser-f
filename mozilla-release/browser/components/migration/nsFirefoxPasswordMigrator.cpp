/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* Cliqz GmbH */

#include "nsFirefoxPasswordMigrator.h"
#include "nsString.h"
#include "base/file_path.h"
#include "base/command_line.h"

NS_IMPL_ISUPPORTS(nsFirefoxPasswordMigrator, nsIFirefoxPasswordMigrator)

nsFirefoxPasswordMigrator::nsFirefoxPasswordMigrator()
    : m_inited(false)
    , m_failed(false)
{}

nsFirefoxPasswordMigrator::~nsFirefoxPasswordMigrator() {
}

NS_IMETHODIMP nsFirefoxPasswordMigrator::Init(const nsAString& aProfileDir, bool *retval) {
  NS_ENSURE_ARG_POINTER(retval);
  *retval = false;

#ifdef XP_WIN
  SECURITY_ATTRIBUTES saAttr;
  saAttr.nLength = sizeof(SECURITY_ATTRIBUTES);
  saAttr.bInheritHandle = TRUE;
  saAttr.lpSecurityDescriptor = NULL;
  HANDLE hChildStd_OUT_Rd, hChildStd_OUT_Wr, hChildStd_IN_Rd, hChildStd_IN_Wr;

  if (!CreatePipe(&hChildStd_OUT_Rd, &hChildStd_OUT_Wr, &saAttr, 0))
    return NS_ERROR_FAILURE;
  m_stdOutRd.Set(hChildStd_OUT_Rd);
  m_stdOutWr.Set(hChildStd_OUT_Wr);

  // Ensure the read handle to the pipe for STDOUT is not inherited.
  if (!SetHandleInformation(m_stdOutRd.Get(), HANDLE_FLAG_INHERIT, 0))
    return NS_ERROR_FAILURE;

  // Create a pipe for the child process's STDIN.
  if (!CreatePipe(&hChildStd_IN_Rd, &hChildStd_IN_Wr, &saAttr, 0))
    return NS_ERROR_FAILURE;
  m_stdInRd.Set(hChildStd_IN_Rd);
  m_stdInWr.Set(hChildStd_IN_Wr);

  // Ensure the write handle to the pipe for STDIN is not inherited.
  if (!SetHandleInformation(m_stdInWr.Get(), HANDLE_FLAG_INHERIT, 0))
    return NS_ERROR_FAILURE;

  FilePath exePath;
  wchar_t exePathBuf[256];
  ::GetModuleFileNameW(nullptr, exePathBuf, 256);
  exePath = FilePath::FromWStringHack(exePathBuf);
  CommandLine cmdLine(exePath.ToWStringHack());
  cmdLine.AppendLooseValue(L"-migratepwdff");
  nsString path(aProfileDir);
  cmdLine.AppendLooseValue(path.get());

  PROCESS_INFORMATION piProcInfo;
  STARTUPINFO siStartInfo;
  BOOL bSuccess = FALSE;

  // Set up members of the PROCESS_INFORMATION structure.
  ZeroMemory(&piProcInfo, sizeof(PROCESS_INFORMATION));

  // Set up members of the STARTUPINFO structure.
  // This structure specifies the STDIN and STDOUT handles for redirection.
  ZeroMemory(&siStartInfo, sizeof(STARTUPINFO));
  siStartInfo.cb = sizeof(STARTUPINFO);
  siStartInfo.hStdOutput = m_stdOutWr.Get();
  siStartInfo.hStdInput = m_stdInRd.Get();
  siStartInfo.dwFlags |= STARTF_USESTDHANDLES;

  // Create the child process.
  bSuccess = CreateProcess(NULL,
    const_cast<wchar_t*>(cmdLine.command_line_string().c_str()),
    NULL,          // process security attributes
    NULL,          // primary thread security attributes
    TRUE,          // handles are inherited
    0,             // creation flags
    NULL,          // use parent's environment
    NULL,          // use parent's current directory
    &siStartInfo,  // STARTUPINFO pointer
    &piProcInfo);  // receives PROCESS_INFORMATION
  if (!bSuccess)
    return NS_ERROR_FAILURE;
  else {
    m_stdOutWr.Set(INVALID_HANDLE_VALUE);
    m_stdInRd.Set(INVALID_HANDLE_VALUE);
    CloseHandle(piProcInfo.hProcess);
    CloseHandle(piProcInfo.hThread);
  }

  m_inited = true;
  *retval = true;
#endif

  return NS_OK;
}

NS_IMETHODIMP nsFirefoxPasswordMigrator::Decrypt(const nsACString& encryptedBase64Text, /*out*/ nsACString& decryptedText) {
  if (!m_inited || m_failed)
    return NS_OK;

#ifdef XP_WIN
  DWORD dwWrite = 0;
  DWORD dwRead = 0;
  const int BUFSIZE = 4096;
  CHAR chBuf[BUFSIZE];

  nsCString encrypted(encryptedBase64Text);
  if (encrypted.get() && encryptedBase64Text.Length()) {
    bool bSuccess = WriteFile(m_stdInWr.Get(), encrypted.get(), encrypted.Length(), &dwWrite, NULL);
    if (bSuccess && dwWrite > 0) {
      bSuccess = ReadFile(m_stdOutRd.Get(), chBuf, BUFSIZE, &dwRead, NULL);
      if (bSuccess && dwRead > 2) {
        decryptedText.Append(&chBuf[1], dwRead-2); // because of wrapped {}
      }
    }
    
    if (!bSuccess)
      // one of ReadFile or WriteFile failed - so problem with communication thrue pipes, 
      // must not be used anymore
      m_failed = true;
  }
#endif
  return NS_OK;
}
