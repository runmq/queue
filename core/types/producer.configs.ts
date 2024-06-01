import { ConnectionConfigs } from "./connection.configs";

/**
 * Interface representing the configuration options for a producer.
 */
export interface ProducerConfigs {
  /**
   * Configuration settings for the connection.
   * @type {ConnectionConfigs}
   */
  connection: ConnectionConfigs;

  /**
   * The name of the queue to which the producer will send messages.
   * @type {string}
   */
  queue: string;
}
