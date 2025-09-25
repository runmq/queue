import {RunMQLogger} from "@src/core/logging/RunMQLogger";

export class RUNMQConsoleLogger implements RunMQLogger {
    readonly prefix = '[RunMQ] - ';

    log(message: string): void {
        console.log(message);
    }

    error(message: string, ...optionalParams: any[]): void {
        console.error(this.formatMessage(message), ...optionalParams);
    }

    warn(message: string, ...optionalParams: any[]): void {
        console.warn(this.formatMessage(message), ...optionalParams);
    }

    info(message: string, ...optionalParams: any[]): void {
        console.info(this.formatMessage(message), ...optionalParams);
    }

    debug(message: string, ...optionalParams: any[]): void {
        console.debug(this.formatMessage(message), ...optionalParams);
    }

    verbose(message: string, ...optionalParams: any[]): void {
        console.debug(this.formatMessage(message), ...optionalParams);
    }

    private formatMessage(message: string): string {
        return `${this.prefix} ${message}`;
    }
}