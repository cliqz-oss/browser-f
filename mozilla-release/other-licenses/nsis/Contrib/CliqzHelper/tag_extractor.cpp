// Copyright 2005-2009 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
// ========================================================================
#include "tag_extractor.h"

#include <algorithm>
#include <windows.h>
#include <wintrust.h>

#define ARCH_CPU_X86 1

namespace omaha {

#define AFFILIATE_ID_MAGIC        "Gact2.0Omaha"
#define AFFILIATE_ID_MAGIC_LENGTH (arraysize(AFFILIATE_ID_MAGIC) - 1)

typedef unsigned short     uint16;

// The arraysize(arr) macro returns the # of elements in an array arr.
// Moved from omaha/base/basictypes.h
template <typename T, size_t N>
char (&ArraySizeHelper(T (&array)[N]))[N];
#define arraysize(array) (sizeof(ArraySizeHelper(array)))

TagExtractor::TagExtractor()
  : file_handle_(INVALID_HANDLE_VALUE),
    file_mapping_(NULL),
    file_base_(NULL),
    file_length_(0),
    cert_dir_length_(0),
    cert_dir_base_(NULL) {
}

TagExtractor::~TagExtractor() {
  CloseFile();
}

bool TagExtractor::OpenFile(const TCHAR* filename) {
  CloseFile();
  file_handle_ = CreateFile(filename, GENERIC_READ, FILE_SHARE_READ, NULL,
    OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
  if (IsFileOpen()) {
    file_mapping_ = CreateFileMapping(file_handle_, NULL, PAGE_READONLY,
      0, 0, NULL);
    if (file_mapping_ != NULL) {
      file_base_ = MapViewOfFile(file_mapping_, FILE_MAP_READ, 0, 0, 0);
      if (file_base_ != NULL) {
        MEMORY_BASIC_INFORMATION info = {0};
        if (::VirtualQuery(file_base_, &info, sizeof(info))) {
          file_length_ = info.RegionSize;
          return true;
        }
      }
      CloseHandle(file_mapping_);
    }
    CloseFile();
  }
  return false;
}

bool TagExtractor::IsFileOpen() const {
  return file_handle_ != INVALID_HANDLE_VALUE;
}

void TagExtractor::CloseFile() {
  if (file_base_ != NULL) {
    UnmapViewOfFile(file_base_);
    file_base_ = NULL;
  }
  if (file_mapping_ != NULL) {
    CloseHandle(file_mapping_);
    file_mapping_ = NULL;
  }
  if (IsFileOpen()) {
    CloseHandle(file_handle_);
    file_handle_ = INVALID_HANDLE_VALUE;
  }
}

bool TagExtractor::ExtractTag(const char* binary_file,
                              size_t binary_file_length,
                              char* tag_buffer,
                              int* tag_buffer_len) {
  file_length_ = binary_file_length;
  return InternalExtractTag(binary_file, tag_buffer, tag_buffer_len);
}

bool TagExtractor::ExtractTag(char* tag_buffer, int* tag_buffer_len) {
  if (tag_buffer_len == NULL) {
    return false;
  }
  if (!IsFileOpen()) {
    return false;
  }

  return InternalExtractTag(static_cast<char*>(file_base_),
                            tag_buffer,
                            tag_buffer_len);
}

bool TagExtractor::InternalReadCertificate(const char* file_buffer) {
  if (!file_buffer) {
    return false;
  }

  const IMAGE_DATA_DIRECTORY* idd = GetCertificateDirectory(file_buffer);
  if (NULL == idd) {
    return false;
  }

  const void* certificate_directory_pointer = file_buffer + idd->VirtualAddress;
  const void* asn1_signature_pointer =
    GetASN1SignaturePointer(certificate_directory_pointer);
  if (NULL == asn1_signature_pointer) {
    return false;
  }
  // Check that the file is long enough to contain |asn1_signature_pointer| plus
  // some more for GetASN1SignatureLength to read the length.
  if (static_cast<const char*>(asn1_signature_pointer) + 4 >=
    file_buffer + file_length_) {
    return false;
  }
  DWORD asn1_signature_length =
    GetASN1SignatureLength(asn1_signature_pointer);
  if (0 == asn1_signature_length) {
    return false;
  }

  cert_dir_length_ = idd->Size;
  cert_dir_base_ = certificate_directory_pointer;

  return true;
}

bool TagExtractor::InternalExtractTag(const char* file_buffer,
                                      char* tag_buffer,
                                      int* tag_buffer_len) {
  if (tag_buffer_len == NULL) {
    return false;
  }
  if (!file_buffer) {
    return false;
  }

  if (!InternalReadCertificate(file_buffer)) {
    return false;
  }

  const char* read_base = static_cast<const char*>(cert_dir_base_);
  if (read_base + cert_dir_length_ > file_buffer + file_length_) {
    // The file is not tagged.
    return false;
  }

  return ReadTag(read_base, tag_buffer, tag_buffer_len);
}

bool TagExtractor::ReadTag(const char* read_base,
                           char* tag_buffer,
                           int* tag_buffer_len) const {
  const char* read_base_end = read_base + cert_dir_length_;
  const char* kMagicBytes = AFFILIATE_ID_MAGIC;
  const char* mc = std::search(read_base,
                               read_base_end,
                               kMagicBytes,
                               kMagicBytes + AFFILIATE_ID_MAGIC_LENGTH);
  if (mc >= read_base_end) {
    return false;
  }
  const char* tag_pointer = mc + AFFILIATE_ID_MAGIC_LENGTH;

  uint16 id_len = 0;
  const unsigned char* id_len_serialized =
    reinterpret_cast<const unsigned char*>(tag_pointer);
  id_len = id_len_serialized[0] << 8;
  // unsigned char and uint16 get promoted to int.
  id_len = static_cast<uint16>(id_len + id_len_serialized[1]);

  if (!id_len) {
    return false;
  }

  int buffer_size_required = id_len + 1;
  if (tag_buffer == NULL) {
    *tag_buffer_len = buffer_size_required;
    return true;
  }
  if (*tag_buffer_len < buffer_size_required) {
    return false;
  }
  tag_pointer += sizeof(id_len);
  memcpy(tag_buffer, tag_pointer, id_len);
  tag_buffer[id_len] = '\0';
  return true;
}

const IMAGE_DATA_DIRECTORY* TagExtractor::GetCertificateDirectory(
  const void* base) const {
  const char* image_base = reinterpret_cast<const char*>(base);

  // Is this a PEF?
  if (file_length_ < sizeof(IMAGE_DOS_HEADER)) {
    return NULL;
  }
  const IMAGE_DOS_HEADER* dos_header =
    reinterpret_cast<const IMAGE_DOS_HEADER *>(image_base);
  if (dos_header->e_magic != IMAGE_DOS_SIGNATURE) {
    return NULL;
  }

  // Get PE header.
  if (file_length_ < dos_header->e_lfanew + sizeof(IMAGE_NT_HEADERS)) {
    return NULL;
  }
  const IMAGE_NT_HEADERS* nt_headers = reinterpret_cast<const IMAGE_NT_HEADERS*>
    (image_base + dos_header->e_lfanew);

  // Again, is this a PEF? This code should get an F for not being endian-
  // safe, but it gets an A for working in the real world.
  if (nt_headers->Signature != IMAGE_NT_SIGNATURE) {
    return NULL;
  }

  // Check that we're operating no an image of the same bitness.
  // OptionalHeader.DataDirectory location in structure depends on the image's
  // bitness. See IMAGE_OPTIONAL_HEADER:
  // http://msdn.microsoft.com/en-us/library/windows/desktop/ms680339.aspx
  if (nt_headers->FileHeader.Machine == IMAGE_FILE_MACHINE_I386) {
#if !defined(ARCH_CPU_X86)
    return NULL;
#endif
  }
  else if (nt_headers->FileHeader.Machine == IMAGE_FILE_MACHINE_AMD64) {
#if !defined(ARCH_CPU_X86_64)
    return NULL;
#endif
  }
  const IMAGE_DATA_DIRECTORY* idd =
    reinterpret_cast<const IMAGE_DATA_DIRECTORY *>
    (&nt_headers->
    OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_SECURITY]);

  if (idd->VirtualAddress == NULL ||
    file_length_ < idd->VirtualAddress + sizeof(WIN_CERTIFICATE)) {
    return NULL;
  }
  return idd;
}

const void* TagExtractor::GetASN1SignaturePointer(const void* base) const {
  const WIN_CERTIFICATE* cert =
    reinterpret_cast<const WIN_CERTIFICATE *>(base);
  return cert->bCertificate;
}

int TagExtractor::GetASN1SignatureLength(const void* base) const {
  const unsigned char* sig_base =
    reinterpret_cast<const unsigned char*>(base);

  // No, this isn't a full ASN.1 parser. We're just doing the very bare
  // minimum to extract a length.
  if (*sig_base++ == 0x30 && *sig_base++ == 0x82) {
    int len = (*sig_base++ << 8);
    len += *sig_base++;
    // Windows pads the certificate directory to align at a 8-byte boundary.
    // This piece of code it trying to replicate the logic that is used to
    // calculate the padding to be added to the certificate. It returns
    // the entire length of the certificate directory from the windows
    // certificate directory start to the end of padding.
    // The windows certificate directory has the following structure
    // <WIN_CERTIFICATE><Certificate><Padding>.
    // WIN_CERTIFICATE is the windows certificate directory structure.
    // <Certificate> has the following format:
    // <Magic(2 bytes)><Cert length(2 bytes)><Certificate Data>
    // Note that the "Cert length" does not include the magic bytes or
    // the length.
    //
    // Hence the total length of the certificate is:
    // cert_length + "WIN_CERTIFICATE header size" + magic + length
    // + padding = (cert length + 8 + 2 + 2 + 7) & (0-8)
    return (len + 8 + 2 + 2 + 7) & 0xffffff8;
  }
  return 0;
}

}  // namespace omaha

