/* Cliqz GmbH */

// works only on Windows now
#ifdef XP_WIN
#include "nsAppRunner.h"
#include "ScopedNSSTypes.h"
#include "mozilla/Base64.h"
#include "mozilla/Casting.h"
#include "mozilla/Services.h"
#include "mozilla/ErrorResult.h"
#include "mozilla/dom/Promise.h"
#include "nsCOMPtr.h"
#include "nsIInterfaceRequestor.h"
#include "nsIInterfaceRequestorUtils.h"
#include "nsIObserverService.h"
#include "nsIServiceManager.h"
#include "nsITokenPasswordDialogs.h"
#include "nsNSSComponent.h"
#include "nsNSSHelper.h"
#include "pk11func.h"
#include "pk11sdr.h" // For PK11SDR_Encrypt, PK11SDR_Decrypt
#include "ssl.h" // For SSL_ClearSessionCache
#include "nss.h"

using namespace mozilla;

SECStatus InitializeNSS(const char* dir) {
  uint32_t flags = NSS_INIT_NOROOTINIT | NSS_INIT_OPTIMIZESPACE;
  nsAutoCString dbTypeAndDirectory("sql:");
  dbTypeAndDirectory.Append(dir);
  SECStatus srv = NSS_Initialize(dbTypeAndDirectory.get(), "", "", SECMOD_DB, flags);
  if (srv != SECSuccess) {
    return srv;
  }

  UniquePK11SlotInfo slot(PK11_GetInternalKeySlot());
  if (!slot) {
    return SECFailure;
  }

  // If the key DB doesn't have a password set, PK11_NeedUserInit will return
  // true. For the SQL DB, we need to set a password or we won't be able to
  // import any certificates or change trust settings.
  if (PK11_NeedUserInit(slot.get())) {
    srv = PK11_InitPin(slot.get(), nullptr, nullptr);
    MOZ_ASSERT(srv == SECSuccess);
    Unused << srv;
  }

  return SECSuccess;
}

nsresult Decrypt(const nsACString& data, /*out*/ nsACString& result)
{
  /* Find token with SDR key */
  UniquePK11SlotInfo slot(PK11_GetInternalKeySlot());
  if (!slot) {
    return NS_ERROR_NOT_AVAILABLE;
  }

  /* Force authentication */
  if (PK11_Authenticate(slot.get(), true, 0) != SECSuccess) {
    return NS_ERROR_NOT_AVAILABLE;
  }

  SECItem request;
  request.data = BitwiseCast<unsigned char*, const char*>(data.BeginReading());
  request.len = data.Length();
  ScopedAutoSECItem reply;
  if (PK11SDR_Decrypt(&request, &reply, 0) != SECSuccess) {
    return NS_ERROR_FAILURE;
  }

  result.Assign(BitwiseCast<char*, unsigned char*>(reply.data), reply.len);
  return NS_OK;
}

nsresult DecryptString(const nsACString& encryptedBase64Text, /*out*/ nsACString& decryptedText) {
  nsAutoCString encryptedText;
  nsresult rv = Base64Decode(encryptedBase64Text, encryptedText);
  if (NS_FAILED(rv)) {
    return rv;
  }

  rv = Decrypt(encryptedText, decryptedText);
  if (NS_FAILED(rv)) {
    return rv;
  }

  return NS_OK;
}
#endif

void ServiceMigratePasswordsFromFF(int gArgc, char **gArgv) {
  if (gArgc<2)
    return;

#ifdef XP_WIN
  HANDLE hStdin = NULL, hStdout = NULL;
  const int BUFSIZE = 4096;
  hStdout = GetStdHandle(STD_OUTPUT_HANDLE);
  hStdin = GetStdHandle(STD_INPUT_HANDLE);
  if ((hStdout == INVALID_HANDLE_VALUE) || (hStdin == INVALID_HANDLE_VALUE))
    return;

  if (InitializeNSS(gArgv[1]) == SECSuccess) {
    bool bSuccess;
    char chBuf[BUFSIZE];
    DWORD dwRead, dwWritten;

    for (;;) {
      // Read from standard input and stop on error or no data.
      bSuccess = ReadFile(hStdin, chBuf, BUFSIZE, &dwRead, NULL);

      if (!bSuccess || dwRead == 0)
        break;

      nsCString encryptedBase64Text, decryptedText;
      encryptedBase64Text.Append(&chBuf[0], dwRead);
      nsCString result("{");
      if (DecryptString(encryptedBase64Text, decryptedText) == NS_OK) {
        result.Append(decryptedText);
      }
      result.Append("}");
      bSuccess = WriteFile(hStdout, result.get(), result.Length(), &dwWritten, NULL);

      if (!bSuccess)
        break;
    }
  }

  CloseHandle(hStdout);
  CloseHandle(hStdin);
#endif

  return;
}
