# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|

  config.vm.box = "browser-f_mac10.11.4_34"
  config.vm.network "public_network"
  config.vm.define "browser-f-mac"

  config.vm.provider "vmware_fusion" do |v|
    v.gui = false
    v.name = "browser-f-mac"
    v.memory = ENV["NODE_MEMORY"]
    v.cpus = ENV["NODE_CPU_COUNT"]
    v.vmx["remotedisplay.vnc.enabled"] = "TRUE"
    v.vmx["RemoteDisplay.vnc.port"] = ENV["NODE_VNC_PORT"]
  end

  config.vm.provision "shell", privileged: false, run: "always", inline: <<-SHELL
    rm -f slave.jar
    wget #{ENV['JENKINS_URL']}/jnlpJars/agent.jar
    nohup java -jar agent.jar -jnlpUrl #{ENV['JENKINS_URL']}/computer/#{ENV['NODE_ID']}/slave-agent.jnlp -secret #{ENV["NODE_SECRET"]} &
  SHELL
end
