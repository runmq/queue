/**
 * IClientConnector is an interface that defines the methods required for interacting with a queueing system.
 */
export interface IClientConnector<K> {
  /**
   * Initializes the connection to the queueing system.
   * @returns A promise that resolves to the initialized connection.
   */
  create(): Promise<K>;

  /**
   * Checks if a consumer group exists in the specified queue.
   * @param queue - The name of the queue.
   * @param group - The name of the consumer group.
   * @returns A promise that resolves when the existence check is complete.
   */
  groupExists(queue: string, group: string): Promise<void>;

  /**
   * Retrieves the length of the specified queue.
   * @param queue - The name of the queue.
   * @returns A promise that resolves to the length of the queue.
   */
  getStreamLength(queue: string): Promise<number>;

  /**
   * Reads messages from a consumer group in the specified queue.
   * @param queue - The name of the queue.
   * @param group - The name of the consumer group.
   * @param consumerId - The ID of the consumer.
   * @param count - The maximum number of messages to read.
   * @param block - The maximum amount of time to block if no messages are available.
   * @returns A promise that resolves to the read messages.
   */
  readGroup(
    queue: string,
    group: string,
    consumerId: string,
    count: number,
    block: number
  ): Promise<any>;

  /**
   * Acknowledges a message in a consumer group as processed.
   * @param queue - The name of the queue.
   * @param group - The name of the consumer group.
   * @param messageId - The ID of the message to acknowledge.
   * @returns A promise that resolves when the message is acknowledged.
   */
  acknowledgeMessage(
    queue: string,
    group: string,
    messageId: string
  ): Promise<void>;

  /**
   * Deletes a consumer from a consumer group in the specified queue.
   * @param consumersSetId - The ID of the set of consumers.
   * @param queue - The name of the queue.
   * @param group - The name of the consumer group.
   * @param consumerId - The ID of the consumer to delete.
   * @returns A promise that resolves when the consumer is deleted.
   */
  deleteConsumer(
    consumersSetId: string,
    queue: string,
    group: string,
    consumerId: string
  ): Promise<void>;

  /**
   * Adds data to the specified queue.
   * @param queue - The name of the queue.
   * @param data - The data to add to the queue.
   * @returns A promise that resolves when the data is added.
   */
  add(queue: string, data: any): Promise<void>;

  /**
   * Adds data atomically to the specified queue and additional queues.
   * @param queue - The name of the main queue.
   * @param additionalQueues - Additional queues to add the data to atomically.
   * @param data - The data to add to the queues.
   * @returns A promise that resolves when the data is added.
   */
  addAtomic(queue: string, additionalQueues: string[], data: any): Promise<void>;

  /**
   * Adds multiple data entries to the specified queue.
   * @param queue - The name of the queue.
   * @param data - An array of data entries to add to the queue.
   * @returns A promise that resolves when the data is added.
   */
  bulk(queue: string, data: any[]): Promise<void>;

  /**
   * Adds multiple data entries atomically to the specified queue and additional queues.
   * @param queue - The name of the main queue.
   * @param additionalQueues - Additional queues to add the data to atomically.
   * @param data - An array of data entries to add to the queues.
   * @returns A promise that resolves when the data is added.
   */
  bulkAtomic(queue: string, additionalQueues: string[], data: any[]): Promise<void>;

  /**
   * Sets a heartbeat for the specified worker.
   * @param workerId - The ID of the worker.
   * @returns A promise that resolves when the heartbeat is set.
   */
  setHeartbeat(workerId: string): Promise<void>;

  /**
   * Retrieves all heartbeats from the queueing system.
   * @returns A promise that resolves to an object containing all heartbeats, indexed by worker ID.
   */
  getAllHeartbeats(): Promise<{ [key: string]: string }>;

  /**
   * Deletes the heartbeat for the specified worker.
   * @param workerId - The ID of the worker.
   * @returns A promise that resolves when the heartbeat is deleted.
   */
  deleteHeartbeat(workerId: string): Promise<void>;

  /**
   * Disconnects the client from the queueing system.
   * @returns A promise that resolves when the client is disconnected.
   */
  quit(): Promise<void>;
}
