import {ConnectionStrategy, RunMQConnectionConfig} from "@src/types";
import {AmqplibConnector} from "@src/core/strategies/AmqlibConnector";
import {RunMQException} from "@src/core/exceptions/RunMQException";

export class RunMQ {
    private connector: ConnectionStrategy

    constructor() {
        this.connector = AmqplibConnector.getInstance();
    }

    private async start(config: RunMQConnectionConfig): Promise<void> {
        const connectionResult = await this.connector.connect(config);
        if (connectionResult instanceof RunMQException) {
            throw connectionResult;
        }

    }
}