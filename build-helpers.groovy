import jenkins.model.*
import hudson.model.*
import hudson.slaves.*

def checkoutSCM(URL, COMMIT) {
    checkout(
        changelog: false,
        poll: false,
        scm: [
            $class: 'GitSCM',
            branches: [[name: COMMIT]],
            doGenerateSubmoduleConfigurations: false,
            extensions: [
                [$class: 'CheckoutOption', timeout: 30],
                [$class: 'CloneOption', depth: 0, noTags: true, reference: '', shallow: false, timeout: 30, honorRefspec: true],
            ],
            submoduleCfg: [],
            userRemoteConfigs: [[credentialsId: '0aededfc-f41d-40bd-9a63-dd4524adb7b6', url: URL]]
        ]
    )
}

def startVagrantAgent(vagrantFileName='Vagrantfile') {
    withEnv([
        "VAGRANT_VAGRANTFILE=$vagrantFileName"]) {

        sh """#!/bin/bash -l -x
            vagrant halt
            vagrant up
        """

        withCredentials([[
            $class: 'StringBinding',
            credentialsId: 'caf0ec30-fcc7-40c4-9f71-a6f96fdbf511',
            variable: 'SLAVE_CREDS']]) {

            sh """#!/bin/bash -l
                vagrant ssh -c 'nohup java -jar slave.jar  -jnlpUrl http://magrathea:8080/computer/browser-f-mac-builder/slave-agent.jnlp -secret ${env.SLAVE_CREDS} > /dev/null 2>&1 &'
            """
        }
    }
}

@NonCPS
def createNode(nodeId) {
    def launcher = new JNLPLauncher()
    def node = new DumbSlave(
        nodeId,
        "/jenkins",
        launcher
    )
    Jenkins.instance.addNode(node)
}

@NonCPS
def removeNode(nodeId) {
    def allNodes = Jenkins.getInstance().getNodes()
    for (int i =0; i < allNodes.size(); i++) {
        Slave node = allNodes[i]

        if (node.name.toString() == nodeId) {
            Jenkins.getInstance().removeNode(node)
            return
        }
    }
}

@NonCPS
def getNodeSecret(nodeId) {
    return jenkins.slaves.JnlpSlaveAgentProtocol.SLAVE_SECRET.mac(nodeId)
}

def withVagrant(vagrantFilePath = "Vagrantfile", Closure body) {
    def nodeId = "${env.BUILD_TAG}-${vagrantFilePath}"
    createNode(nodeId)
    try {
        def nodeSecret = getNodeSecret(nodeId)

        withEnv([
            "VAGRANT_VAGRANTFILE=${vagrantFilePath}",
            "NODE_SECRET=${nodeSecret}",
            "NODE_ID=${nodeId}",
            ]) {
            sh 'vagrant up'
        }

        body(nodeId)
    } finally {
        withEnv(["VAGRANT_VAGRANTFILE=${vagrantFilePath}"]) {
            sh 'vagrant halt --force'
        }
        removeNode(nodeId)
    }
}

return this
