/* eslint-disable @typescript-eslint/no-unused-vars */
import { IClientConnector, ProducerConfigs } from "@core/types";
import { GetPrefixedQueue } from "@core/helpers";
import { Redis } from "ioredis";

export class RedisIOClient implements IClientConnector<Redis> {
  private static instance: RedisIOClient;
  private client!: Redis;

  private constructor(producerConfigs: ProducerConfigs) {
    this.create(producerConfigs);
  }

  public static getInstance(producerConfigs: ProducerConfigs): RedisIOClient {
    if (!RedisIOClient.instance) {
      RedisIOClient.instance = new RedisIOClient(producerConfigs);
    }
    return RedisIOClient.instance;
  }

  async create(producerConfigs: ProducerConfigs): Promise<Redis> {
    if (!this.client) {
      this.client = new Redis({
        port: producerConfigs.connection.port,
        host: producerConfigs.connection.host,
        username: producerConfigs.connection.username,
        password: producerConfigs.connection.password,
      });
      if (this.client.status === "wait") {
        await this.client.connect();
      }
    }
    return this.client;
  }

  async add(queue: string, data: string): Promise<string> {
    if (this.client.status === "wait") {
      await this.client.connect();
    }
    const clientResponse = await this.client.xadd(queue, "*", "data", data);
    return clientResponse as string;
  }

  async addAtomic(
    queue: string,
    additionalQueues: string[],
    data: string
  ): Promise<string[]> {
    if (this.client.status === "wait") {
      await this.client.connect();
    }
    const multi = this.client.multi();
    multi.xadd(queue, "*", "data", data);
    additionalQueues.forEach((additionalQueueName: string) => {
      multi.xadd(GetPrefixedQueue(additionalQueueName), "*", "data", data);
    });
    const clientMultiResponse = await multi.exec();
    return clientMultiResponse?.map((res) => res[1]) as string[];
  }

  async bulk(queue: string, data: unknown[]): Promise<string[]> {
    if (this.client.status === "wait") {
      await this.client.connect();
    }
    throw new Error("Method not implemented.");
  }

  async bulkAtomic(
    queue: string,
    additionalQueues: string[],
    data: unknown[]
  ): Promise<string[]> {
    if (this.client.status === "wait") {
      await this.client.connect();
    }
    throw new Error("Method not implemented.");
  }

  groupExists(queue: string, group: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getStreamLength(queue: string): Promise<number> {
    throw new Error("Method not implemented.");
  }

  readGroup(
    queue: string,
    group: string,
    consumerId: string,
    count: number,
    block: number
  ): Promise<unknown> {
    throw new Error("Method not implemented.");
  }

  acknowledgeMessage(
    queue: string,
    group: string,
    messageId: string
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  deleteConsumer(
    consumersSetId: string,
    queue: string,
    group: string,
    consumerId: string
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }

  setHeartbeat(workerId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getAllHeartbeats(): Promise<{ [key: string]: string }> {
    throw new Error("Method not implemented.");
  }

  deleteHeartbeat(workerId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async quit(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      console.log("Redis client connection has been closed.");
    }
  }
}
