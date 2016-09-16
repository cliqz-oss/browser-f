# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|

  config.vm.box = "customtest"
  config.vm.network "public_network"

  config.ssh.private_key_path = "/Users/jenkins/old-vagrant-private-key"

  config.vm.provider "vmware_fusion" do |v|
    v.vmx["remotedisplay.vnc.enabled"] = "TRUE"
    v.vmx["remotedisplay.vnc.port"] = 5985
    v.memory = 8000
    v.cpus = 4
    v.gui = false
  end

  config.vm.provision "shell", run: "always", inline: <<-SHELL
    rm -f slave.jar
    wget #{ENV['JENKINS_URL']}/jnlpJars/slave.jar
    echo java -jar slave.jar -jnlpUrl #{ENV['JENKINS_URL']}/computer/#{ENV['NODE_ID']}/slave-agent.jnlp -secret #{ENV["NODE_SECRET"]}
    java -jar slave.jar -jnlpUrl #{ENV['JENKINS_URL']}/computer/#{ENV['NODE_ID']}/slave-agent.jnlp -secret #{ENV["NODE_SECRET"]} &
  SHELL
end
