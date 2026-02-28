# [1.4.0](https://github.com/runmq/queue/compare/v1.3.0...v1.4.0) (2026-02-28)


### Bug Fixes

* RabbitMQMessage is published to DLQ instead of original payload ([39b9d92](https://github.com/runmq/queue/commit/39b9d922698b7878124b113858d390beb18d5af7))


### Features

* **dashboard:** Introducing management dashboard to manage runmq based queues! https://github.com/runmq/Dashboard ([a1dd6f3](https://github.com/runmq/queue/commit/a1dd6f3acf5e76942e568a994fd83d345e16c7c9))

# [1.3.0](https://github.com/runmq/queue/compare/v1.2.0...v1.3.0) (2026-02-27)


### Bug Fixes

* **core:** using default console logger for client adapter ([c8fadf2](https://github.com/runmq/queue/commit/c8fadf28697b67874eaf15d12c2e0db0bf380524))


### Features

* **core:** delegating custom logger to the client adapter ([2e20225](https://github.com/runmq/queue/commit/2e202258b6c39fdcd84fe7c938089861f2adb1a3))
* **core:** fixing tests ([2cf90c3](https://github.com/runmq/queue/commit/2cf90c32cac92b45db56e28bd81f32225be7bbdc))
* **core:** using delegated logger in the client adapter ([010cb03](https://github.com/runmq/queue/commit/010cb0348e1cfa648f1da9aad8b6a6fa9863b165))

# [1.3.0](https://github.com/runmq/queue/compare/v1.2.0...v1.3.0) (2026-02-27)


### Bug Fixes

* **core:** using default console logger for client adapter ([c8fadf2](https://github.com/runmq/queue/commit/c8fadf28697b67874eaf15d12c2e0db0bf380524))


### Features

* **core:** delegating custom logger to the client adapter ([2e20225](https://github.com/runmq/queue/commit/2e202258b6c39fdcd84fe7c938089861f2adb1a3))
* **core:** fixing tests ([2cf90c3](https://github.com/runmq/queue/commit/2cf90c32cac92b45db56e28bd81f32225be7bbdc))
* **core:** using delegated logger in the client adapter ([010cb03](https://github.com/runmq/queue/commit/010cb0348e1cfa648f1da9aad8b6a6fa9863b165))

# [1.2.0](https://github.com/runmq/queue/compare/v1.1.1...v1.2.0) (2026-02-27)


### Features

* **core:** abstract channel operations and switch to rabbitmq-client ([95d3418](https://github.com/runmq/queue/commit/95d34186bd4fbd6af09bf8c7cbf2aaa5a0da36ce))

# [1.1.1](https://github.com/runmq/queue/compare/v1.1.0...v1.1.1) (2025-11-09)


### Features

* Documentation improvements 


# [1.1.0](https://github.com/runmq/queue/compare/v1.0.3...v1.1.0) (2025-11-09)


### Features

* Adding HTTP Client and TTLPolicyManager with fallback to queue-ttl ([#12](https://github.com/runmq/queue/issues/12)) ([2759a2c](https://github.com/runmq/queue/commit/2759a2cb7dc83707ca815176973ef963cc24bdd0))
