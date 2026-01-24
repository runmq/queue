import {RunMQUtils} from "@src/core/utils/RunMQUtils";
import {MessageExample} from "@tests/Examples/MessageExample";
import {MockedAMQPChannel} from "@tests/mocks/MockedAMQPChannel";
import {RabbitMQMessage} from "@src/core/message/RabbitMQMessage";
import {MockedAmqpMessage} from "@tests/mocks/MockedAmqpMessage";
import {AMQPChannel} from "@src/types";

export const MockedRabbitMQMessage = new RabbitMQMessage(
    MessageExample.person(),
    RunMQUtils.generateUUID(),
    RunMQUtils.generateUUID(),
    new MockedAMQPChannel(),
    MockedAmqpMessage,
    {}
)

export function mockedRabbitMQMessageWithChannelAndMessage(
    channel: AMQPChannel,
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
        new MockedAMQPChannel(),
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


export function mockedRabbitMQMessageWithChannelAndDeathCount(channel: AMQPChannel, count: number) {
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