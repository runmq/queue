import {RunMQ} from '@src/core/RunMQ';
import {RabbitMQClientAdapter} from "@src/core/clients/RabbitMQClientAdapter";
import {Constants} from "@src/core/constants";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {MockedRunMQLogger} from "@tests/mocks/MockedRunMQLogger";
import {RunMQConnectionConfigExample} from "@tests/Examples/RunMQConnectionConfigExample";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";
import {RunMQMessageExample} from "@tests/Examples/RunMQMessageExample";
import {MessageTestUtils} from "@tests/helpers/MessageTestUtils";
import {RabbitMQManagementConfigExample} from "@tests/Examples/RabbitMQManagementConfigExample";

interface ManagementConsumer {
    queue: { name: string };
    channel_details: { connection_name: string };
}

function authHeader(): string {
    const cfg = RabbitMQManagementConfigExample.valid();
    return 'Basic ' + Buffer.from(`${cfg.username}:${cfg.password}`).toString('base64');
}

async function listConsumersForQueue(queueName: string): Promise<ManagementConsumer[]> {
    const cfg = RabbitMQManagementConfigExample.valid();
    const res = await fetch(`${cfg.url}/api/consumers`, {
        headers: {Authorization: authHeader()},
    });
    if (!res.ok) throw new Error(`list consumers failed: ${res.status}`);
    const consumers = (await res.json()) as ManagementConsumer[];
    return consumers.filter((c) => c.queue?.name === queueName);
}

async function waitForConsumers(queueName: string, expectedCount: number, timeoutMs: number): Promise<ManagementConsumer[]> {
    const deadline = Date.now() + timeoutMs;
    let last: ManagementConsumer[] = [];
    while (Date.now() < deadline) {
        last = await listConsumersForQueue(queueName);
        if (last.length >= expectedCount) return last;
        await new Promise((r) => setTimeout(r, 200));
    }
    return last;
}

async function closeConnectionsForQueue(queueName: string, timeoutMs: number): Promise<{ closed: Set<string>; consumerTags: Set<string> }> {
    const cfg = RabbitMQManagementConfigExample.valid();
    const targets = await waitForConsumers(queueName, 1, timeoutMs);
    const closed = new Set<string>();
    const consumerTags = new Set<string>();
    for (const c of targets) {
        const connName = c.channel_details?.connection_name;
        if (connName && !closed.has(connName)) {
            const del = await fetch(
                `${cfg.url}/api/connections/${encodeURIComponent(connName)}`,
                {method: 'DELETE', headers: {Authorization: authHeader()}}
            );
            if (!del.ok && del.status !== 404) {
                throw new Error(`close connection failed: ${del.status}`);
            }
            closed.add(connName);
        }
        const tag = (c as any).consumer_tag;
        if (tag) consumerTags.add(tag);
    }
    return {closed, consumerTags};
}

async function waitForFreshConsumer(queueName: string, originalTags: Set<string>, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const consumers = await listConsumersForQueue(queueName);
        const fresh = consumers.find((c) => {
            const tag = (c as any).consumer_tag;
            return tag && !originalTags.has(tag);
        });
        if (fresh) return true;
        await new Promise((r) => setTimeout(r, 200));
    }
    return false;
}

async function waitFor<T>(check: () => T | Promise<T>, predicate: (v: T) => boolean, timeoutMs: number): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let last: T;
    do {
        last = await check();
        if (predicate(last)) return last;
        await new Promise((r) => setTimeout(r, 100));
    } while (Date.now() < deadline);
    return last!;
}

describe('RunMQ Consumer Channel Resubscription E2E', () => {
    const validConfig = RunMQConnectionConfigExample.valid();
    const testingConnection = new RabbitMQClientAdapter(validConfig);

    afterAll(async () => {
        await testingConnection.disconnect();
    });

    it('should re-subscribe a consumer after its channel is closed by the broker', async () => {
        const configuration = RunMQProcessorConfigurationExample.simpleNoSchema('resubscribe_processor');
        const topic = 'resubscribe.topic';

        const channel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(channel, configuration.name);

        const runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
        const received: any[] = [];
        await runMQ.process<Record<string, any>>(topic, configuration, async (msg) => {
            received.push(msg);
        });

        // Sanity: deliver one message before forcing a channel close.
        channel.publish(
            Constants.ROUTER_EXCHANGE_NAME,
            topic,
            MessageTestUtils.buffer(RunMQMessageExample.random())
        );
        await waitFor(
            () => received.length,
            (n) => n >= 1,
            5000
        );
        expect(received.length).toBe(1);

        // Force-close only the connection(s) holding consumers for our queue.
        // Scoping by queue avoids killing unrelated parallel-test connections.
        const {closed, consumerTags} = await closeConnectionsForQueue(configuration.name, 5000);
        expect(closed.size).toBeGreaterThan(0);

        // Wait until a NEW consumer (different tag from the one we killed) is
        // registered against the queue — that proves the resubscription
        // pipeline ran end-to-end. Polling beats fixed sleeps: it cuts the
        // happy-path delay and removes the slow-CI flake from waiting too short.
        const resubscribed = await waitForFreshConsumer(configuration.name, consumerTags, 20000);
        expect(resubscribed).toBe(true);

        // Re-acquire a publishing channel; the previous one was closed too.
        const republishChannel = await testingConnection.getChannel();
        republishChannel.publish(
            Constants.ROUTER_EXCHANGE_NAME,
            topic,
            MessageTestUtils.buffer(RunMQMessageExample.random())
        );

        await waitFor(
            () => received.length,
            (n) => n >= 2,
            5000
        );
        expect(received.length).toBe(2);

        await runMQ.disconnect();
    }, 40000);
});
