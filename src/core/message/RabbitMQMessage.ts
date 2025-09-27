import {Channel, ConsumeMessage} from "amqplib";

export class RabbitMQMessage {
    constructor(readonly message: ConsumeMessage, readonly channel: Channel) {
    }
}