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

@NonCPS
def createNode(nodeId, jenkinsFolderPath) {
    def launcher = new JNLPLauncher()
    def node = new DumbSlave(
        nodeId,
        jenkinsFolderPath,
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

@NonCPS
def setNodeLabel(nodeId, label) {
    def allNodes = Jenkins.getInstance().getNodes()
    for (int i =0; i < allNodes.size(); i++) {
        Slave node = allNodes[i]

        if (node.name.toString() == nodeId) {
          node.setLabelString(label)
          return
        }
    }
}


def withDocker(String imageName, String jenkinsFolderPath, Closure body) {
  def nodeId = "${env.BUILD_TAG}"
  def error

  // Prepare image
  try {
    // authorize docker deamon to access registry
    sh "`aws ecr get-login --region=$AWS_REGION`"

    docker.withRegistry(DOCKER_REGISTRY_URL) {
      def image = docker.image(imageName)
      image.pull()
      imageName = image.imageName()
    }
  } catch (e) {
    // local registry does not require auth
  }

  // Create Jenkins node
  try {
    createNode(nodeId, jenkinsFolderPath)
  } catch(e) {
    echo "Could not create slave for Docker"
  }

  try {
    def nodeSecret = getNodeSecret(nodeId)

      // Start agent
    docker.image(imageName).inside() {
      sh """
        rm -f slave.jar
        # TODO: move to docker image
        sudo apt-get install openjdk-7-jre -y
        wget $JENKINS_URL/jnlpJars/slave.jar
        nohup java -jar slave.jar -jnlpUrl ${env.JENKINS_URL}/computer/$nodeId/slave-agent.jnlp -secret $nodeSecret &
      """

      // Run the closure
      body(nodeId)
    }
  } catch (e) {
    error = e
  } finally {
    removeNode(nodeId)
    if (error) {
      throw error
    }
  }
}

def withVagrant(String vagrantFilePath, String jenkinsFolderPath, Integer cpu, Integer memory, Integer vnc_port, Boolean rebuild, String nodeId, Closure body) {
    def tempNode = false
    if (!nodeId) { 
        nodeId = "${env.BUILD_TAG}"
        try {
          createNode(nodeId, jenkinsFolderPath)
          tempNode = true
        } catch(e) {
           echo "Could not create slave for Vagrant"
           throw e
        }
    }

    def error
    try {
        def nodeSecret = getNodeSecret(nodeId)

        withEnv([
            "VAGRANT_VAGRANTFILE=${vagrantFilePath}",
            "NODE_CPU_COUNT=${cpu}",
            "NODE_MEMORY=${memory}",
            "NODE_VNC_PORT=${vnc_port}",
            "NODE_SECRET=${nodeSecret}",
            "NODE_ID=${nodeId}",
            ]) {

            sh 'vagrant halt --force'
            if (rebuild) {
              sh 'vagrant destroy --force'
            }
            sh  'vagrant up'
        }

        body(nodeId)
    } catch (e) {
        error = e
    } finally {
        if (error) {
            throw error
        }
        if (tempNode) {
            removeNode(nodeId)
        }
        withEnv(["VAGRANT_VAGRANTFILE=${vagrantFilePath}"]) {
            sh 'vagrant halt --force'
        }
    }
}

class EC2Slave {
  boolean created
  String nodeId
}

@NonCPS
def getEC2Slave(String jenkinsFolderPath, String aws_credentials_id, String aws_region, String ansible_path) {
    def nodeId = null
    def slaveLabel = 'windows pr'
    for (slave in Hudson.instance.slaves) {
      if (slave.getLabelString().contains(slaveLabel)) {
        if (!slave.getComputer().isOffline() && slave.getComputer().isAcceptingTasks()) {
          nodeId = slave.name
        } 
      }     
    } 

    // This is a new slave, so we need to bootstrap it
    if (!nodeId) {
      nodeId = "${env.BUILD_TAG}"
      try {
          createNode(nodeId, jenkinsFolderPath)
          setNodeLabel(nodeId, slaveLabel)
          return new EC2Slave(created: true, nodeId: nodeId)
      } catch (e) {
          echo "Could not create node for ec2"
          throw e
      }
  
      withCredentials([
        [$class: 'AmazonWebServicesCredentialsBinding', accessKeyVariable: 'AWS_ACCESS_KEY_ID', credentialsId: aws_credentials_id, secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
        withEnv([
          "aws_access_key=${env.AWS_ACCESS_KEY_ID}",
          "aws_secret_key=${env.AWS_SECRET_ACCESS_KEY}",
          "instance_name=${nodeId}",]) {
            sh "ansible-playbook ${ansible_path}/bootstrap.yml"
        }
      }
    }

    return new EC2Slave(created: false, nodeId: nodeId)

    def command = "aws ec2 describe-instances --filters \"Name=tag:Name,Values=${nodeId}\" | grep PrivateIpAddress | head -1 | awk -F \':\' '{print \$2}' | sed \'s/[\",]//g\'"
    def nodeIP
    def nodeSecret = getNodeSecret(nodeId)
    
    withCredentials([
      [$class: 'AmazonWebServicesCredentialsBinding',
      accessKeyVariable: 'AWS_ACCESS_KEY_ID',
      credentialsId: aws_credentials_id,
      secretKeyVariable: 'AWS_SECRET_ACCESS_KEY']]) {
          withEnv([
              "AWS_DEFAULT_REGION=${aws_region}"    
              ]) {
              nodeIP = sh(returnStdout: true, script: "${command}").trim()
          }
    } // withCredentials
    
    withEnv([
      "instance_name=${nodeId}",
      "JENKINS_URL=${env.JENKINS_URL}",
      "NODE_ID=${nodeId}",
      "NODE_SECRET=${nodeSecret}"]) {
          sh "ansible-playbook -i ${nodeIP}, ${ansible_path}/playbook.yml"
    }

    return nodeId
}


return this
