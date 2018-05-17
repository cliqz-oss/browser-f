# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

ifndef CONFIG_DIR
$(error CONFIG_DIR must be set before including makensis.mk)
endif

include $(MOZILLA_DIR)/toolkit/mozapps/installer/signing.mk

ABS_CONFIG_DIR := $(abspath $(CONFIG_DIR))

SFX_MODULE ?= $(error SFX_MODULE is not defined)

TOOLKIT_NSIS_FILES = \
	common.nsh \
	locale.nlf \
	locale-fonts.nsh \
	locale-rtl.nlf \
	locales.nsi \
	overrides.nsh \
	setup.ico \
	$(NULL)

CUSTOM_NSIS_PLUGINS = \
	AccessControl.dll \
	AppAssocReg.dll \
	ApplicationID.dll \
	CertCheck.dll \
	CityHash.dll \
	CliqzHelper.dll \
	InetBgDL.dll \
	InvokeShellVerb.dll \
	liteFirewallW.dll \
	nsJSON.dll \
	ServicesHelper.dll \
	ShellLink.dll \
	UAC.dll \
	$(NULL)

CUSTOM_UI = \
	nsisui.exe \
	$(NULL)

$(CONFIG_DIR)/setup.exe::
	$(INSTALL) $(addprefix $(MOZILLA_DIR)/toolkit/mozapps/installer/windows/nsis/,$(TOOLKIT_NSIS_FILES)) $(CONFIG_DIR)
	$(INSTALL) $(addprefix $(MOZILLA_DIR)/other-licenses/nsis/Plugins/,$(CUSTOM_NSIS_PLUGINS)) $(CONFIG_DIR)
	$(INSTALL) $(addprefix $(MOZILLA_DIR)/other-licenses/nsis/,$(CUSTOM_UI)) $(CONFIG_DIR)
	cd $(CONFIG_DIR) && $(MAKENSISU) $(MAKENSISU_FLAGS) installer.nsi
ifdef MOZ_STUB_INSTALLER
	cd $(CONFIG_DIR) && $(MAKENSISU) $(MAKENSISU_FLAGS) stub.nsi
endif
ifdef MOZ_EXTERNAL_SIGNING_FORMAT
	$(MOZ_SIGN_CMD) $(foreach f,$(MOZ_EXTERNAL_SIGNING_FORMAT),-f $(f)) "$@"
endif

<<<<<<< HEAD
$(CONFIG_DIR)/7zSD.sfx:
	cp $(SFX_MODULE) $(CONFIG_DIR)/7zSD_tmp.sfx
	../../../../cliqz-helpers/rcedit.exe $(CONFIG_DIR)/7zSD_tmp.sfx -sfv "$(CQZ_VERSION)"
	$(CYGWIN_WRAPPER) upx --best -o $(CONFIG_DIR)/7zSD.sfx $(CONFIG_DIR)/7zSD_tmp.sfx

installer::
	$(INSTALL) $(CONFIG_DIR)/setup.exe $(DEPTH)/installer-stage
	cd $(DEPTH)/installer-stage && $(CYGWIN_WRAPPER) $(7Z) a -r -t7z $(ABS_CONFIG_DIR)/app.7z -mx -m0=BCJ2 -m1=LZMA:d25 -m2=LZMA:d19 -m3=LZMA:d19 -mb0:1 -mb0s1:2 -mb0s2:3
	$(MAKE) $(CONFIG_DIR)/7zSD.sfx
	$(NSINSTALL) -D $(DIST)/$(PKG_INST_PATH)
	cat $(CONFIG_DIR)/7zSD.sfx $(CONFIG_DIR)/app.tag $(CONFIG_DIR)/app.7z > "$(DIST)/$(PKG_INST_PATH)$(PKG_INST_BASENAME).exe"
	chmod 0755 "$(DIST)/$(PKG_INST_PATH)$(PKG_INST_BASENAME).exe"
ifdef MOZ_STUB_INSTALLER
	cp $(CONFIG_DIR)/stub.exe "$(DIST)/$(PKG_INST_PATH)$(PKG_STUB_BASENAME).exe"
	chmod 0755 "$(DIST)/$(PKG_INST_PATH)$(PKG_STUB_BASENAME).exe"
endif
||||||| merged common ancestors
$(CONFIG_DIR)/7zSD.sfx:
	$(CYGWIN_WRAPPER) upx --best -o $(CONFIG_DIR)/7zSD.sfx $(SFX_MODULE)

