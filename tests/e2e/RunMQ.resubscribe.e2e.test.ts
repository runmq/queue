import {RunMQ} from '@src/core/RunMQ';
import {RabbitMQClientAdapter} from "@src/core/clients/RabbitMQClientAdapter";
import {Constants} from "@src/core/constants";
import {ChannelTestHelpers} from "@tests/helpers/ChannelTestHelpers";
import {RunMQUtils} from "@src/core/utils/RunMQUtils";
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

async function closeConnectionsForQueue(queueName: string, timeoutMs: number): Promise<number> {
    const cfg = RabbitMQManagementConfigExample.valid();
    const deadline = Date.now() + timeoutMs;
    const closed = new Set<string>();

    while (Date.now() < deadline) {
        const res = await fetch(`${cfg.url}/api/consumers`, {
            headers: {Authorization: authHeader()},
        });
        if (!res.ok) throw new Error(`list consumers failed: ${res.status}`);
        const consumers = (await res.json()) as ManagementConsumer[];
        const targets = consumers.filter((c) => c.queue?.name === queueName);

        if (targets.length > 0) {
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
            return closed.size;
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    return closed.size;
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
        await RunMQUtils.delay(500);
        expect(received.length).toBe(1);

        // Force-close only the connection(s) holding consumers for our queue.
        // Scoping by queue avoids killing unrelated parallel-test connections.
        const closed = await closeConnectionsForQueue(configuration.name, 5000);
        expect(closed).toBeGreaterThan(0);

        // Wait long enough for the rabbitmq-client to reconnect and for our
        // resubscription to fire (RECONNECT_DELAY is 5s). Add headroom.
        await RunMQUtils.delay(8000);

        // Re-acquire a publishing channel; the previous one was closed too.
        const republishChannel = await testingConnection.getChannel();
        republishChannel.publish(
            Constants.ROUTER_EXCHANGE_NAME,
            topic,
            MessageTestUtils.buffer(RunMQMessageExample.random())
        );

        await RunMQUtils.delay(2000);
        expect(received.length).toBe(2);

        await runMQ.disconnect();
    }, 30000);
});
