import AbstractProducer from "./producer.abstract";
import { ProducerConfigs } from "@core/types";
import Redis from "ioredis";
import { RedisIOClient } from "@core/connectors/ioredis.connector";

/**
 * Class representing a producer that sends messages to a queue.
 */
export default class RedisIOProducer extends AbstractProducer<Redis> {
  constructor(producerConfigs: ProducerConfigs) {
    const client = RedisIOClient.getInstance(producerConfigs);
    super(producerConfigs.queue, client);
  }
}
