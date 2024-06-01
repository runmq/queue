import { IClientConnector } from "@core/types";
/**
 * AbstractProducer is an abstract class that provides basic functionalities for adding data to queues.
 * It ensures atomic operations if needed and handles graceful shutdown on process termination signals.
 */
export default abstract class AbstractProducer<K> {
  /**
   * Creates an instance of AbstractProducer.
   * @param name - The name of the queue.
   * @param client - An instance of IClientConnector to interact with the queue.
   */
  constructor(private name: string, private client: IClientConnector<K>) {
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
    await this.client.create();
    if (additionalQueues && additionalQueues.length) {
      await this.client.addAtomic(this.name, additionalQueues, data);
      return;
    }
    await this.client.add(this.name, data);
  }

  /**
   * Adds multiple data entries to the main queue and optionally to additional queues atomically.
   * @param data - An array of data entries to be added to the queue.
   * @param additionalQueues - Optional. Additional queues to which the data should be added atomically.
   * @returns A promise that resolves when the data has been added.
   */
  public async bulk(data: unknown[], additionalQueues: string[] = []) {
    await this.client.create();
    if (additionalQueues.length) {
      await this.client.bulkAtomic(this.name, additionalQueues, data);
      return;
    }
    await this.client.bulk(this.name, data);
  }

  /**
   * Disconnects the client from the queue.
   * @returns A promise that resolves when the client has been disconnected.
   */
  public async disconnect() {
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
