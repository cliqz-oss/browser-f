# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure(2) do |config|
  config.vm.box = "cliqz/cliqzfox-win10-builder_vmware"

  config.vm.network "public_network"

  config.vm.guest = :windows
  config.vm.boot_timeout = 500
  config.vm.communicator = "winrm"
  config.winrm.username = "cliqzfoxer"
  config.winrm.password = "cliqzfoxer-245"
  config.winrm.timeout = 21600 # 6 hours

  config.vm.provider "vmware_workstation" do |v|
    v.gui = false
    v.memory = 4048
    v.cpus = 6
    v.vmx["RemoteDisplay.vnc.enabled"] = "true"
    v.vmx["RemoteDisplay.vnc.port"] = "7905"
  end

  config.vm.provision "shell", inline: <<-SHELL
    net stop jenkinsslave-c__Jenkins
    cd c:/jenkins
    Remove-Item slave.jar -ErrorAction SilentlyContinue
    wget #{ENV['JENKINS_URL']}/jnlpJars/slave.jar -o slave.jar
    Start-Process java -ArgumentList '-jar slave.jar -jnlpUrl #{ENV["JENKINS_URL"]}/computer/#{ENV["NODE_ID"]}/slave-agent.jnlp -secret #{ENV["NODE_SECRET"]}'
  SHELL
end
