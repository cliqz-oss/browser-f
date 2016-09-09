# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|

  config.vm.box = "mac-browser_ios-v43"
  config.vm.network "public_network"

  config.vm.provider "vmware_fusion" do |v|
    v.vmx["remotedisplay.vnc.enabled"] = "TRUE"
    v.vmx["remotedisplay.vnc.port"] = 5985
    v.memory = 8000
    v.cpus = 4
    v.gui = false
  end
end
