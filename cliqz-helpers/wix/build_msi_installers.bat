set PATH=c:\utils\wix;%PATH%

del *.wixobj
del *.msi
del *.wixpdb

candle cliqz_msi_de.wix.wxs
candle cliqz_msi_en.wix.wxs

light cliqz_msi_de.wix.wixobj
light cliqz_msi_en.wix.wixobj

rename cliqz_msi_en.wix.msi CLIQZ-1.7.0.en-US.win32.installer.msi
rename cliqz_msi_de.wix.msi CLIQZ-1.7.0.de.win32.installer.msi
