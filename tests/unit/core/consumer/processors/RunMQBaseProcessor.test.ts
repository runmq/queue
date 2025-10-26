import {RunMQBaseProcessor} from "@src/core/consumer/processors/RunMQBaseProcessor";
import {DefaultDeserializer} from "@src/core/serializers/deserializer/DefaultDeserializer";
import {MockedRabbitMQMessage} from "@tests/mocks/MockedRabbitMQMessage";
import {MockedDefaultDeserializer} from "@tests/mocks/MockedDefaultDeserializer";
import {RunMQProcessorConfigurationExample} from "@tests/Examples/RunMQProcessorConfigurationExample";

describe('RunMQBaseProcessor', () => {
    const handler = jest.fn();
    const processorConfig = RunMQProcessorConfigurationExample.random()
    const serializer: DefaultDeserializer<any> = new MockedDefaultDeserializer();
    const rabbitMQMessage = MockedRabbitMQMessage

    it("should delegate to deserializer then to handler", async () => {
        const processor = new RunMQBaseProcessor(handler, processorConfig, serializer)
        const result = await processor.consume(rabbitMQMessage)
        expect(result).toBe(true)
        expect(serializer.deserialize).toHaveBeenCalledWith(rabbitMQMessage.message, processorConfig);
    });
})