#include "installer_tagdata.h"

#include <functional>
#include <random>

#include "tag_extractor.h"

InstallerTagData* InstallerTagData::current_installer_tagdata_ = NULL;

bool InstallerTagData::FindAndParseTag(const std::wstring& filename) {
  // Get tag from original installer (mini_installer, parent process)
  omaha::TagExtractor extractor;
  if (!extractor.OpenFile(filename.c_str()))
    return false;
  bool res = ReadTag(&extractor);
  extractor.CloseFile();

  return res;
}

std::string InstallerTagData::GetParam(const std::string& key) {
  if (key.empty())
    return "";

  std::string to_search = key + "=";
  size_t start = parsed_data_.find(to_search);
  if (start != std::string::npos) {
    start += to_search.length();
    size_t end = parsed_data_.find("&", start);
    if (end != std::string::npos) {
      return parsed_data_.substr(start, end - start);
    }
    else {
      return parsed_data_.substr(start, parsed_data_.length() - start);
    }
  }
  return "";
}

// static
bool InstallerTagData::Init(const std::wstring& cmd) {
  if (current_installer_tagdata_) {
    // If this is intentional, Reset() must be called first.
    return false;
  }

  current_installer_tagdata_ = new InstallerTagData();
  return current_installer_tagdata_->FindAndParseTag(cmd);
}

// static
void InstallerTagData::Reset() {
  delete current_installer_tagdata_;
  current_installer_tagdata_ = NULL;
}

// static
InstallerTagData* InstallerTagData::ForCurrentProcess() {
  return current_installer_tagdata_;
}

// The function assumes that the extractor has already been opened.
bool InstallerTagData::ReadTag(omaha::TagExtractor* extractor) {
  const int kMaxTagLength = 0x10000;  // 64KB

  tMaskedTag tag_buffer;
  int tag_buffer_size = 0;
  if (extractor->ExtractTag(NULL, &tag_buffer_size)) {
    if (tag_buffer_size > 0 && tag_buffer_size < kMaxTagLength) {
      tag_buffer.resize(tag_buffer_size);
      if (extractor->ExtractTag(&tag_buffer[0], &tag_buffer_size)) {
        parsed_data_ = std::string(&tag_buffer[0]);
        return (!parsed_data_.empty());
      }
    }
  }

  return false;
}
