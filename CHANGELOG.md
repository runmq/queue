# [2.0.0](https://github.com/runmq/queue/compare/v1.5.1...v2.0.0) (2026-05-10)


### Bug Fixes

* expose prefetch as configurable, document consumersCount multiplier ([#37](https://github.com/runmq/queue/issues/37)) ([4bffb03](https://github.com/runmq/queue/commit/4bffb036f1f052995f360185c939e751609e81e9)), closes [#24](https://github.com/runmq/queue/issues/24)
* honor schema messageSchema.failureStrategy: 'dlq' ([#23](https://github.com/runmq/queue/issues/23)) ([#35](https://github.com/runmq/queue/issues/35)) ([6333b1b](https://github.com/runmq/queue/commit/6333b1ba732d4f875acca53591ef54d590155b68))
* isolate publish path from setup-channel closures ([#30](https://github.com/runmq/queue/issues/30)) ([#42](https://github.com/runmq/queue/issues/42)) ([aab4dc5](https://github.com/runmq/queue/commit/aab4dc5e8ed1d5d3529c6fc23287bd0cb73292e1))
* log channel error/close events and re-subscribe consumers ([#29](https://github.com/runmq/queue/issues/29)) ([#41](https://github.com/runmq/queue/issues/41)) ([a257c66](https://github.com/runmq/queue/commit/a257c66ff4ffb9f57a883e7f392b1739f50a2272))
* preserve original message envelope when moving to DLQ ([#25](https://github.com/runmq/queue/issues/25)) ([#39](https://github.com/runmq/queue/issues/39)) ([d909983](https://github.com/runmq/queue/commit/d909983dc4b7c6cadffe8d8a19612ce654c6b182))
* prevent consumer crashes from ack/nack throws and unhandled rejections ([#33](https://github.com/runmq/queue/issues/33)) ([83a5d20](https://github.com/runmq/queue/commit/83a5d20c6d84087a32e6c88eebc0f22dece29af5)), closes [#20](https://github.com/runmq/queue/issues/20)
* publisher confirms — DLQ always-on, user-publish opt-in ([#19](https://github.com/runmq/queue/issues/19), [#28](https://github.com/runmq/queue/issues/28)) ([#36](https://github.com/runmq/queue/issues/36)) ([2d55d2f](https://github.com/runmq/queue/commit/2d55d2f54b67589ab3d3ad5996f7017e4bdcd364))


### Features

* drop Node.js floor from 18 to 16 ([#38](https://github.com/runmq/queue/issues/38)) ([4e97775](https://github.com/runmq/queue/commit/4e97775de0b9722a22da16691a82b465bc8b787e))


### Performance Improvements

* cache compiled AJV validators by schema identity ([#34](https://github.com/runmq/queue/issues/34)) ([427cd47](https://github.com/runmq/queue/commit/427cd47e6710cddab09814065f66a7d3f799d58d))
* stop logging full message payload by default ([#27](https://github.com/runmq/queue/issues/27)) ([#45](https://github.com/runmq/queue/issues/45)) ([9878ba9](https://github.com/runmq/queue/commit/9878ba989f18b7d06f0b65a057dc194a3a3e0cb9)), closes [#25](https://github.com/runmq/queue/issues/25)


### BREAKING CHANGES

* RunMQ.publish is now async and returns Promise<void>
instead of void, and resolves only after broker ack by default. Callers
must await the call (or chain `.then`/`.catch`) to surface broker
rejections — silent drops are no longer possible unless you opt out via
`usePublisherConfirms: false` in the connection config. The same
* applies to AMQPChannel.publish and RunMQPublisher.publish
on the public surface.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* docs: document publisher confirms default-on in README

* test: restore deflaked resubscribe e2e lost in merge

The merge from origin/main reintroduced an older fixed-delay version of
the resubscribe e2e (the publisher-confirms branch had deleted the file,
and the merge picked up the pre-deflake copy). Restore the polling
version from main so CI doesn't flake on the 8s/2s sleeps.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* Fixing tests

Signed-off-by: Fawzi Abdulfattah <iifawzie@gmail.com>

## [1.5.1](https://github.com/runmq/queue/compare/v1.5.0...v1.5.1) (2026-04-18)


### Bug Fixes

* improving reliability and decreasing latency disabling nagle's algorithm ([0c71f0f](https://github.com/runmq/queue/commit/0c71f0fdeb9bd542097fb41d45f532504992caa3))

# [1.5.0](https://github.com/runmq/queue/compare/v1.4.2...v1.5.0) (2026-04-17)


### Features

* Increasing prefetch count to 20 to decrease roundtrip ([bf16100](https://github.com/runmq/queue/commit/bf16100478e96faf257de9e561ce03a24f32ddac))

## [1.4.2](https://github.com/runmq/queue/compare/v1.4.1...v1.4.2) (2026-04-17)


### Bug Fixes

* add @semantic-release/npm plugin to update package.json version on release ([1951733](https://github.com/runmq/queue/commit/19517335f6491af09bbbf3cb980fe13f7695f28a))
* add semantic-release/npm plugin to update package.json version on release ([30028cc](https://github.com/runmq/queue/commit/30028cc9f741bea1bd59a471fdc9d310ca29cefd))

## [1.4.1](https://github.com/runmq/queue/compare/v1.4.0...v1.4.1) (2026-04-17)


### Bug Fixes

* correct ESM exports path in package.json ([073ca0c](https://github.com/runmq/queue/commit/073ca0c82e6502a60a01206d0a3e4c3c5a572d23))

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
