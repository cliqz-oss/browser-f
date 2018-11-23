# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|

  config.vm.box = "browser-f-ios10.12.6-305"
  config.vm.network "public_network"
  config.vm.define "browser-f-mac"
  config.vm.network "forwarded_port", guest: 5900, host: 7900

  config.vm.provider "virtualbox" do |v|
    v.gui = false
    v.name = "browser-f-mac"
    v.memory = ENV["NODE_MEMORY"]
    v.cpus = ENV["NODE_CPU_COUNT"]
    v.vmx["remotedisplay.vnc.enabled"] = "TRUE"
    v.vmx["RemoteDisplay.vnc.port"] = ENV["NODE_VNC_PORT"]
  end

  config.vm.provision "shell", privileged: true, run: "always", inline: <<-SHELL
    npm install -g appdmg
    /System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/Resources/kickstart -activate -configure -access -on -clientopts -setvnclegacy -vnclegacy yes -clientopts -restart -agent -privs -all
  SHELL

  config.vm.provision "shell", privileged: false, run: "always", inline: <<-SHELL
    rm -f slave.jar
    wget #{ENV['JENKINS_URL']}/jnlpJars/agent.jar
    nohup java -jar agent.jar -jnlpUrl #{ENV['JENKINS_URL']}/computer/#{ENV['NODE_ID']}/slave-agent.jnlp -secret #{ENV["NODE_SECRET"]} &
  SHELL
end
