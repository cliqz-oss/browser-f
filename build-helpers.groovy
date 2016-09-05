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
