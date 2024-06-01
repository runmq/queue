import { CONSTANTS } from "@core/constants";
import { IClientConnector } from "@core/types";
/**
 * AbstractProducer is an abstract class that provides basic functionalities for adding data to queues.
 * It ensures atomic operations if needed and handles graceful shutdown on process termination signals.
 */
export default abstract class AbstractProducer<K> {
  private queueName: string;
  /**
   * Creates an instance of AbstractProducer.
   * @param name - The name of the queue.
   * @param client - An instance of IClientConnector to interact with the queue.
   */
  constructor(private name: string, private client: IClientConnector<K>) {
    this.queueName = CONSTANTS.QUEUE_PREFIX + name;
    process.once("SIGINT", this.handleShutdown.bind(this));
    process.once("SIGTERM", this.handleShutdown.bind(this));
  }

  /**
   * Adds data to the main queue and optionally to additional queues atomically.
   * @param data - The data to be added to the queue.
   * @param additionalQueues - Optional. Additional queues to which the data should be added atomically.
   * @returns A promise that resolves when the data has been added.
   */
  public async add(data: unknown, additionalQueues?: string[]) {
    if (additionalQueues && additionalQueues.length) {
      await this.client.addAtomic(this.queueName, additionalQueues, data);
      return;
    }
    await this.client.add(this.queueName, data);
  }

  /**
   * Adds multiple data entries to the main queue and optionally to additional queues atomically.
   * @param data - An array of data entries to be added to the queue.
   * @param additionalQueues - Optional. Additional queues to which the data should be added atomically.
   * @returns A promise that resolves when the data has been added.
   */
  public async bulk(data: unknown[], additionalQueues: string[] = []) {
    if (additionalQueues.length) {
      await this.client.bulkAtomic(this.queueName, additionalQueues, data);
      return;
    }
    await this.client.bulk(this.queueName, data);
  }

  /**
   * Disconnects the client from the queue.
   * @returns A promise that resolves when the client has been disconnected.
   */
  private async disconnect() {
    await this.client.quit();
  }

  /**
   * Handles graceful shutdown by disconnecting the client.
   * This method is bound to process termination signals (SIGINT, SIGTERM).
   * @private
   */
  private async handleShutdown() {
    await this.disconnect();
  }
}
