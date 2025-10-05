import {RunMQProcessorConfiguration} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQBaseProcessor} from "@src/core/consumer/processors/RunMQBaseProcessor";
import {DefaultDeserializer} from "@src/core/serializers/deserializer/DefaultDeserializer";

describe('RunMQBaseProcessor', () => {
    const handler = jest.fn();
    const processorConfig: RunMQProcessorConfiguration = jest.fn() as unknown as RunMQProcessorConfiguration;
    const serializer: DefaultDeserializer<any> = {
        deserialize: jest.fn()
    } as unknown as DefaultDeserializer<any>;

    const message = {
        channel: {
            nack: jest.fn()
        },
        message: {
            content: Buffer.from('test message')
        }
    } as unknown as jest.Mocked<RabbitMQMessage>;

    it("should delegate to deserializer then to handler", async () => {
        const processor = new RunMQBaseProcessor(handler, processorConfig, serializer)
        const result = await processor.consume(message)
        expect(result).toBe(true)
        expect(serializer.deserialize).toHaveBeenCalledWith(message.message.content.toString(), processorConfig);
    });
})