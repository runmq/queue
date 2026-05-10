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

async function closeConnectionsForQueue(queueName: string, timeoutMs: number): Promise<{ closed: Set<string> }> {
    const cfg = RabbitMQManagementConfigExample.valid();
    const targets = await waitForConsumers(queueName, 1, timeoutMs);
    const closed = new Set<string>();
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
    }
    return {closed};
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
    let runMQ: RunMQ | undefined;

    afterEach(async () => {
        if (runMQ) {
            try {
                await runMQ.disconnect();
            } catch {
                // best-effort: assertion failures should still leave the
                // worker process clean enough to exit
            }
            runMQ = undefined;
        }
    });

    afterAll(async () => {
        await testingConnection.disconnect();
    });

    it('should re-subscribe a consumer after its channel is closed by the broker', async () => {
        const configuration = RunMQProcessorConfigurationExample.simpleNoSchema('resubscribe_processor');
        const topic = 'resubscribe.topic';

        const channel = await testingConnection.getChannel();
        await ChannelTestHelpers.deleteQueue(channel, configuration.name);

        runMQ = await RunMQ.start(validConfig, MockedRunMQLogger);
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
        const {closed} = await closeConnectionsForQueue(configuration.name, 20000);
        expect(closed.size).toBeGreaterThan(0);

        // The deterministic signal that resubscription completed end-to-end is
        // a published message arriving at the handler — NOT the management
        // plugin's /api/consumers report, which lags basic.consume completion
        // by up to its stats-collection interval (5s default). Probe the
        // pipeline by republishing every 500ms until a new message arrives;
        // happy path resolves in ~5.5s (RECONNECT_DELAY + reconnect jitter +
        // first probe), and we tolerate up to 30s of churn in slow CI.
        const baseline = received.length;
        const republishChannel = await testingConnection.getChannel();
        const probeDeadline = Date.now() + 30000;
        while (received.length === baseline && Date.now() < probeDeadline) {
            try {
                republishChannel.publish(
                    Constants.ROUTER_EXCHANGE_NAME,
                    topic,
                    MessageTestUtils.buffer(RunMQMessageExample.random())
                );
            } catch {
                // channel may briefly not be writable during reconnect; retry
            }
            await new Promise((r) => setTimeout(r, 500));
        }
        expect(received.length).toBeGreaterThan(baseline);
    }, 40000);
});
