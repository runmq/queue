import {Constants} from "@src/core/constants";

export class ChannelTestHelpers {
    private static defaultWait: number = 500;

    static async assertQueueMessageCount(channel: any, queueName: string, count: number, wait: number = ChannelTestHelpers.defaultWait) {
        await new Promise(resolve => setTimeout(resolve, wait));
        const q = await channel.checkQueue(queueName);
        expect(q.messageCount).toBe(count);
    }

    static async deleteQueue(channel: any, queueName: string): Promise<void> {
        await channel.deleteQueue(queueName);
        await channel.deleteQueue(Constants.DLQ_QUEUE_PREFIX + queueName);
        await channel.deleteQueue(Constants.RETRY_DELAY_QUEUE_PREFIX + queueName);
    }
}