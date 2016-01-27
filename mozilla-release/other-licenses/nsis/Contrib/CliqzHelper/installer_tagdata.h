// Tagged installer, Omaha style,
// https://code.google.com/p/omaha/wiki/TaggedMetainstallers

#ifndef INSTALLER_TAGDATA_H_
#define INSTALLER_TAGDATA_H_

#include <string>
#include <vector>

namespace omaha {
  class TagExtractor;
}  // namespace omaha

class InstallerTagData {
  typedef std::vector<char> tMaskedTag;

 public:
  InstallerTagData() {}
  ~InstallerTagData() {}

  // Into Init function must be passed filename from which tag data
  // must be extract
  static bool Init(const std::wstring& filename);
  static void Reset();
  static InstallerTagData* ForCurrentProcess();

  // return empty string if not present
  std::string GetParam(const std::string& key);

 private:
  bool FindAndParseTag(const std::wstring& filename);
  bool ReadTag(omaha::TagExtractor* extractor);

  // The singleton CommandLine representing the current process's command line.
  static InstallerTagData* current_installer_tagdata_;

  std::string parsed_data_;
};

#endif  // INSTALLER_TAGDATA_H_
