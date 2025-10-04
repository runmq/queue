import {RunMQProcessorConfiguration} from "@src/types";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {RunMQBaseProcessor} from "@src/core/consumer/processors/RunMQBaseProcessor";
import {DefaultSerializer} from "@src/core/serializers/DefaultSerializer";

describe('RunMQBaseProcessor', () => {
    const handler = jest.fn();
    const processorConfig: RunMQProcessorConfiguration = jest.fn() as unknown as RunMQProcessorConfiguration;
    const serializer: DefaultSerializer<any> = {
        deserialize: jest.fn()
    } as unknown as DefaultSerializer<any>;

    const message = {
        channel: {
            nack: jest.fn()
        },
        message: {
            content: Buffer.from('test message')
        }
    } as unknown as jest.Mocked<RabbitMQMessage>;

    it("should delegate to deserializer then to handler", () => {
        const processor = new RunMQBaseProcessor(handler, processorConfig, serializer)
        const result = processor.consume(message)
        expect(result).toBe(true)
        expect(serializer.deserialize).toHaveBeenCalledWith(message.message.content.toString(), processorConfig);
    });
})