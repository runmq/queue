export class RabbitMQMessageProperties {
    constructor(
        readonly id: string,
        readonly correlationId: string,
    ) {
    }
}