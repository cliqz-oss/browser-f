# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|

  config.vm.box = "browser-f|mac10.11.4|30"
  config.vm.network "public_network"
  
  config.vm.provider "vmware_fusion" do |v|
    v.vmx["remotedisplay.vnc.enabled"] = "TRUE"
    v.vmx["remotedisplay.vnc.port"] = 5985
    v.memory = 8000
    v.cpus = 4
    v.gui = false
  end

  config.vm.provision "shell", privileged: false, run: "always", inline: <<-SHELL
    rm -f slave.jar
    wget #{ENV['JENKINS_URL']}/jnlpJars/slave.jar
    nohup java -jar slave.jar -jnlpUrl #{ENV['JENKINS_URL']}/computer/#{ENV['NODE_ID']}/slave-agent.jnlp -secret #{ENV["NODE_SECRET"]} &
  SHELL
end
