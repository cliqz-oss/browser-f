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
                [$class: 'CloneOption', depth: 0, noTags: false, reference: '', shallow: false, timeout: 30]
            ],
            submoduleCfg: [],
            userRemoteConfigs: [[url: URL]]
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

return this