installer::
	$(INSTALL) $(CONFIG_DIR)/setup.exe $(DEPTH)/installer-stage
	cd $(DEPTH)/installer-stage && $(CYGWIN_WRAPPER) $(7Z) a -r -t7z $(ABS_CONFIG_DIR)/app.7z -mx -m0=BCJ2 -m1=LZMA:d25 -m2=LZMA:d19 -m3=LZMA:d19 -mb0:1 -mb0s1:2 -mb0s2:3
	$(MAKE) $(CONFIG_DIR)/7zSD.sfx
	$(NSINSTALL) -D $(DIST)/$(PKG_INST_PATH)
	cat $(CONFIG_DIR)/7zSD.sfx $(CONFIG_DIR)/app.tag $(CONFIG_DIR)/app.7z > "$(DIST)/$(PKG_INST_PATH)$(PKG_INST_BASENAME).exe"
	chmod 0755 "$(DIST)/$(PKG_INST_PATH)$(PKG_INST_BASENAME).exe"
ifdef MOZ_STUB_INSTALLER
	cp $(CONFIG_DIR)/stub.exe "$(DIST)/$(PKG_INST_PATH)$(PKG_STUB_BASENAME).exe"
	chmod 0755 "$(DIST)/$(PKG_INST_PATH)$(PKG_STUB_BASENAME).exe"
endif
=======
ifdef ZIP_IN
installer:: $(CONFIG_DIR)/setup.exe $(ZIP_IN)
	@echo 'Packaging $(WIN32_INSTALLER_OUT).'
	$(NSINSTALL) -D '$(ABS_DIST)/$(PKG_INST_PATH)'
	$(MOZILLA_DIR)/mach repackage installer \
	  -o '$(ABS_DIST)/$(PKG_INST_PATH)$(PKG_INST_BASENAME).exe' \
	  --package-name '$(MOZ_PKG_DIR)' \
	  --package '$(ZIP_IN)' \
	  --tag $(topsrcdir)/$(MOZ_BUILD_APP)/installer/windows/app.tag \
	  --setupexe $(CONFIG_DIR)/setup.exe \
	  --sfx-stub $(SFX_MODULE)
>>>>>>> origin/upstream-releases
ifdef MOZ_EXTERNAL_SIGNING_FORMAT
	$(MOZ_SIGN_CMD) $(foreach f,$(MOZ_EXTERNAL_SIGNING_FORMAT),-f $(f)) "$(DIST)/$(PKG_INST_PATH)$(PKG_INST_BASENAME).exe"
endif
ifdef MOZ_STUB_INSTALLER
	$(MOZILLA_DIR)/mach repackage installer \
	  -o '$(ABS_DIST)/$(PKG_INST_PATH)$(PKG_STUB_BASENAME).exe' \
	  --tag $(topsrcdir)/browser/installer/windows/stub.tag \
	  --setupexe $(CONFIG_DIR)/setup-stub.exe \
	  --sfx-stub $(SFX_MODULE)
endif
else
installer::
	$(error ZIP_IN must be set when building installer)
endif

# For building the uninstaller during the application build so it can be
# included for mar file generation.
$(CONFIG_DIR)/helper.exe:
	$(RM) -r $(CONFIG_DIR)
	$(MKDIR) $(CONFIG_DIR)
	$(INSTALL) $(addprefix $(srcdir)/,$(INSTALLER_FILES)) $(CONFIG_DIR)
	$(INSTALL) $(addprefix $(topsrcdir)/$(MOZ_BRANDING_DIRECTORY)/,$(BRANDING_FILES)) $(CONFIG_DIR)
	$(call py_action,preprocessor,-Fsubstitution $(DEFINES) $(ACDEFINES) \
	  $(srcdir)/nsis/defines.nsi.in -o $(CONFIG_DIR)/defines.nsi)
	$(PYTHON) $(topsrcdir)/toolkit/mozapps/installer/windows/nsis/preprocess-locale.py \
	  --preprocess-locale $(topsrcdir) \
	  $(PPL_LOCALE_ARGS) $(AB_CD) $(CONFIG_DIR)
	$(INSTALL) $(addprefix $(MOZILLA_DIR)/toolkit/mozapps/installer/windows/nsis/,$(TOOLKIT_NSIS_FILES)) $(CONFIG_DIR)
	$(INSTALL) $(addprefix $(MOZILLA_DIR)/other-licenses/nsis/Plugins/,$(CUSTOM_NSIS_PLUGINS)) $(CONFIG_DIR)
	cd $(CONFIG_DIR) && $(MAKENSISU) $(MAKENSISU_FLAGS) uninstaller.nsi

uninstaller:: $(CONFIG_DIR)/helper.exe
	$(NSINSTALL) -D $(DIST)/bin/uninstall
	cp $(CONFIG_DIR)/helper.exe $(DIST)/bin/uninstall

ifdef MOZ_MAINTENANCE_SERVICE
maintenanceservice_installer::
	cd $(CONFIG_DIR) && $(MAKENSISU) $(MAKENSISU_FLAGS) maintenanceservice_installer.nsi
	$(NSINSTALL) -D $(DIST)/bin/
	cp $(CONFIG_DIR)/maintenanceservice_installer.exe $(DIST)/bin
endif
