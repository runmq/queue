import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {MessageExample} from "@tests/Examples/MessageExample";
import {MockedRabbitMQChannel} from "@tests/mocks/MockedRabbitMQChannel";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {MockedAmqpMessage} from "@tests/mocks/MockedAmqpMessage";
import {Channel} from "amqplib";

export const MockedRabbitMQMessage = new RabbitMQMessage(
    MessageExample.person(),
    RunMQUtils.generateUUID(),
    RunMQUtils.generateUUID(),
    new MockedRabbitMQChannel(),
    MockedAmqpMessage,
    {}
)

export function mockedRabbitMQMessageWithChannelAndMessage(
    channel: MockedRabbitMQChannel,
    message: any,
    id: string,
    correlationId: string
) {
    return new RabbitMQMessage(
        message,
        id,
        correlationId,
        channel,
        MockedAmqpMessage,
        {}
    )
}

export function mockedRabbitMQMessageWithDeathCount(count: number) {
    return new RabbitMQMessage(
        MessageExample.person(),
        RunMQUtils.generateUUID(),
        RunMQUtils.generateUUID(),
        new MockedRabbitMQChannel(),
        MockedAmqpMessage,
        {
            "x-death": [
                {
                    "count": count,
                    "reason": "rejected",
                }
            ]
        }
    )
}


export function mockedRabbitMQMessageWithChannelAndDeathCount(channel: Channel, count: number) {
    return new RabbitMQMessage(
        MessageExample.person(),
        RunMQUtils.generateUUID(),
        RunMQUtils.generateUUID(),
        channel,
        MockedAmqpMessage,
        {
            "x-death": [
                {
                    "count": count,
                    "reason": "rejected",
                }
            ]
        }
    )
}